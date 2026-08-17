const { BigQuery } = require('@google-cloud/bigquery');

const YTEL_TABLE = 'amity-one-debt-sys.aod_ytel_call_log.call_log';
const CRM_TABLE = 'amity-one-call-data.aod_forth_data.VW_SAMAN';

// The 3 "at-risk" CRM statuses this report watches, lowercased for the SQL-side match.
const TARGET_STATUSES = ['pending cancellation', 'on hold nsf', 'cancelled'];
// Per user request: only leads whose CURRENT time in that status is under 10 days —
// always, regardless of whatever date range is selected elsewhere in the dashboard.
const MAX_DAYS_IN_STATUS = 10;

// BigQuery's client returns DATETIME/DATE columns wrapped in an object with a plain
// (no timezone suffix) .value string -- unwrap so this matches the same wall-clock
// format api/merged-calls.js already produces for the frontend.
function toPlainString(v) {
  if (v == null) return v;
  if (typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

// CRM phone columns are FLOAT64 (see api/merged-calls.js) and Ytel's phone_number_dialed
// is a formatted string (dashes/+1/parens) -- normalize both to the last 10 digits.
function normPhone(v) {
  const digits = String(v == null ? '' : v).replace(/\D/g, '');
  return digits.slice(-10);
}

module.exports = async (req, res) => {
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

  // 1. Every CRM lead currently sitting at one of the 3 watched statuses, under 10 days in that status.
  //    time_in_status is a number (days already elapsed at that status, as of "now" in BigQuery) --
  //    NULL fails the "< @maxDays" comparison, so leads with no known time-in-status are naturally excluded.
  //    Bug fixed (August 2026): the real CRM value is "On Hold - NSF" (a dash), not "On Hold NSF" --
  //    an exact LOWER(TRIM(status)) match against 'on hold nsf' silently matched nothing, so this
  //    entire status bucket never appeared even for real leads confirmed 5 days into it. Fixed by
  //    collapsing any run of non-alphanumeric characters (dashes, extra spaces) to a single space
  //    before comparing -- "On Hold - NSF", "On Hold  NSF", and "On Hold NSF" all now normalize to
  //    the same 'on hold nsf' target. Exact equality (not LIKE) is kept so a status like
  //    "Cancelled - Refund Pending" still can't accidentally match "cancelled".
  const leadQuery = `
    SELECT assigned_to, phone, phone2, phone3, phone4, status, time_in_status, enrolled_debt, state
    FROM \`${CRM_TABLE}\`
    WHERE LOWER(TRIM(REGEXP_REPLACE(status, r'[^a-zA-Z0-9]+', ' '))) IN UNNEST(@statuses)
      AND time_in_status < @maxDays
  `;

  let leadRows;
  try {
    const [rows] = await bigquery.query({
      query: leadQuery,
      params: { statuses: TARGET_STATUSES, maxDays: MAX_DAYS_IN_STATUS }
    });
    leadRows = rows;
  } catch (e) {
    res.status(500).json({ error: 'BigQuery CRM status-watch query failed: ' + e.message });
    return;
  }

  const leads = leadRows.map(lead => {
    const phones = [...new Set([lead.phone, lead.phone2, lead.phone3, lead.phone4].map(normPhone).filter(Boolean))];
    const daysInStatus = typeof lead.time_in_status === 'number' ? lead.time_in_status : parseFloat(lead.time_in_status);
    return {
      phones,
      primaryPhone: phones[0] || '',
      status: (lead.status || '').trim(),
      daysInStatus: isNaN(daysInStatus) ? null : daysInStatus,
      assignedTo: (lead.assigned_to || '').trim(),
      enrolledDebt: lead.enrolled_debt || 0,
      state: (lead.state || '').trim()
    };
  }).filter(l => l.phones.length && l.daysInStatus != null);

  // 2. Outbound Ytel calls in a window wide enough to cover every possible status-entry date
  //    (up to MAX_DAYS_IN_STATUS ago), plus a 1-day buffer for timezone/day-boundary safety.
  //    No phone filter pushed into SQL here -- phone_number_dialed is a real formatted string
  //    (dashes/+1/parens), and matching it is done in JS against the normalized lead phone set,
  //    same convention api/merged-calls.js uses for the Ytel side.
  let callRows = [];
  if (leads.length) {
    const callQuery = `
      SELECT call_date, phone_number_dialed, phone_number, status, status_name, user, full_name,
             campaign_id, length_in_sec, recording_location
      FROM \`${YTEL_TABLE}\`
      WHERE call_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL @windowDays DAY)
        AND direction = 'outbound'
    `;
    try {
      const [rows] = await bigquery.query({
        query: callQuery,
        params: { windowDays: MAX_DAYS_IN_STATUS + 1 }
      });
      callRows = rows;
    } catch (e) {
      res.status(500).json({ error: 'BigQuery outbound call query failed: ' + e.message });
      return;
    }
  }

  const callsByPhone = {};
  callRows.forEach(r => {
    const key = normPhone(r.phone_number_dialed || r.phone_number);
    if (!key) return;
    (callsByPhone[key] = callsByPhone[key] || []).push(r);
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const out = leads.map(lead => {
    // Status-entry date approximated as "now minus the current elapsed days in status" -- the
    // only anchor available since VW_SAMAN doesn't expose an actual status-change timestamp.
    const entryTs = now - Math.floor(lead.daysInStatus) * DAY_MS;
    const matched = [];
    lead.phones.forEach(p => { (callsByPhone[p] || []).forEach(c => matched.push(c)); });
    const afterEntry = matched.filter(c => {
      const ts = new Date(toPlainString(c.call_date)).getTime();
      return !isNaN(ts) && ts >= entryTs;
    });
    return {
      phone: lead.primaryPhone,
      status: lead.status,
      daysInStatus: lead.daysInStatus,
      assignedTo: lead.assignedTo,
      enrolledDebt: lead.enrolledDebt,
      state: lead.state,
      outboundCount: afterEntry.length,
      calls: afterEntry.map(c => ({
        call_date: toPlainString(c.call_date),
        status: c.status,
        status_name: c.status_name,
        user: c.user,
        full_name: c.full_name,
        campaign_id: c.campaign_id,
        length_in_sec: c.length_in_sec,
        recording_location: c.recording_location
      }))
    };
  });

  res.status(200).json({ rows: out });
};
