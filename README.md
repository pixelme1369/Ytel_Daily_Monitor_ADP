# Dialer Daily Monitor

A single-file HTML dashboard for call center daily operations. Upload one merged XLSX file (Ytel + CRM data) and instantly get a full breakdown of agent performance, campaign stats, enrollment conversions, and operational alerts — no server, no install, no build tools needed.

---

## How to Use

1. Open `Ytel_Daily_Monitor_ADP.html` in any modern browser (Chrome recommended)
2. Upload your merged Ytel + CRM XLSX file by clicking the upload card or dragging and dropping
3. Pick a date using the date filter and click **Run Analysis**
4. The dashboard populates instantly — all processing happens in your browser

---

## The XLSX File

The dashboard expects a **single merged file** that combines Ytel call data and CRM data into one sheet. The columns it reads are:

| Column | Source | Description |
|--------|--------|-------------|
| `phone_number` or `phone_number_dialed` | Ytel | The phone number dialed |
| `call_date` or `date` | Ytel | Full datetime of the call (e.g. `2026-06-18 09:33:34`) |
| `length_in_sec` | Ytel | Call duration in seconds |
| `status` | Ytel | Call result code (e.g. `SALE`, `DROP`, `TIMEOT`, `DNC`, `CC`) |
| `status_name` | Ytel | Human-readable disposition label |
| `direction` | Ytel | `inbound` or `outbound` |
| `full_name` or `user` | Ytel | Agent name |
| `user_group` | Ytel | Agent team/group |
| `campaign_id` | Ytel | Campaign identifier |
| `source_id` | Ytel | Used to classify call type (e.g. `VDCL`, `AGENTDIRECT`) |
| `Cordoba Enrolled Date` or `Enrolled Date` | CRM | Date the lead was enrolled |
| `Enrolled Debt` | CRM | Debt amount for enrolled leads |
| `Assigned To` | CRM | Agent who receives enrollment credit (overrides last-call logic) |
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
| **Dead ≤30s** | Calls where duration ≤ 30s | % of total calls |
| **DNC Still Dialed** | Calls with DNC status | Shows total DNC calls + unique DNC numbers + % of unique calls |
| **Drop / Timeout** | Calls with DROP or TIMEOT status | % of total calls |
| **2 – 10 Min** | Calls between 2 and 10 minutes | |
| **> 15 Min** | Unique phones where best call > 15 min | Based on unique callers, not total calls |
| **> 30 Min** | Unique phones where best call > 30 min | Based on unique callers, not total calls |
| **> 45 Min** | Unique phones where best call > 45 min | Based on unique callers, not total calls |

---

### Automated Issue Alerts

The dashboard automatically flags operational problems:

- **Dialer after hours** — VDCL drops after 6pm (more than 10)
- **DNC compliance risk** — DNC numbers still being dialed (more than 20)
- **PLR campaign broken** — PLR producing excessive VDCL drops (more than 30)
- **Dead call rate** — More than 30% of calls ending under 30 seconds
- **Drop/timeout rate** — Over 5% drop rate; shows top agents by drops and timeouts
- **Short-call agents** — Agents with over 55% of calls under 30 seconds flagged for coaching
- **Excessive redialing** — Agent + number pairs dialed outbound more than 15 times

---

### Missed Callbacks (bottom of dashboard)

A dedicated section that **always runs** regardless of drop rate. Flags every phone number where a client called in, hit a timeout, and was never reached afterward.

**A phone is considered resolved if any call (inbound or outbound, by any agent) happens after the last timeout.** Only phones with zero follow-up activity are flagged.

Results are split into two columns:

| Column | Description |
|--------|-------------|
| **Enrolled Clients** | Phones that have a `Cordoba Enrolled Date` — existing clients who were ignored |
| **Other Calls** | Phones with no enrolled date — leads or unknown callers who timed out |

Each row shows: phone number · debt amount (if available) · which agents timed out on them · campaign badge.

A **campaign dropdown** at the top of the card filters both lists simultaneously.

---

### Agent Performance Table

One row per agent (VDCL/system rows excluded). Sortable by any column. Click an agent name to expand an **hourly breakdown**.

