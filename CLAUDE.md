# CLAUDE.md

## Project

Single-file HTML call center dashboard: `Ytel_Daily_Monitor_ADP.html`
No framework, no build step — vanilla JS + SheetJS 0.18.5 + Chart.js 4.4.0 via CDN.

## Rules

- Read existing files before editing.
- Make the minimum necessary change.
- Do not rewrite entire files unless requested.
- Preserve existing styling and layout.
- Do not remove features unless asked.
- Keep explanations under 5 sentences.
- Ask before changing business logic.
- Run JS syntax check after edits: `node -e "const fs=require('fs');const h=fs.readFileSync('Ytel_Daily_Monitor_ADP.html','utf8');const s=h.match(/<script>([\s\S]*?)<\/script>/g);s.forEach((b,i)=>{try{new Function(b.replace(/<\/?script>/g,''));console.log('OK',i);}catch(e){console.log('ERR',i,e.message);}});"`
- Always push to branch `claude/practical-ramanujan-for1xy` on `pixelme1369/dialer-monitor_CRM_Ytel`, then merge to `main` when asked.

## Agent Roles

```js
const CLOSERS = new Set([...]);   // closers — no Opener tag, no >2min % display
const RETENTION = new Set([...]);  // retention agents
const OPENERS = new Set([...]);    // openers — show Opener tag, show >2min % in color
```

Agents not in any set show no role tag.

## Enrollment Logic

- One enrollment per unique phone number per day
- `Cordoba Enrolled Date` must match the analysis date
- Credit goes to the agent named in **`Assigned To`** column (if populated)
- Fallback: agent with the latest call timestamp to that phone on that day
- Debt comes from `Enrolled Debt` column on the enrolled row

## Hourly Breakdown Logic

- **Unique #s per hour** — phone counted in the hour of its **first call of the day**
- **Enrolled per hour** — credited to the hour of the agent's **last call to that enrolled phone**

## Missed Callbacks Logic

- Tracks inbound `TIMEOT` calls and checks for any follow-up call (inbound OR outbound, non-TIMEOT) after the last timeout
- Phone is only flagged if **zero follow-up activity** occurred after the timeout
- Split into: Enrolled Clients (have `Cordoba Enrolled Date`) vs Other Calls
- Filterable by campaign dropdown

## Key Columns Expected in XLSX

| Column | Notes |
|--------|-------|
| `call_date` | datetime, SheetJS reads as Date object with `cellDates:true` |
| `phone_number` / `phone_number_dialed` | phone number |
| `length_in_sec` | duration in seconds |
| `status` | dispo code (SALE, DNC, DROP, TIMEOT, CC, etc.) |
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

- Development branch: `claude/practical-ramanujan-for1xy`
- Merge to `main` when user asks to ship
- No CI, no build — just open the HTML file in Chrome
