# CLAUDE.md

## Project

Single-file HTML call center dashboard: `Ytel_Daily_Monitor_ADP.html`
No framework, no build step — vanilla JS + SheetJS 0.18.5 + Chart.js 4.4.0 via CDN.

## Campaign Filter UI — Multi-Select Dropdowns

All 4 campaign `<select>` filters have been replaced with a custom `.ms-wrap` multi-select component.

| ID | Section | Filter function |
|----|---------|----------------|
| `campNameFilter` | Campaign / Queue Breakdown | `filterCampTable()` |
| `missedCampFilter` | Missed Callbacks | `renderMissedCallbacks()` |
| `dpcCampFilter` | DPC Never Called Back | `renderDpcDrops()` |
| `otCampFilter` | Opener Transfer Breakdown | `filterOpenerTable()` |

### Key helper functions (defined after `fmt$`)
- `toggleMs(id)` — opens/closes panel; closes all others
- `setMsOptions(id, options, onchange)` — populates panel (replaces `.innerHTML=...` populate calls)
- `getMsValues(id)` — returns `[]` (all) or array of selected values
- `onMsAll(id, onchange)` / `onMsItem(id, onchange)` — checkbox change handlers
- `updateMsLabel(id)` — updates button label text

### Filter function convention
- Old: `const camp = ...value` then `if(camp && r._campaign!==camp)`
- New: `const camps = getMsValues(id)` then `if(camps.length && !camps.includes(r._campaign))`
- Missed/DPC use `.some(c=>camps.includes(c))` since `d.camps` is an array

## Rules

- Read existing files before editing.
- Make the minimum necessary change.
- Do not rewrite entire files unless requested.
- Preserve existing styling and layout.
- Do not remove features unless asked.
- Keep explanations under 5 sentences.
- Ask before changing business logic.
- Run JS syntax check after edits: `node -e "const fs=require('fs');const h=fs.readFileSync('Ytel_Daily_Monitor_ADP.html','utf8');const s=h.match(/<script>([\s\S]*?)<\/script>/g);s.forEach((b,i)=>{try{new Function(b.replace(/<\/?script>/g,''));console.log('OK',i);}catch(e){console.log('ERR',i,e.message);}});"`
- Always push to branch `claude/blissful-curie-pvg620` on `pixelme1369/Ytel_Daily_Monitor_ADP`, then merge to `main` when asked.
- **Always update CLAUDE.md after every code change** to keep it current.

## Agent Roles

```js
const CLOSERS = new Set([...]);   // closers — no Opener tag, no >2min % display
const RETENTION = new Set([...]);  // retention agents
const OPENERS = new Set([...]);    // openers — show Opener tag, show >2min % in color
```

Agents not in any set show no role tag.
All three sets are defined at lines ~588–590 of `Ytel_Daily_Monitor_ADP.html`.

### Agent Name Matching

- All role lookups are done with `.toLowerCase()` — names in the sets must be lowercase
- When an agent's name has a known alternate spelling in the data, **add both spellings** to the set
  - Example: `'jon stultz'` and `'jon stults'` are both in OPENERS because the data has been seen with both spellings
- When a user reports an agent is "missing from the report", check if it's a spelling mismatch before assuming the agent isn't in the set

## Enrollment Logic

- One enrollment per unique phone number per day
- `Cordoba Enrolled Date` must match the analysis date
- **Agent credit** goes to the agent named in **`Assigned To`** column (if populated); fallback: agent with the latest call timestamp to that phone on that day
- Debt comes from `Enrolled Debt` column on the enrolled row

### Campaign Attribution (separate from agent credit)

- Enrollment is credited to the **campaign of the first call to that phone on that day**
- Rationale: if a lead first came in on TransferK, was transferred to an agent on AGENTDIRECT, and closed on campaign 1000 (agent outbound), it counts as a **TransferK enrollment**
- Campaign `1000` = agent outbound dialer — not a source campaign
- Implementation: `enrolledFirstCallTs[phone]` = min timestamp across all calls for that phone; `r._enrolled = true` only on that first-call row
- **Agent credit and campaign attribution are independent** — agent credit uses `agentEnrollCredit` (from `enrolledPhoneAgent`), campaign attribution uses `_enrolled` flag on the first-call row

### Enrolled column in Campaign / Queue Breakdown

