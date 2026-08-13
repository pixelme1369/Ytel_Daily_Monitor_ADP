# Design System — Ytel VS CRM

## Product Context
- **What this is:** An internal call-center operations dashboard suite for a debt-settlement business — daily reports on agent performance, compliance (DNC), enrollment/conversion, and campaign attribution.
- **Who it's for:** Call-center managers and team leads, non-technical, checking status every morning and pulling coaching/compliance detail throughout the day. Not a public-facing or sold product.
- **Space/industry:** Internal B2B ops/BI tooling — closest peers are Grafana, Datadog, Linear, Retool, not consumer or marketing products.
- **Project type:** Internal dashboard (`Ytel_Daily_Monitor_v2.html`).
- **The one thing to remember:** *"I know in 5 seconds if today's okay."* Every choice below exists to answer that faster — nothing else.

## Section Consolidation (information architecture, not just visuals)

Nine existing cards collapse into three tabbed/accordion cards — **no data, metric, recording link, or CSV export removed**, only the grouping:

| Today | Proposed |
|---|---|
| Missed Callbacks · DPC Drops · Incomplete Transfers | One "Follow-up Failures" card, 3 tabs |
| Top 5 Numbers · VDCL Analysis · Drops & Timeouts by Hour | One "Diagnostics" accordion |

~~Agent Call Funnel · Agent Outcomes scatter · Agent Performance table's own bracket columns → one tabbed card~~ — resolved a different way (August 2026): Agent Outcomes was removed outright rather than merged, per user request. Agent Call Funnel stands alone now; no consolidation needed there.

Correct Transfers Received stays folded into the Agent Management Board (already consolidated in a prior pass — good precedent this works).

**Navigation reorder** — sidebar and page order follow the actual morning ritual instead of today's mostly-arbitrary order:
1. **Triage** — Overview, Diagnostics
2. **Compliance** — Follow-up Failures, Unassigned Agents
3. **Coaching** — Agent Performance, Agent Report Cards
4. **Campaign Spend** — Campaign Breakdown, Openers

