# CLAUDE.md

## Project

Vanilla JS call center dashboard suite — no framework, no build step.
SheetJS 0.18.5 + Chart.js 4.4.0 via CDN.

| File | Purpose |
|------|---------|
| `Ytel_Daily_Monitor_ADP.html` | Original single-date dashboard (production) |
| `Ytel_Daily_Monitor_v2.html` | Redesigned dashboard with sidebar nav, date range, export CSV, role editor |
| `Agent_Performance_Range.html` | Standalone agent performance report with date range picker |

---

## v2 Dashboard (`Ytel_Daily_Monitor_v2.html`)

### Layout
Left sidebar (220px fixed) + main content area. Sidebar contains: logo, file upload drag-drop zone, `fromDate`/`toDate` pickers, Run Analysis button, and nav links.

### Color Palette
- Sidebar: `#0F172A` | Accent: `#6366F1` | Success: `#10B981` | Danger: `#EF4444` | Warning: `#F59E0B`
- Background: `#F8FAFC` | Cards: `#FFFFFF` with `border-radius:12px`

### New Features vs Original
| Feature | Details |
|---------|---------|
| Date range | `fromDate`/`toDate` pickers; `runAnalysis()` filters `d>=fromStr&&d<=toStr`; enrollment date must fall within range |
| Export CSV | `exportTable(tableId, filename)` — reads DOM table, converts to CSV, downloads via Blob. Buttons on Agent, Funnel, Campaign cards |
| Role editor | Settings section: textareas (one name/line) for Closers / Openers / Retention; `saveRoles()` updates Sets in memory (session-only); `renderRoleEditor()` populates textareas |
| Collapsible sections | Each card has ▼/▶ toggle; state persisted in `localStorage` keyed `collapse:<sectionId>` |
| Multi-file upload | Merged into `mergedRaw[]` — analyze data from multiple XLSX files at once |

### Script Regions (in order)
`CONFIG` → `UTILS` → `STATS` → `FILE I/O` → `NORMALIZATION` → `ENROLLMENT` → `ACCUMULATION` → `ANALYSIS` → `RENDER AGENTS` → `RENDER CAMPAIGNS` → `RENDER OPENERS` → `RENDER ALERTS` → `RENDER KPI` → `CHARTS` → `FILTERS` → `EXPORT` → `ROLE EDITOR` → `UI EVENTS` → `INIT`

Key refactors: `newCallStats()` factory replaces 9 inline duplicates; `accumulate(d,r)` replaces 18 repeated bucketing blocks.

### Sections Preserved
KPIs · Issues Detected · Hour Chart · Dispo list · Agent Performance (incl. 1–2min bracket, hourly sub-rows) · Agent Funnel · Agent Rankings · Campaign Breakdown · Top 5 Numbers · VDCL Analysis · Drops by Hour · Missed Callbacks · DPC Drops (incl. sec filter) · Openers Transfer Breakdown

### Syntax Check (v2)
```
node -e "const fs=require('fs');const h=fs.readFileSync('Ytel_Daily_Monitor_v2.html','utf8');const s=h.match(/<script>([\s\S]*?)<\/script>/g);s.forEach((b,i)=>{try{new Function(b.replace(/<\/?script>/g,''));console.log('OK',i);}catch(e){console.log('ERR',i,e.message);}});"
```

---

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
- Implementation: `dpcEvents[phone]` = all DPC timestamps+sec; `nonDpcTs[phone]` = all non-DPC timestamps; flag if any DPC has no later non-DPC call
- `dpcFlagged[phone].secs` = array of `length_in_sec` for each unfollowed DPC event; `dpcData[].sec` = max sec across those events
- **Duration filter** (4 buttons in card header): All | <1 min (sec<60) | 1–2 min (60≤sec<120) | >2 min (sec≥120)
  - `window._dpcSecFilter` holds current selection; `setDpcSec(val)` updates highlight + calls `renderDpcDrops()`