- `_enrolled` is set on exactly one row per enrolled phone (the first call row)
- This prevents double-counting across campaigns (old bug: every row for the phone had `_enrolled=true`, so every campaign the phone touched counted +1)
- A warning note (⚠️) is shown in the section header — hover it for the full explanation
- The displayed number uses `s.enroll` (raw row count); `s.enrolledPhones` (Set) is used for the clickable phone modal

### Enrolled column in Agent Performance Table

- Uses `agentEnrollCredit[k].count` (unique enrolled phones per agent) — **never** `d.enr`
- `d.enr` is row-based and can be lower than actual credit when `Assigned To` credits an agent whose rows are not the max-timestamp rows
- The phone list shown on click comes from `agentEnrollPhones[k]` — always in sync with `credit.count`
- Implementation: `enr: credit.count, debt: credit.debt` in `buildRowsFromMap` (line ~619)

### Campaign `1000` and Agent Outbound

- Campaign `1000` = agent outbound dialer (closer calls out to client directly)
- It is NOT a source campaign — do not attribute enrollments to it
- If a phone first came in on TransferK, then the closer called back on `1000`, the enrollment belongs to **TransferK**
- This is correctly handled by the first-call attribution rule above

## Hourly Breakdown Logic

- **Unique #s per hour** — phone counted in the hour of its **first call of the day**
- **Enrolled per hour** — credited to the hour of the agent's **last call to that enrolled phone**

## Missed Callbacks Logic

- Tracks inbound `TIMEOT` calls and checks for any follow-up call (inbound OR outbound, non-TIMEOT) after the last timeout
- Phone is only flagged if **zero follow-up activity** occurred after the timeout
- Split into: Enrolled Clients (have `Cordoba Enrolled Date`) vs Other Calls
- Filterable by campaign dropdown

## DPC — Dropped Calls Never Called Back

- `DPC` = Dropped Call dispo — the call connected but dropped unexpectedly
- **Per-event logic**: for each DPC event on a phone, check if any non-DPC call occurred after that DPC's timestamp
- If a DPC has no non-DPC follow-up → that phone is flagged (even if other DPCs on same phone were followed up)
- Card is hidden when no flagged phones exist
- Split into: Enrolled Clients vs Other Calls; filterable by campaign
- Shows: phone number, enrolled debt (if any), agent who dropped the call, campaign
- Example: DPC at 07:27 → outbound calls at 07:29 and 07:30 → **not flagged** (follow-up exists)
- Implementation: `dpcEvents[phone]` = all DPC timestamps; `nonDpcTs[phone]` = all non-DPC timestamps; flag if any DPC has no later non-DPC call

## Agent Performance Table

Time bracket columns (in order): Short% ≤30s | <2 min | **1–2 min** | 5–10 min | 10–15 min | 15–20 min | 20–30 min | 30+ min | Avg Talk | Total Talk | Enrolled | Debt $ | Conv%

- `1–2 min` = 60 ≤ sec < 120 (orange color) — added to highlight calls that had real contact but were short
- `<2 min` = all calls under 120s (unchanged — includes the 1–2 min range)
- Bracket data tracked in: `agentMap`, `agentDirMap`, `agentCampDataMap`, hourly map — all use field `r1to2m`

## Agent Call Funnel Table

- Columns show % of agent's total calls in each time bracket
- **Sorting sorts by raw count (the number in parentheses), not percentage**
- Filterable by role (All / Closers / Openers) and campaign/direction dropdowns

## Openers — Transfer Breakdown by Campaign

Card is only visible when opener calls exist. Features:
- Time brackets: Dead ≤30s, 30s–2min, 2–5min, 5–10min, 10–15min, 15–20min, 20–30min, 30+min
- Each bracket cell shows: transfer count (clickable → phone number modal), enrolled count, total calls
- **Clicking a transfer count opens the enrolled phones modal with that bracket's transferred phone numbers**
- Filterable by campaign and direction dropdowns
- Click agent row to expand per-campaign sub-rows

### Time Bracket Accumulation (seconds)

| Bracket | Range |
|---------|-------|
| Dead ≤30s | sec ≤ 30 |
| 30s–2min | 31 ≤ sec < 120 |
| 2–5min | 120 ≤ sec < 300 |
| 5–10min | 300 ≤ sec < 600 |
| 10–15min | 600 ≤ sec < 900 |
| 15–20min | 900 ≤ sec < 1200 |
| 20–30min | 1200 ≤ sec < 1800 |
| 30+min | sec ≥ 1800 |

