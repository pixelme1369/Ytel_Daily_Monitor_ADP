# SKILLS.md — Ytel Daily Monitor ADP

Quick reference for every feature and calculation in `Ytel_Daily_Monitor_ADP.html`.

---

## File Upload & Parsing

| Skill | How it works |
|-------|--------------|
| Upload XLSX or CSV | SheetJS 0.18.5 reads the file client-side with `{cellDates:true}` |
| Date normalization | `getDateStr(val)` — UTC midnight Date → UTC parts; datetime Date → local parts; strings match `YYYY-MM-DD` or `M/D/YYYY` |
| Duration parsing | `length_in_sec` column, cast to int |
| Debt parsing | `parseDebt()` strips `$` and commas, returns float |
| Timestamp parsing | `parseTs()` converts call_date Date object to numeric ms for comparisons |
| Row classification | `classifyRow()` tags each row as `Marketing`, `VDCL`, or `Closer` based on `source_id` |

---

## KPI Cards

| Card | Formula |
|------|---------|
| Total Calls | `calls.length` |
| Unique Calls | distinct `phone_number` values |
| Total Enrolled | distinct phones where `Cordoba Enrolled Date` = analysis date |
| Conv Rate | enrolled ÷ calls where `length_in_sec ≥ 300` |
| Total Debt Enrolled | sum of `Enrolled Debt` for enrolled phones |
| Dead ≤30s | calls where `length_in_sec ≤ 30` |
| DNC Still Dialed | calls where `status = DNC` |
| Drop / Timeout | calls where `status = DROP or TIMEOT` |
| 2–10 Min | calls where `120 ≤ length_in_sec < 600` |
| > 15 Min | unique phones where best call `> 900s` |
| > 30 Min | unique phones where best call `> 1800s` |
| > 45 Min | unique phones where best call `> 2700s` |

---

## Enrollment Credit

| Rule | Detail |
|------|--------|
| Date match | `Cordoba Enrolled Date` must equal the selected analysis date |
| One per phone | Only one enrollment credited per unique phone number |
| Primary credit | Agent named in `Assigned To` column gets credit |
| Fallback credit | If `Assigned To` is blank → agent with the latest call timestamp to that phone |
| Debt | `Enrolled Debt` value from the credited row |

---

## Agent Role Tags

| Set | Tag shown | >2 Min display |
|-----|-----------|----------------|
| `OPENERS` | `Opener` (blue) | Shows % in green/red color |
| `CLOSERS` | none | Plain number |
| `RETENTION` | `Retention` (purple) | Plain number |
| Not in any set | none | Plain number |

---

## Hourly Breakdown (per agent)

| Column | Logic |
|--------|-------|
| Unique #s | Phone counted in the hour of its **first call of the day** |
| Enrolled | Credited to the hour of the agent's **last call to that enrolled phone** |
| All other columns | Counted in the hour the individual call occurred |

---

## Missed Callbacks

| Step | Logic |
|------|-------|
| Detect timeout | Inbound `TIMEOT` calls → record latest timestamp per phone |
| Check resolved | Any call (inbound or outbound, non-TIMEOT) after the last timeout = resolved |
| Flag | Only phones with **zero follow-up** after their last timeout |
| Enrolled clients | Phone has any row with `Cordoba Enrolled Date` populated |
| Other calls | Phone has no enrolled date |
| Campaign filter | Dropdown filters both lists by campaign seen on TIMEOT calls |
| Debt display | `Enrolled Debt` shown in green if available |

---

## Issue Alerts

| Alert | Trigger |
|-------|---------|
| Missed callbacks | ≥ 1 phone never called back after TIMEOT — always runs |
| Dialer after hours | > 10 VDCL drops after 6pm |
| DNC compliance | > 20 calls with DNC status |
| PLR campaign broken | > 30 VDCL drops on PLR campaign |
| Dead call rate | > 30% of calls ≤ 30s |
| Drop/timeout rate | > 5% of calls are DROP or TIMEOT |
| Short-call agents | Agent with ≥ 30 calls and > 55% short rate |
| Excessive redialing | Agent + phone pair dialed outbound > 15 times |

---

## Duration Buckets

| Bucket | Condition |
|--------|-----------|
| Dead ≤30s | `sec <= 30` |
| < 2 Min | `sec < 120` |
| > 2 Min | `sec >= 120` |
| > 5 Min | `sec >= 300` |
| > 10 Min | `sec >= 600` |
| > 15 Min | `sec > 900` |
| > 30 Min | `sec > 1800` |

---

## Campaign Filter (Agent Table)

- Dropdown populated from all `campaign_id` values in today's calls
- Filters agent rows to only those with calls in the selected campaign
- Per-campaign stats come from `agentCampDataMap` built during analysis
- Enrollment in campaign view uses `r._enrolled` flag (per-row) not the credit map

---

## Charts

| Chart | Library | Data |
|-------|---------|------|
| Calls by hour | Chart.js bar | All calls + >2 min calls per hour bucket |
| VDCL by hour | Chart.js bar | VDCL drops per hour |
| Drops & Timeouts by hour | Chart.js bar | DROP + TIMEOT per hour, click for campaign breakdown |
| Performance leaderboard | CSS bar | Composite score per agent |

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `runAnalysis()` | Entry point — filters calls by date, builds enrollment maps, calls `buildDashboard()` |
| `buildDashboard()` | Normalizes fields, computes all stats, renders every section |
| `getDateStr(val)` | Normalizes any date value to `YYYY-MM-DD` string |
| `parseTs(val)` | Returns ms timestamp from a call_date Date object |
| `parseDebt(val)` | Strips currency formatting, returns float |
| `classifyRow(r)` | Returns `Marketing`, `VDCL`, or `Closer` |
| `normCamp(c)` | Normalizes campaign name (e.g. maps variants to canonical name) |
| `pct(a,b)` | Returns `"XX%"` string, handles divide-by-zero |
| `fmt$(n)` | Formats number as `$1,234` |
| `fmtDur(sec)` | Formats seconds as `Xh Ym Zs` |
| `renderAgentBody(rows)` | Re-renders agent table rows (called on campaign filter change) |
| `renderMissedCallbacks()` | Re-renders missed callback lists (called on campaign dropdown change) |
| `toggleAgentHours(id)` | Expands/collapses hourly sub-rows for an agent |

---

## Branch & Deploy

- **Dev branch:** `claude/practical-ramanujan-for1xy`
- **Production:** `main`
- No build step — open `Ytel_Daily_Monitor_ADP.html` directly in Chrome
