# Modern Look — Design

Date: 2026-11-16 · Status: owner delegated all visual decisions ("modern, polished product, not the default dull UI")

## Intent
The app should feel like a polished product a salesman is proud to open in front of customers, while staying fast and readable on a phone in a car. Today it uses browser defaults (system font, flat blue buttons, grey boxes), the header eats ~20% of the phone screen, two filter chips render blank, and map controls overflow a 375 px screen.

## Goals / non-goals / anti-goals
- Goals: one coherent visual system across all territory pages, Login, More, and the shell; existing Orders/Daily Reports inherit the base styles (no restructuring of those screens).
- Non-goals: dark mode; new features; changing data or behaviour; changing marker status colours.
- Anti-goals: anything that slows first load noticeably (no UI framework, no icon library); anything that needs the network to look right (fonts bundled, not Google Fonts CDN); touch targets under 44 px; text contrast below WCAG AA.

## Approach (builder's call, owner delegated)
CSS design tokens + a small set of shared component classes, applied by editing existing JSX classNames. Considered: a component library (MUI/Chakra — rejected: +100s of kB, fights existing CSS), Tailwind (rejected: rewrites every component's markup for a visual pass). Tokens keep the change local and reversible.

## Design system
- Font: Inter Variable via `@fontsource-variable/inter` (bundled, cached by the service worker). Arabic text falls back to the system Arabic font; set `font-family: 'Inter Variable', system-ui, 'Segoe UI', 'Noto Sans Arabic', sans-serif`. Tabular numbers for capacities/distances (`font-variant-numeric: tabular-nums`).
- Colour tokens on `:root` (light only):
  - `--brand-700 #0f5f58`, `--brand-600 #0f766e` (primary, teal — distinct from the customer-marker green), `--brand-50 #ecfdf8`
  - `--accent-500 #f59e0b` (amber highlights, used sparingly)
  - neutrals `--ink-900 #0f172a`, `--ink-700 #334155`, `--ink-500 #64748b`, `--line #e2e8f0`, `--surface #ffffff`, `--bg #f4f6f8`
  - status (unchanged semantics, match markers): customer `#1b7f3b`, prospect `#e08a00`, competitor `#c0392b`; location: ok green, verify amber, missing slate
  - feedback: success/warn/danger soft backgrounds + strong text
- Shape: radius `--r-sm 8px`, `--r-md 12px`, `--r-lg 16px`, pills 999px. Shadows: `--shadow-1` subtle card, `--shadow-2` floating (map controls, sheets, bottom bar).
- Spacing scale 4/8/12/16/24/32; 16 px page gutter.
- Type scale: page title 22/28 semibold, section 17/24 semibold, body 15/22, meta 13/18 ink-500, KPI numbers 28/32 semibold tabular.

## Components
- App bar (mobile): 56 px, sticky, white with bottom hairline; left: small logo mark (inline SVG — a simple stylised hen/egg or map-pin+egg) + "Tracking Orders" at 17 px; right: backup status as a compact icon chip (amber dot + "Backup" when overdue, hidden when fresh). Language select moves out of the mobile header (it already lives in More). Desktop keeps the top nav, restyled as pill links.
- Bottom nav: white, `--shadow-2`, safe-area aware; active tab gets a brand-50 pill behind the icon and brand-600 icon/label.
- Buttons: primary (brand-600 fill, white text, 44 px min height, r-md), secondary (white, line border), ghost (text only), danger (red). Visible focus ring `0 0 0 3px` brand at 35%.
- Inputs/selects: 44 px, r-md, line border, brand focus ring; search fields with a leading magnifier icon (inline SVG).
- Chips (filters, radii, statuses): pill, outline when off, brand-50 fill + brand-700 text when on (`aria-pressed`). Fix the blank chips (labels must render).
- Cards: white, r-lg, shadow-1, 16 px padding.
- List rows (farms, customers, nearby results): card-style rows with a 4 px left status stripe in the status colour, name (dir="auto", semibold), meta line, right-aligned tabular capacity, location badge pill.
- Badges: soft-tinted pills (Located / Verify location / Location missing; Customer / Prospect / Competitor).
- Empty states: centred inline-SVG illustration-style icon, one-line title, helper text, primary action where useful.
- Bottom sheet (farm sheet, filter panel): r-lg top corners, drag-handle bar, shadow-2.

## Screens
- Map: full-bleed under the app bar; floating search pill (full width minus gutters) with a filter icon button inside it; layer toggle as a small segmented control card top-right below the search; zoom + "my location" as round floating buttons bottom-right above the bottom bar; "N without location" as a floating amber pill bottom-left. Nothing may overflow 375 px.
- Farms / Customers: title row with primary "Add" button; search with icon; chips row horizontally scrollable; result count as meta text; card rows.
- Farm detail / Customer profile: hero card (name, status badge, capacity KPI, location badge), action row of icon buttons (Nearby, Directions, Google Maps, Edit), sections as cards.
- Nearby: origin card at top; radius segmented chips; results as card rows with distance as the prominent number ("2.8 km" + "straight-line" meta) and a Directions icon button.
- Dashboard: KPI tiles with a small icon in a tinted circle, big tabular number, meta line; "Needs location" tile amber-tinted when > 0; backup tile amber when overdue; charts and top lists in cards; bar colour brand-600.
- Data (Import/Export): each section a card with an icon header; wizard step indicator as a progress bar with "Step n of 6".
- Login: centred card on a soft brand gradient background, logo mark, primary button full width.
- More: grouped list card with icons and chevrons; language as a segmented control.

## Left to the builder
Exact icon drawings, minor spacing, the logo mark's form, how CSS is split between `styles.css` and `territory.css` (prefer tokens + base in `styles.css`, components in `territory.css`).

## Acceptance
- Visual check in Chrome at 375×760 and 1280×800 on: Map, Farms, Farm detail, Customers, Customer profile, Nearby (with origin), Dashboard (with seed data), Data, More, Login. No horizontal overflow, no blank controls, no raw i18n keys, French fits.
- `npm test` green; `npm run build` main chunk grows by no more than ~40 kB (font files are separate assets).
- Lighthouse mobile accessibility ≥ 90 on Map and Farms.