- **High alert badge**: every row in this list already means zero follow-up of any kind happened after the drop (per the flagging rule above), which implies no outbound call was ever made either. Each row shows a ⚠️ badge before the phone number (tooltip: "High alert — no outbound call was ever made to this phone after the drop"). Implemented in the `rowHtml` template inside `renderDpcDrops()` (both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html`).
- **Click phone to play/download recording**: the phone number is an `.enroll-click` span; `dpcEvents[phone]` entries now also carry `recording:r._recording` (parsed from `recording_location`) and `crmStatus:r._crmStatus`, and `dpcFlagged[phone].recs` collects `{phone,sec,recording,crmStatus}` for each unfollowed DPC event → surfaced as `dpcData[].records`. Clicking calls the shared `showFlaggedPhones(d.records, d.phone+' — Dropped Call')` modal (same one used by Long Calls, No Deal) — shows an inline `<audio controls>` player and a "⬇ Download recording" link per event; phones with no recording show "No recording available".

## DNC Calls by Hour Chart

- Card `#dncHourCard` sits directly below the "Call volume by hour" chart in both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html` — shows when DNC-flagged numbers are still being dialed throughout the day
- Hidden (`style="display:none"`) when `dncRows.length===0`
- Reuses `dncRows` (calls where `r._status==='DNC'`, already computed in `buildDashboard` for the "DNC Still Dialed" KPI/issue) — bucketed by `r._hour` into `dncHourCounts`
- Rendered as `dncHourChart` (Chart.js bar chart), destroyed/recreated each `buildDashboard()` run and on `resetDashboard()`/`clearAll()` alongside `hourChart`/`vdclChart`/`dropHourChart`
- Bar color uses each dashboard's own danger color: `#DC2626` in the original, `#EF4444` in v2

## Incomplete Transfers (CLtrns with no inbound follow-up)

Flags calls dispositioned `CLtrns` (Call Center Transfer) where the transfer never actually landed with another agent — the opener marked it as transferred but no one on the receiving end ever picked it up. Card `#badTransferCard` in both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html`, styled like the DPC card (red title, campaign multi-select filter, Enrolled Clients vs Other Calls split), placed directly after the DPC card.

- **Per-event logic**: for each `CLtrns` event on a phone, check if any call with `direction === 'inbound'` (any status, any campaign) occurred on that phone after the `CLtrns` timestamp
- If no later inbound call exists → flagged. This mirrors a real transfer: a genuine hand-off produces a new inbound call into the closer's queue (e.g. `AGENTDIRECT`); if that never happens, the "transfer" never actually landed
- Rule was confirmed against two real examples: (1) opener dispositions `CLtrns`, no other row for that lead at all → flagged; (2) opener dispositions `CLtrns` on `TransferK`, later an agent has an inbound call on `AGENTDIRECT` for the same phone → correctly not flagged
- Scope: any agent's `CLtrns` dispo is checked, not just agents in the `OPENERS` set (a closer or untagged agent could also mis-use the status)
- Implementation: `cltrnsEvents[phone]` = all CLtrns timestamps+sec+recording; `inboundTs[phone]` = timestamps of all inbound calls (any status) to that phone; flag if any CLtrns event has no later inbound call
- `badTransferFlagged[phone].recs` collects `{phone,sec,recording,crmStatus}` for each unfollowed CLtrns event → surfaced as `badTransferData[].records`
- **Click phone to play/download recording**: same shared `showFlaggedPhones(d.records, d.phone+' — Incomplete Transfer')` modal used by DPC and Long Calls, No Deal

### Correct Transfers Received by Agent

Card `#receivedTransferCard` in both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html`, placed directly after the Incomplete Transfers card. Shows, per receiving agent, how many `CLtrns` transfers actually landed with them.

- For each `CLtrns` event that is NOT flagged as incomplete (i.e. it has a later inbound call), credit goes to the agent on the **first** inbound call after that event's timestamp — that's the agent who actually picked up the transferred lead
- Implementation: `inboundCalls[phone]` = all inbound calls (any status) with `{ts, agent, camp, sec, recording}`, sorted by `ts`; for each `cltrnsEvents[phone]` entry, `followUps.find(f=>f.ts>ev.ts)` gives the receiving call
- `receivedTransfers[agent]` = `{count, records:[{phone,sec,recording,crmStatus}], enrolledPhones:Set}` — one record per transfer received, using the **receiving agent's own call** (not the opener's CLtrns call) for sec/recording/crmStatus; `enrolledPhones` = subset of received phones present in `anyEnrolledPhone` (any row for that phone has a `Cordoba Enrolled Date`)
- Table: Agent | Transfers Received (count) | Enrolled (count) | Conv% — sorted by Transfers Received descending; both counts clickable — Transfers Received via `showFlaggedPhones(r.records, r.agent+' — Transfers Received')` (audio playback), Enrolled via `showEnrolledPhones([...r.enrolledPhones], r.agent+' — Enrolled from Transfers')` (plain phone list); Enrolled shows `—` when zero; Conv% = `pct(r.enrolledPhones.size, r.count)` (e.g. 1 enrolled of 2 received = 50.0%)