| Column | Description |
|--------|-------------|
| Agent | Name — click to expand/collapse hourly breakdown |
| Calls | Total calls handled |
| Unique #s | Distinct phone numbers (first call of day counts toward that hour) |
| Inbound / Outbound | Unique inbound and outbound phone counts |
| Short% ≤30s | % of calls under 30 seconds (turns red if > 55%) |
| < 2 Min | Calls under 2 minutes |
| > 2 Min | Calls over 2 minutes |
| > 5 Min | Calls over 5 minutes |
| > 10 Min | Calls over 10 minutes |
| > 15 Min | Calls over 15 minutes |
| > 30 Min | Calls over 30 minutes |
| Avg Talk | Average call duration |
| Total Talk | Total time on calls |
| Enrolled | Enrollments credited to this agent |
| Debt $ | Total enrolled debt credited to this agent |
| Conv% (enr/>5m) | Enrolled ÷ calls over 5 min |

**Enrollment credit rules:**
- Enrollment is counted only if `Cordoba Enrolled Date` matches the call date being analyzed
- One enrollment per unique phone number (no double-counting)
- Credit goes to the agent named in **`Assigned To`** column (if populated)
- If `Assigned To` is blank, credit goes to the **last agent** who called that phone on that day

A **TOTAL** row is pinned at the bottom.

---

### Hourly Breakdown (per agent)

Expanding an agent shows sub-rows per hour of the day:

- **Unique #s per hour** — phone counted in the hour of its **first call of the day** (not first call within that hour)
- **Enrolled per hour** — enrollment credited to the hour of the agent's **last call to that enrolled phone**
- Also shows: calls, short%, duration buckets, avg talk, total talk

---

### Campaign / Queue Breakdown

A sortable table with one row per campaign.

| Column | Description |
|--------|-------------|
| Campaign | Campaign name |
| Calls | Total calls for this campaign |
| Dead ≤30s | Calls that ended within 30 seconds |
| < 2 Min | Calls under 2 minutes |
| > 2 Min | Calls over 2 minutes |
| > 5 Min | Calls over 5 minutes |
| > 15 Min | Calls over 15 minutes |
| > 30 Min | Calls over 30 minutes |
| Drops | DROP + TIMEOT calls |
| Avg Talk | Average call duration |
| Enrolled | Enrollments for this campaign |
| Conv% (enr/>5m) | Enrolled ÷ calls over 5 min for this campaign |

---

### Disposition Breakdown

Top 12 call dispositions with count and percentage. A second breakdown shows dispositions specifically for calls under 2 minutes — useful for spotting early hang-ups.

---

### VDCL / System Drop Analysis

System drops broken down by campaign and by hour. Useful for spotting campaigns with broken queue routing, agent availability issues, or after-hours dialing.

---

## Enrollment Logic

1. Scan all rows for the selected date
2. For each row where `Cordoba Enrolled Date` matches the analysis date, record: phone number, agent, timestamp, debt amount
3. If the same phone appears multiple times, keep only the **latest timestamp** row (that agent is the candidate for credit)
4. If `Assigned To` is populated on any row for that phone, that agent gets the credit regardless of who called last
5. Final enrolled count = number of distinct enrolled phones
6. Per-agent enrollment count and debt come from this map

---

## Duration Buckets

| Bucket | Condition |
|--------|-----------|
| Dead ≤30s | `length_in_sec <= 30` |
| < 2 Min | `length_in_sec < 120` |
| > 2 Min | `length_in_sec >= 120` |
| > 5 Min | `length_in_sec >= 300` |
| > 10 Min | `length_in_sec >= 600` |
| > 15 Min | `length_in_sec > 900` |
| > 30 Min | `length_in_sec > 1800` |

For KPI cards, **> 15 Min**, **> 30 Min**, and **> 45 Min** are based on **unique phone numbers** (best call per phone), not raw call counts.

---

## Technical Details

- **Single file** — all HTML, CSS, and JavaScript in `Ytel_Daily_Monitor_ADP.html`
- **No server required** — open directly in a browser, works fully offline
- **No frameworks** — vanilla JavaScript only
- **Libraries (loaded via CDN):**
  - [SheetJS (xlsx) 0.18.5](https://sheetjs.com/) — reads the XLSX file client-side
  - [Chart.js 4.4.0](https://www.chartjs.org/) — renders charts
- **Your data never leaves your computer** — all processing is done in the browser

---

## Repository

- **Repo:** `pixelme1369/dialer-monitor_CRM_Ytel`
- **Branch:** `claude/practical-ramanujan-for1xy`
