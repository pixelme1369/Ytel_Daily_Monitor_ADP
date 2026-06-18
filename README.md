# Dialer Daily Monitor

A single-file HTML dashboard for call center daily operations. Upload one merged XLSX file (Ytel + CRM data) and instantly get a full breakdown of agent performance, campaign stats, enrollment conversions, and operational alerts — no server, no install, no build tools needed.

---

## How to Use

1. Open `Dialer_Daily_Monitor.html` in any modern browser (Chrome recommended)
2. Upload your merged Ytel + CRM XLSX file by clicking the upload card or dragging and dropping
3. Pick a date using the date filter and click **Analyze**
4. The dashboard populates instantly — all processing happens in your browser

---

## The XLSX File

The dashboard expects a **single merged file** that combines Ytel call data and CRM data into one sheet. The columns it reads are:

| Column | Source | Description |
|--------|--------|-------------|
| `phone_number` or `phone_number_dialed` | Ytel | The phone number dialed |
| `call_date` or `date` | Ytel | Full datetime of the call (e.g. `6/16/2026 0:27:09`) |
| `duration` | Ytel | Call duration in seconds |
| `disposition` or `status` | Ytel | Call result code (e.g. `ANSWER`, `DROP`, `TIMEOT`, `DNC`) |
| `full_name` or `user` | Ytel | Agent name |
| `user_group` | Ytel | Agent team/group |
| `campaign` | Ytel | Campaign name |
| `call_type` | Ytel | Used to classify call type |
| `Cordoba Enrolled Date` or `Enrolled Date` | CRM | Date the lead was enrolled |
| `Enrolled Debt` | CRM | Debt amount for enrolled leads |
| `CRM Status` | CRM | Lead status from CRM |

---

## Dashboard Sections

### KPI Cards (top row)

| Card | Formula | Notes |
|------|---------|-------|
| **Total Calls** | Count of all rows | All dispositions included |
| **Unique Calls** | Distinct phone numbers | Deduplicates repeat dials to same number |
| **Total Enrolled** | Unique phones with enrolled date = call date | One enrollment per phone number |
| **Conv Rate** | Enrolled ÷ Calls > 5 min | Only counts calls that lasted over 5 minutes as real opportunities |
| **Total Debt Enrolled** | Sum of `Enrolled Debt` for enrolled phones | Dollar value of day's enrollments |
| **Dead ≤30s** | Calls where duration ≤ 30s | Based on total calls |
| **DNC Still Dialed** | Calls with DNC status | Shows total DNC calls + unique DNC numbers + % of unique calls |
| **Drop / Timeout** | Calls with DROP or TIMEOT status | % of total calls |
| **2 – 10 Min** | Calls between 2 and 10 minutes | Non-overlapping bucket |
| **> 15 Min** | Unique phones where best call > 15 min | Based on unique callers, not total calls |
| **> 30 Min** | Unique phones where best call > 30 min | Based on unique callers, not total calls |
| **> 45 Min** | Unique phones where best call > 45 min | Based on unique callers, not total calls |
| **Total Talk Time** | Sum of all call durations | Formatted as hours/minutes/seconds |

---

### Automated Issue Alerts

The dashboard automatically flags operational problems:

- **Dialer after hours** — VDCL drops after 6pm (more than 10)
- **DNC compliance risk** — DNC numbers still being dialed (more than 20)
- **PLR campaign broken** — PLR producing excessive VDCL drops (more than 30)
- **Dead call rate** — More than 30% of calls ending under 30 seconds
- **Drop/timeout rate** — Over 5% drop rate; shows top agents by drops and timeouts, plus a full list of unique phone numbers that timed out (missed callers to follow up with)
- **Short-call agents** — Agents with over 55% of calls under 30 seconds flagged for coaching

---

### Campaign / Queue Breakdown

A sortable table with one row per campaign. Click any column header to sort ascending or descending (▲/▼).

| Column | Description |
|--------|-------------|
| Campaign | Campaign name |
| Calls | Total calls for this campaign |
| Dead ≤30s | Calls that ended within 30 seconds |
| < 2 Min | Calls under 2 minutes |
| 2–10 Min | Calls between 2 and 10 minutes |
| > 15 Min | Calls over 15 minutes |
| > 30 Min | Calls over 30 minutes |
| Drops | DROP + TIMEOT calls |
| Avg Talk | Average call duration |
| Enrolled | Enrollments for this campaign |
| Conv% (enr/>5m) | Enrolled ÷ calls over 5 min for this campaign |