## Agent Performance Table

Time bracket columns (in order): Short% ≤30s | <2 min | **1–2 min** | 5–10 min | 10–15 min | 15–20 min | 20–30 min | 30+ min | Avg Talk | Total Talk | Enrolled | Debt $ | Conv%

- `1–2 min` = 60 ≤ sec < 120 (orange color) — added to highlight calls that had real contact but were short
- `<2 min` = all calls under 120s (unchanged — includes the 1–2 min range)
- Bracket data tracked in: `agentMap`, `agentDirMap`, `agentCampDataMap`, hourly map — all use field `r1to2m`

### Long Calls, No Deal Flag

Implemented in both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html`. Card shown directly below the Agent Performance table (hidden when no agent has flagged phones). Flags, per agent, phone numbers with a call over a selectable length (20/25/30 min) that never converted to an enrollment.

- `agentMap[name].phoneMaxSec` — `{phone: maxSecSeenForThatPhone}`, only populated for calls ≥1200 sec (the lowest selectable threshold) — tracked in the same loop that builds `r20to30`/`gt30m`
- `agentMap[name].phoneRecordings` — `{phone: [{sec, recording, crmStatus}, ...]}`, one entry per qualifying call (≥1200 sec), populated alongside `phoneMaxSec`; `recording` comes from `r._recording` (parsed from `recording_location` column, see Key Columns table); `crmStatus` comes from `r._crmStatus` (the `CRM Status` column) on that call's row
- Threshold dropdown (`#longDealThreshold`, options 1200/1500/1800 sec) calls `setLongDealThreshold()`, which sets `window._longDealThresholdSec` and re-renders
- `renderLongNoDeal(rows)` is a top-level function (not nested in `buildDashboard`, since the dropdown must call it after initial render): for each agent it filters `phoneMaxSec` keys ≥ the current threshold, then subtracts the agent's enrolled phones (`agentEnrollPhones[name.toLowerCase()]`) to get `longNoConvert`; it also builds `longNoConvertRecords` (one entry per qualifying recording, from `phoneRecordings` filtered by the same threshold) for the modal
- Called with no args, it defaults to `window._agentAllRows` — only reflects the full unfiltered agent set; campaign/direction-filtered views of the Agent Performance table do not recompute this card
- Card table (`longNoDealCard`/`longNoDealBody`, header `longNoDealHead`): Agent | Long Calls | Converted | Conv% | Not Converted — sorted by Not Converted descending by default, only agents with `longNoConvert.length>0` shown. Conv% = `pct(converted, a.total)` (converted long calls ÷ total long calls, e.g. 1 converted of 8 long calls = 12.5%). Agent name cell shows the same `tag-opener`/`tag-retention` role tag used elsewhere (Agent Performance, Funnel tables)
- Columns are click-to-sort (each `th` has `data-col`, mirrors the Agent/Campaign table sort pattern): click toggles asc/desc on that column, re-appending `tr`s in the new order; `sort-asc`/`sort-desc` CSS classes show the ▲/▼ arrow
- Clicking the Not Converted count opens the shared phone modal via `showFlaggedPhones(records, agentName+' — Long Calls, No Deal')` (mirrors `showEnrolledPhones`, same modal DOM; the modal title is just `label + ' (' + uniquePhones + ')'` — callers must include their own descriptive suffix). Each row shows the phone, call duration, an inline `<audio controls>` player sourced from `recording.recording`, and a "⬇ Download recording" link (`download` attribute on an `<a href="...">`). Phones with no recording show "No recording available" instead of a player.
- `#enrollModalBox` max-width bumped to 560px (`width:90vw` for narrower viewports) and the `<audio>` element height bumped to 44px so the seek bar is easier to click/drag precisely (shared modal, so this also affects the Enrolled Phones / Transfers popups, harmlessly)
- **CRM Status badge next to phone number**: every record type shown in the shared `showFlaggedPhones` modal (Long Calls No Deal, DPC, Incomplete Transfers, Transfers Received, Opener Transfer Breakdown) now carries a `crmStatus` field alongside `phone`/`sec`/`recording`, sourced from `r._crmStatus` (or `ev.crmStatus`/`next.crmStatus` when threaded through an intermediate event object). Rendered as a small pill next to the phone number in the modal row; hidden when empty
- **Export CSV** button (`⬇ CSV` next to the threshold dropdown) calls `exportLongNoDeal()`, which flattens `window._longNoDealFlagged[].longNoConvertRecords` (set at the end of every `renderLongNoDeal()` run) into `Agent,Phone Number,CRM Status,Call Duration,Recording Location` rows and downloads `long_calls_no_deal.csv` — one row per qualifying call (a phone can appear more than once if it has multiple calls over the threshold); `Call Duration` is `fmtDur(sec)`; reflects whatever threshold is currently selected

