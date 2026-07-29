const { BigQuery } = require('@google-cloud/bigquery');

const YTEL_TABLE = 'amity-one-debt-sys.aod_ytel_call_log.call_log';
const CRM_TABLE = 'amity-one-call-data.aod_forth_data.VW_SAMAN';

const YTEL_COLUMNS = [
  'call_date', 'direction', 'phone_number_dialed', 'phone_number', 'status',
  'status_name', 'user', 'full_name', 'campaign_id', 'source_id',
  'length_in_sec', 'recording_location'
];

function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// BigQuery's client returns DATETIME/DATE columns wrapped in an object with a
// plain (no timezone suffix) .value string -- unwrap so the frontend's
// existing string-based date parsing (same as the XLSX/CSV upload path)
// sees an identical wall-clock format, with no UTC conversion applied.
function toPlainString(v) {
  if (v == null) return v;
  if (typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

// CRM phone columns and the Ytel phone_number_dialed column aren't guaranteed
// to share formatting (dashes, +1, parens) -- normalize both sides to the
// last 10 digits before comparing.
function normPhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.slice(-10);
}

module.exports = async (req, res) => {
  const { from, to } = req.query || {};
  if (!from || !to) {
    res.status(400).json({ error: 'Missing from/to query params (YYYY-MM-DD)' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ error: 'from/to must be in YYYY-MM-DD format' });
    return;
  }
  if (!process.env.GCP_SERVICE_ACCOUNT_KEY) {
    res.status(500).json({ error: 'Server not configured: GCP_SERVICE_ACCOUNT_KEY is not set' });
    return;
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    res.status(500).json({ error: 'Server misconfigured: GCP_SERVICE_ACCOUNT_KEY is not valid JSON' });
    return;
  }

  const bigquery = new BigQuery({
    projectId: credentials.project_id,
    credentials: { client_email: credentials.client_email, private_key: credentials.private_key }
  });

  const callQuery = `
    SELECT ${YTEL_COLUMNS.join(', ')}
    FROM \`${YTEL_TABLE}\`
    WHERE call_date >= PARSE_DATETIME('%Y-%m-%d %H:%M:%S', @from)
      AND call_date < PARSE_DATETIME('%Y-%m-%d %H:%M:%S', @to)
  `;

  let callRows;
  try {
    const [rows] = await bigquery.query({
      query: callQuery,
      params: { from: `${from} 00:00:00`, to: `${nextDayStr(to)} 00:00:00` }
    });
    callRows = rows.map(r => ({
      call_date: toPlainString(r.call_date),
      direction: r.direction,
      phone_number_dialed: r.phone_number_dialed,
      phone_number: r.phone_number,
      status: r.status,
      status_name: r.status_name,
      user: r.user,
      full_name: r.full_name,
      campaign_id: r.campaign_id,
      source_id: r.source_id,
      length_in_sec: r.length_in_sec,
      recording_location: r.recording_location
    }));
  } catch (e) {
    res.status(500).json({ error: 'BigQuery call log query failed: ' + e.message });
    return;
  }

  const phones = [...new Set(
    callRows.map(r => normPhone(r.phone_number_dialed || r.phone_number)).filter(Boolean)
  )];

  // Per-lead record, keyed by every phone/phone2/phone3/phone4 it owns, so a
  // Ytel call to any of a lead's numbers finds the same CRM data.
  const crmByPhone = {};
  if (phones.length) {
    // VW_SAMAN's phone columns are FLOAT64, not STRING -- go through INT64 before
    // stringifying so no stray decimal point ends up in the digit comparison.
    const crmQuery = `
      SELECT assigned_to, phone, phone2, phone3, phone4, status, enrolled_debt,
             cordoba_enrolled_date, state
      FROM \`${CRM_TABLE}\`
      WHERE SUBSTR(IFNULL(CAST(SAFE_CAST(phone  AS INT64) AS STRING), ''), -10) IN UNNEST(@phones)
         OR SUBSTR(IFNULL(CAST(SAFE_CAST(phone2 AS INT64) AS STRING), ''), -10) IN UNNEST(@phones)
         OR SUBSTR(IFNULL(CAST(SAFE_CAST(phone3 AS INT64) AS STRING), ''), -10) IN UNNEST(@phones)
         OR SUBSTR(IFNULL(CAST(SAFE_CAST(phone4 AS INT64) AS STRING), ''), -10) IN UNNEST(@phones)
    `;
    try {
      const [crmRows] = await bigquery.query({
        query: crmQuery,
        params: { phones },
        types: { phones: ['STRING'] }
      });
      crmRows.forEach(lead => {
        [lead.phone, lead.phone2, lead.phone3, lead.phone4].forEach(p => {
          const key = normPhone(p);
          if (key && !crmByPhone[key]) crmByPhone[key] = lead;
        });
      });
    } catch (e) {
      res.status(500).json({ error: 'BigQuery CRM query failed: ' + e.message });
      return;
    }
  }

  const out = callRows.map(r => {
    const lead = crmByPhone[normPhone(r.phone_number_dialed || r.phone_number)];
    return {
      ...r,
      'CRM Status': lead ? (lead.status || '') : '',
      'Enrolled Debt': lead ? (lead.enrolled_debt || 0) : '',
      'Cordoba Enrolled Date': lead ? toPlainString(lead.cordoba_enrolled_date) : '',
      'Assigned To': lead ? (lead.assigned_to || '') : '',
      'State': lead ? (lead.state || '') : ''
    };
  });

  res.status(200).json({ rows: out });
};
