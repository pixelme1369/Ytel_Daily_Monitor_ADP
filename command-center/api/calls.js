const { BigQuery } = require('@google-cloud/bigquery');

const TABLE = 'amity-one-debt-sys.aod_ytel_call_log.call_log';

const COLUMNS = [
  'call_date', 'direction', 'phone_number_dialed', 'phone_number', 'status',
  'status_name', 'user', 'full_name', 'campaign_id', 'source_id',
  'length_in_sec', 'recording_location'
];

function nextDayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// BigQuery's client returns DATETIME columns wrapped in an object with a
// plain (no timezone suffix) .value string -- unwrap so the frontend's
// existing string-based date parsing (same as the XLSX/CSV upload path)
// sees an identical wall-clock format, with no UTC conversion applied.
function toPlainString(v) {
  if (v == null) return v;
  if (typeof v === 'object' && 'value' in v) return v.value;
  return v;
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

  const query = `
    SELECT ${COLUMNS.join(', ')}
    FROM \`${TABLE}\`
    WHERE call_date >= PARSE_DATETIME('%Y-%m-%d %H:%M:%S', @from)
      AND call_date < PARSE_DATETIME('%Y-%m-%d %H:%M:%S', @to)
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: { from: `${from} 00:00:00`, to: `${nextDayStr(to)} 00:00:00` }
    });
    const out = rows.map(r => ({
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
    res.status(200).json({ rows: out });
  } catch (e) {
    res.status(500).json({ error: 'BigQuery query failed: ' + e.message });
  }
};