The very first thing visible after Run Analysis is a genuinely minimal view: the 4-tile headline KPI band + Issues Detected, nothing else, before any table.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, data-dense, restrained.
- **Decoration level:** Minimal, with one intentional touch (severity-tinted rows, see Color).
- **Mood:** A control panel a manager scans in 5 seconds, not a product being sold to them.
- **Reference sites:** [Grafana Play](https://play.grafana.org) (dense monitoring, dark-first, subtle alert threshold lines), [shadcn/ui dashboard example](https://ui.shadcn.com/examples/dashboard) (KPI-card + tabbed-table pattern, restrained color, trend badges).
- **Research synthesis:** 2026 dashboard-design consensus centers on progressive disclosure (show the minimum, reveal on demand — already partly implemented via the Compact/Full table toggle and KPI-grid tiering shipped this session) and an inverted-pyramid KPI hierarchy (most critical metric read first). The departure from convention here: most B2B dashboard advice assumes ad-hoc exploration and recommends capping visuals at 6-8. This product is not explored — it's a fixed daily ritual for one role. The fix isn't fewer views, it's information architecture ordered to that ritual, which is why the sidebar reorder above is the single highest-value change in this system, not the color/type work.

## Typography
- **Display/Heading:** Geist SemiBold/Bold — KPI values, section titles, nav labels.
- **Body:** Geist Regular/Medium — table cells, descriptions, form labels.
- **Data/Tables:** Geist Regular with `font-variant-numeric: tabular-nums` — every numeric column.
- **Code/Utility:** Geist Mono — phone numbers, campaign IDs, timestamps, debt amounts.
- **Loading:** Self-host `Geist` + `Geist Mono` (WOFF2, weights 400/500/600/700 for Geist, 400/500 for Geist Mono) — available via the `geist` npm package or [vercel/geist-font](https://github.com/vercel/geist-font) on GitHub. Do not load from a third-party font CDN.
- **Why one family, three roles:** Today's font is Inter — the unconfigured default. Geist was built by Vercel specifically for dashboards (real tabular figures, a weight range wide enough to carry hierarchy alone) and ships a matching monospace, so this is one coherent system instead of importing a second typeface just to hit a checkbox.
- **Scale:** Display 44/700, H2 22/600, H3 16/600, Body 14/400, Small/label 11-12/500-600 (uppercase, `letter-spacing: .06em-.1em` for labels).

## Color
- **Approach:** Balanced — semantic colors carry all the meaning, one accent hue, no decorative color.
- **Primary/Accent:** `#6366F1` (indigo) — nav highlight, primary actions, brand.
- **Semantic — unchanged from the current app, kept exactly as-is:**
  - Success `#10B981` — enrolled, good status, positive deltas
  - Danger `#EF4444` — compliance violations, critical alerts
  - Warning `#F59E0B` — drop rate, threshold breaches
- **Neutrals:** Sidebar/dark surface `#0F172A`, page background `#F8FAFC`, card surface `#FFFFFF`.
- **New addition — severity tint:** Issues Detected rows and the most urgent KPI tiles get a subtle full-background tint derived from the semantic color (e.g. `#FEF2F2` for critical, `#FFFBEB` for warning), not just today's colored left-border stripe — so trouble registers in peripheral vision, not just on close reading.
- **Dark mode:** Not adopted as the product default (see Safe/Risk below) — held back as a documented option, not shipped.
- **Why the semantics didn't change:** Managers already read red/amber/green/indigo without thinking. Changing the mapping would cost speed, which is the entire thesis of this system — this is the one place convention beats novelty outright.

## Spacing
- **Base unit:** 4px.
- **Density:** Compact — table rows tighten from today's ~44px+ toward 36-40px (current convention for dense ops views), trading a little breathing room for more rows visible without scrolling.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** Grid-disciplined — the existing card/sidebar skeleton is proven and unchanged; the IA reorder above is a *content* change, not a layout-system change.
- **Grid:** Sidebar 220px fixed + fluid main content, same as today. KPI headline tier: `repeat(auto-fit, minmax(200px,1fr))`. Secondary KPI grid: `repeat(auto-fit, minmax(150px,1fr))` (both already shipped this session).
- **Max content width:** None currently enforced — dashboard fills available width, appropriate for a data-dense internal tool.
- **Border radius:** sm 6px (pills, badges), md 8px (buttons, inputs), lg 12px (cards) — matches current values.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension (today's hover/collapse CSS transitions are already correct for this thesis; no new animation budget).
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 100ms (hover), short 150-200ms (collapse/expand).

## Safe vs. Risk

**Safe — kept exactly as-is:**
- Light-mode-first, card-based, rounded corners — matches the non-technical audience and the existing PDF report export (a dark theme prints badly)
- Red/amber/green/indigo semantics — unchanged
- Sidebar + collapsible-card navigation skeleton — the mechanism works, only the content order changes

**Risk — deliberate departures, adopted:**
1. Retiring Inter for Geist
2. Workflow-choreographed navigation order (the biggest lift, and the one that most directly serves the 5-second thesis)
3. Severity tint, not just a stripe, on the most urgent rows/tiles

**Considered, not adopted** (documented for later — see conversation log if revisited):
- Dark-first default (held back: PDF export + non-technical audience)
- Sidebar replaced with a command-bar (held back: bigger nav-paradigm change than warranted right now)
- A 4th visual pattern (inverted/pulsing) for the single worst alert (held back: adds a pattern beyond the current 3-color language)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-13 | Initial design system created | Built by `/design-consultation` after a live design-review pass that already shipped the Compact/Full table toggle, KPI-grid tiering, and sticky Agent Performance headers/column — this system extends that same "progressive disclosure, speed-first" thread into typography, color, and information architecture. |
| 2026-08-13 | AI-rendered mockups not generated | `gstack design` mockup generation requires an OpenAI API key with organization verification; blocked at generation time. The written/HTML preview stands in as the Phase 5 artifact. Revisit if verification completes and photo-real mockups are wanted. |