A **TOTAL** row is pinned at the bottom summing all campaigns.

---

### Agent Performance Table

One row per agent (VDCL/system rows excluded). Sortable by any column. Click an agent name to expand an **hourly breakdown** showing how their calls were distributed across the day (08:00, 09:00, 10:00…).

| Column | Description |
|--------|-------------|
| Agent | Name — click to expand/collapse hourly breakdown |
| Calls | Total calls handled |
| Unique #s | Distinct phone numbers contacted |
| Short% ≤30s | % of calls under 30 seconds (turns red if > 55%) |
| < 2 Min | Calls under 2 minutes |
| 2–10 Min | Calls 2 to 10 minutes |
| > 15 Min | Calls over 15 minutes |
| > 30 Min | Calls over 30 minutes |
| Avg Talk | Average call duration |
| Total Talk | Total time on calls |
| Enrolled | Enrollments credited to this agent |
| Debt $ | Total enrolled debt credited to this agent |
| Conv% (enr/>5m) | Enrolled ÷ calls over 5 min |

**Enrollment credit rules:**
- Enrollment is counted only if `Cordoba Enrolled Date` matches the call date
- One enrollment per unique phone number (no double-counting)
- Credit goes to the **last agent** who spoke with that client on that day (by timestamp)

A **TOTAL** row is pinned at the bottom.

---

### Hourly Breakdown (per agent)

Expanding an agent shows sub-rows per hour:

- Calls, short%, duration buckets, avg talk, total talk, enrolled for that hour
- Collapse by clicking the agent name again
- Arrow toggles ▶ (collapsed) / ▼ (expanded)

---

### Disposition Breakdown

Top 12 call dispositions shown as a horizontal bar chart with count and percentage. Useful for spotting unusual outcome patterns.

---

### Top Attempted Numbers

The 5 most-dialed phone numbers with:
- Attempt count
- Inbound flag (highlighted in red if the number called in)
- Agents who spoke with them
- Last disposition status
- Whether they enrolled

---

### VDCL / System Drop Analysis

Total system drops for the day broken down by campaign with a bar chart. Useful for spotting campaigns with broken queue routing or agent availability issues.

---

## Enrollment Logic

Enrollment is detected by checking whether `Cordoba Enrolled Date` (or `Enrolled Date`) matches the date being analyzed. The rules:

1. Scan all rows for that date
2. For each row with a matching enrolled date, record: phone number, agent name, timestamp, debt amount
3. If the same phone appears multiple times (called back across the day), keep only the **latest timestamp** — that agent gets the credit
4. Final enrolled count = number of distinct enrolled phones
5. Per-agent enrollment count comes from this map, not raw row counting

This ensures one enrollment per lead regardless of how many times they were called, and credit always goes to the agent who had the last conversation.

---

## Duration Buckets

These buckets are **non-overlapping** (except Dead ≤30s which overlaps with < 2 Min):

| Bucket | Condition |
|--------|-----------|
| Dead ≤30s | `duration <= 30s` |
| < 2 Min | `duration < 120s` |
| 2–10 Min | `duration >= 120s AND < 600s` |
| > 15 Min | `duration > 900s` |
| > 30 Min | `duration > 1800s` |

For KPI cards, **> 15 Min** and **> 30 Min** are based on **unique phone numbers** (best call per phone), not raw call counts.

---

## Technical Details

- **Single file** — all HTML, CSS, and JavaScript in `Dialer_Daily_Monitor.html`
- **No server required** — open directly in a browser, works fully offline
- **No frameworks** — vanilla JavaScript only
- **Libraries (loaded via CDN):**
  - [SheetJS (xlsx) 0.18.5](https://sheetjs.com/) — reads the XLSX file client-side
  - [Chart.js 4.4.0](https://www.chartjs.org/) — renders the VDCL bar chart
- **Your data never leaves your computer** — all processing is done in the browser

---

## Repository

- **Repo:** `pixelme1369/Dialer-Monitor_CRM_Ytel`
- **Branch:** `claude/practical-ramanujan-for1xy`
- **Live (GitHub Pages):** Configure Pages in repo settings to serve from the branch root, then open `Dialer_Daily_Monitor.html`