## Agent Call Funnel Table

- Columns show % of agent's total calls in each time bracket
- **Sorting sorts by raw count (the number in parentheses), not percentage**
- Filterable by role (All / Closers / Openers) and campaign/direction dropdowns

## Agent Outcomes (scatter chart, replaces the old "Agent Funnel Visual")

Card `#funnelChartCard`, directly below the Agent Call Funnel table in both `Ytel_Daily_Monitor_ADP.html` and `Ytel_Daily_Monitor_v2.html`. Previously a stacked-bar-per-agent + canned per-agent "coaching" text card; replaced because the bars duplicated the table above with no new information, every bar rendered at 100% width so nothing stood out, the coaching thresholds were hardcoded and judged openers by closer standards, and it ignored enrollment outcomes entirely (a long-talking agent with zero deals looked good).

- Chart.js `type:'bubble'`. One dot per agent: **X = % of that agent's calls over 5 min** (`over5 = r5to10+r10to15+r15to20+r20to30+gt30m`, i.e. `sec>=300`), **Y = conversion % on those calls** (`enr/over5`, clamped to 100 — `enr` is the agent's total enrolled-phone credit, not restricted to the over-5-min calls, so this is an approximation consistent with the `Conv% (enr/>2m)` convention used elsewhere in the app), **dot radius = call volume** (sqrt-scaled between 6px and 26px across the currently-filtered agent set)
- Dot color = role, from the same `CLOSERS`/`RETENTION`/`OPENERS` sets used everywhere else: closer `#1377bd`, opener `#D97706`, retention `#7C3AED`, unassigned `#94A3B8` — same 4-color mapping hardcoded in both files (not read from CSS custom properties, so it stays identical regardless of which file's `--blue`/`--accent` token means something else)
- **Quadrant divider lines** are drawn by an inline Chart.js plugin (`beforeDatasetsDraw`) at the **median** X and median Y of the currently-plotted agents (not a hardcoded threshold) — solid hairline `#E2E8F0`, never dashed. Four corner labels are fixed chart chrome (not generated per-agent text): top-right "Top performers", top-left "Efficient closers", bottom-right "Long calls, no deals — pull recordings", bottom-left "Can't engage"
- Reuses the existing filter row (`fc-all`/`fc-closer`/`fc-opener` role toggle, `fc-camp`, `fc-dir`, `fc-name` search, `fc-min` min-calls threshold) via the existing `filterFunnelChart()` → `renderFunnelChart(rows)` pipeline; the `fc-sort` dropdown was removed (sorting has no meaning for a scatter — there's no row order)
- `renderFunnelChart(rows)` destroys and recreates `window._funnelScatterChart` on every call (role/campaign/direction/name/min-calls filter changes all re-render); card hides when no agent clears the min-calls threshold
- Tooltip shows agent name, "% of calls over 5 min (over5/calls)", "% conversion on those (N enrolled)", total calls
- No separate table view was added for this card — the Agent Call Funnel table immediately above already serves as the tabular twin of the same underlying per-agent data

## Openers — Transfer Breakdown by Campaign

Card is only visible when opener calls exist. Features:
- Time brackets: Dead ≤30s, 30s–2min, 2–5min, 5–10min, 10–15min, 15–20min, 20–30min, 30+min
- Each bracket cell shows: transfer count (clickable → phone/recording modal), enrolled count, total calls
- **Clicking a transfer count opens the shared `showFlaggedPhones` modal (same one used by DPC, Incomplete Transfers, Long Calls No Deal) with that bracket's transferred phone numbers** — each row has an inline `<audio controls>` player + "⬇ Download recording" link sourced from `r._recording` on the CLtrns call; phones with no recording show "No recording available"
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
- `recs_XtoY` — array of `{phone,sec,recording,crmStatus}` for each CLtrns call in the bracket (one entry per call, not deduped by phone), passed to `showFlaggedPhones` on click
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
| `recording_location` | URL/path to the call recording — used by the Long Calls, No Deal popup for inline playback + download |

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