### Per-bracket counters (in `emptyS`)

- `rXtoY` — total calls in bracket
- `cltrns_XtoY` — CLtrns calls in bracket
- `enroll_XtoY` — enrolled AND CLtrns calls in bracket (used in breakdown cell)
- `enroll_all_XtoY` — enrolled calls in bracket regardless of transfer status (used in summary)
- `phones_XtoY` — Set of phone numbers for CLtrns calls (clickable modal)
- `enroll_short` — enrolled calls with sec ≤ 30 (for summary Dead row)

### Openers Summary Table

Appears below the breakdown. Rows = time brackets. Columns: Total Calls | Total Transfers | Total Enrolled.
- "Total Enrolled" uses `enroll_all_XtoY` (all enrolled in bracket, not just transfers).
- Totals must match the breakdown TOTAL row exactly.

### Openers — Lowest Transfer Rate (>2 min)

Ranking table below the summary. Shows every opener agent sorted by transfer rate ascending (worst first).
- `calls` = sum of all brackets over 2 min (r2to5m + r5to10 + r10to15 + r15to20 + r20to30 + gt30m)
- `trns` = sum of CLtrns across same brackets
- Rate = trns / calls, color-coded: red < 15%, neutral 15–30%, green ≥ 30%

## Key Columns Expected in XLSX

| Column | Notes |
|--------|-------|
| `call_date` | datetime, SheetJS reads as Date object with `cellDates:true` |
| `phone_number` / `phone_number_dialed` | phone number |
| `length_in_sec` | duration in seconds |
| `status` | dispo code (SALE, DNC, DROP, TIMEOT, CLtrns, CC, etc.) |
| `direction` | inbound / outbound |
| `full_name` | agent display name |
| `user` | agent ID (exclude VDCL / VDAD rows from agent table) |
| `campaign_id` | campaign identifier |
| `source_id` | VDCL / AGENTDIRECT / etc. |
| `Cordoba Enrolled Date` | date-only cell — SheetJS returns UTC midnight Date object |
| `Enrolled Debt` | dollar amount, may include `$` and commas |
| `Assigned To` | enrollment credit override |
| `CRM Status` | lead status |

## Date Parsing (`getDateStr`)

- Date objects at UTC midnight → use `getUTCFullYear/Month/Date` (date-only cells like `Cordoba Enrolled Date`)
- Date objects with time → use local `getFullYear/Month/Date` (datetime cells like `call_date`)
- Strings: match `YYYY-MM-DD` or `M/D/YYYY`

## Branch & Deploy

- Development branch: `claude/blissful-curie-pvg620`
- Repo: `pixelme1369/Ytel_Daily_Monitor_ADP`
- Merge to `main` when user asks to ship
- No CI, no build — just open the HTML file in Chrome

## Call Flow Patterns (for interpreting raw data)

Understanding how calls flow helps debug enrollment and campaign attribution:

| Pattern | What it means |
|---------|---------------|
| Phone has CLtrns on TransferK → SALE on AGENTDIRECT | Opener transferred to closer's direct queue; enrollment = TransferK |
| Phone has CLtrns on TransferK → N/SALE on AGENTDIRECT → SALE on 1000 | Opener transferred → closer missed then called back outbound; enrollment = TransferK |
| `Assigned To` populated | Explicit agent credit override; always use this over `full_name` for enrollment credit |
| `campaign_id = 1000` | Agent outbound dialer — not a source campaign |
| `campaign_id = AGENTDIRECT` | Call routed to a specific agent's queue (post-transfer or callback) |
| `campaign_id = TransferK` | Inbound queue from opener transfer — the originating source |
| `status = CLtrns` | Call Center Transfer — opener handed off to a closer |
| `status = CC` | Current Client — post-enrollment follow-up call |
| `status = SALE` | Enrollment closed |
| `status = N` | No Answer |
| `status = TIMEOT` | Caller timed out in queue — tracked for Missed Callbacks |
| `status = DPC` | Dropped Call — tracked for DPC Never Called Back section |
| `status = DROP` | System drop — counted in Drops column of campaign breakdown |
| `status = A` | Answering Machine |
| `status = DNC` | Do Not Call |
