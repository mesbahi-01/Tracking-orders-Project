# Farm Territory Mapping — Design

Date: 2026-11-16
Status: Approved 2026-11-16

## 1. Intent

A friend of the owner sells poussins (day-old chicks) commercially in northern Morocco (first data set: around Had Gharbia / Asilah). He visits customers and their farms by car. He needs, on his phone, while travelling:

- every farm on a real map at its true position, with who owns it and how many poussins it holds;
- "what other farms are near this one / near me right now?" — to plan visits and find new business near places he already goes;
- one place where customers, their farms, and the existing orders and daily reports live together.

This extends the existing Tracking-orders PWA (`https://mesbahi-01.github.io/Tracking-orders-Project/`). It does not replace it.

Success: he can open the app at a farm, see every customer and prospect farm within 10 km sorted by distance, tap one, and get directions — with positions he trusts.

## 2. Goals, non-goals, anti-goals

Goals
- Interactive map (streets + satellite), clustered markers, search, filters.
- Nearby-farm detection from a selected farm or from current GPS, radius 5/10/20/30/50 km.
- Customer profiles with one-to-many farms; farms can also be prospects or competitor's customers with no customer profile.
- Dashboard + reports (counts, capacity totals/averages, by region, top farms, top customers).
- Excel/CSV import with column mapping and duplicate detection; Excel export of filtered data; full-backup export and restore.
- Mobile-first UI; existing English/French translations extended.

Non-goals
- No server, no cloud database, no multi-user sync, no real authentication (existing fake login stays as is).
- No route optimisation / visit scheduling (directions are delegated to Google Maps).
- No resolving of `maps.app.goo.gl` short links inside the app (needs a server; see §6.3).
- No Arabic UI translation (Arabic farm names are data and must display correctly).

Anti-goals — the feature fails if any of these happen, even if it "works":
- A farm appears on the map, or in a distance result, at a position nobody supplied. **The app never invents or approximates coordinates.**
- A restore from backup loses or alters data.
- Existing orders or daily reports are lost or detached from their client during migration.
- One customer's farms get mixed into another customer's profile (e.g. by name collision). Same-name customers are allowed; attaching anything to an existing customer by name always asks first.

## 3. Constraints (from the existing project)

- React 18 + Vite 5 + react-router 6, static build deployed to GitHub Pages under base `/Tracking-orders-Project/` (`vite.config.js`, `src/main.jsx`).
- All data is on the device. Orders: IndexedDB `orders-db` v2, store `orders`, via `idb` (`src/db.js`). Orders reference the client **by name string** (`order.client`).
- Clients today: an array of name strings in `localStorage` key `clients_<username>` (`src/clients.js`). Daily reports: separate IndexedDB `tracking-orders-db` store `daily-reports` with localStorage fallback (`src/lib/dailyReportsStorage.js`); also reference client by name.
- Login just stores `{username,password}` in localStorage; client list is per username.
- i18n via i18next with `src/locales/en.json` and `fr.json`.
- Service worker `public/sw.js` caches app shell.
- The owner will keep backups by saving the exported Excel file (introduced by this feature — no earlier backup format exists) into a Google-Drive-synced folder; restoring on a new phone = open the site and upload that file.
- One user (the friend) on one phone. Data is not partitioned by login username.

## 4. Approaches considered

| | Map stack | Trade-offs |
|---|---|---|
| **A (chosen)** | Leaflet + OpenStreetMap street tiles + Esri World Imagery satellite tiles + `leaflet.markercluster`; search via OSM Nominatim | No API key / billing / expiry; light on mobile; viewed tiles can be cached for weak signal. Imagery in rural Morocco a bit less sharp than Google; place search finds villages, not farms. |
| B | Google Maps JS API | Best imagery and familiar search; needs Google Cloud billing account and a key exposed in a public site (domain-restricted); no tile caching allowed. |
| C | Mapbox GL | Polished; needs account + token; imagery similar to Esri. Combines A's limits with B's account burden. |

Picked **A** by the owner. Mitigation for imagery: every farm has "Open in Google Maps" (also gives turn-by-turn navigation). The map layer is isolated in one component so it can be swapped later.

## 5. Data model

All new stores live in the existing `orders-db`, bumped to **version 3** (one DB, one migration path, one backup). IDs are `crypto.randomUUID()` strings.

### customers
| field | type | notes |
|---|---|---|
| id | string | key |
| name | string | required; **not unique** — two different customers may share a name (owner's decision). Creating a customer whose normalised name already exists shows a warning listing the existing one(s) with phone/region, and asks for confirmation |
| phone, email | string | optional |
| region | string | free text with suggestions from existing values |
| address | string | optional |
| notes | string | optional |
| createdAt, updatedAt | ISO string | |

Indexes: `nameKey` (normalised name: trimmed, lower-cased, collapsed spaces; **non-unique**), `region`. Customers are always identified by `id`; everywhere a customer is picked (forms, filters, lists) same-name customers are shown with phone and region to tell them apart. Orders/daily reports created by name (existing datalist forms) attach to the customer only when exactly one customer has that name; otherwise the form asks which one.

### farms
| field | type | notes |
|---|---|---|
| id | string | key |
| name | string | required (e.g. `مزرعة الأمل`); unique per customer, case/space-insensitive |
| customerId | string \| null | required when `status = customer`; null allowed for prospect/competitor |
| ownerName | string | free text owner for prospects/competitor farms without a profile |
| status | `customer` \| `prospect` \| `competitor` | |
| lat, lng | number \| null | WGS84 decimal degrees; both null or both set; validated range |
| locationSource | `typed` \| `map` \| `gps` \| `import` \| null | |
| locationAccuracy | number \| null | metres, GPS only |
| locationStatus | `ok` \| `verify` \| `missing` | `missing` when no coords; `verify` set by import flag or manually |
| region | string | defaults to the customer's region |
| address | string | address or description (`douar`, road, landmark) |
| capacity | integer \| null | maximum poussins; null = unknown (excluded from sums/averages, shown as "—") |
| notes | string | |
| createdAt, updatedAt | ISO string | |

Indexes: `customerId`, `status`, `region`.

### orders (existing) and daily reports
Orders gain an optional `customerId`; `client` name string is kept and still displayed, so old code paths keep working. Daily reports keep their own DB and their `client` string and also gain an optional `customerId`. Renaming a customer updates `client` on its orders (existing behaviour of `updateClientInOrders`) and on daily reports. A customer cannot be deleted while it has orders **or daily reports** (builder's call).

### settings (small key/value store)
`lastBackupAt`, last used map layer, last nearby radius.

### Migration to v3
1. Read **every** `clients_*` key in localStorage (all usernames), plus distinct `order.client` and daily-report `client` names. Create one customer per distinct name (case/space-insensitive merge). Set `customerId` on matching orders and daily reports. (Builder's call: single user per phone, so merging all usernames loses nothing.)
2. Leave the localStorage key in place (harmless, acts as a safety copy) but stop reading it; `src/clients.js` becomes a thin wrapper over the customers store so `OrderForm`, `DailyReportsForm`, and the Clients page keep their datalist/name behaviour.
3. Migration is idempotent: running twice creates no duplicates.

## 6. Features

### 6.1 Navigation (mobile first)
Bottom tab bar on phones (≤ 768px), top nav on wider screens. Tabs: **Map**, **Farms**, **Customers**, **Nearby**, **More**. "More" holds Dashboard, Reports, Import/Export, Orders, Daily Reports, language, logout. Map is the landing page after login. (Orders and Daily Reports stay reachable; the user requested 7 sections plus the existing 3 don't fit in one phone bar.)

### 6.2 Interactive map
- Full-height map; layer toggle Streets / Satellite (Esri World Imagery with place labels overlay).
- Markers clustered; clusters split as you zoom in. Marker colour by status: customer, prospect, competitor. A small badge for `verify`.
- Tap marker → bottom sheet: farm name, customer/owner, status, capacity, region, address, notes, location source; actions: *Nearby*, *Edit*, *Open customer*, *Open in Google Maps*.
- Search box: matches farm name, customer/owner name, region, address (local data first); falls back to Nominatim place search to pan the map (never to place a farm).
- Filter panel: customer, status, region, capacity range, location status. Filters are shared with the Farms list and with export.
- "My location" button (permission prompt; denial handled gracefully).
- Farms with `missing` location are not drawn; a counter "N farms without location" links to the list.

### 6.3 Setting a farm's location
In the farm form, three ways, any of which can correct an existing position:
1. **Type** latitude / longitude. The field also accepts a pasted `lat, lng`, a DMS string like `34°27'12.9"N 5°34'12.9"W`, or a full `google.com/maps/...` URL (parsed from `@lat,lng`, `/place/lat,lng`, `!3d..!4d..`, or `q=lat,lng`). A short `maps.app.goo.gl` link is detected and the user is told to open it and copy the coordinates instead.
2. **Choose from the map** — full-screen picker, streets/satellite, tap to drop, drag to adjust, confirm. Opens centred on the current position, the customer's other farms, or the default region.
3. **Use my current location** — stores accuracy; warns if accuracy > 100 m.

Saving without coordinates is allowed and sets `locationStatus = missing`. Validation rejects out-of-range values and swapped lat/lng that land outside Morocco only as a *warning* (not a block), since farms elsewhere are possible.

### 6.4 Nearby farms
- Entry points: farm bottom sheet / farm page "Nearby", and Nearby tab with origin = selected farm or "My location".
- Radius chips 5 / 10 / 20 / 30 / 50 km; status filter (default all).
- Distance: haversine great-circle on WGS84, shown to 0.1 km, labelled "straight-line".
- Results list sorted by distance: farm name, customer/owner, status, distance, capacity; tap highlights it on the map. Map view shows origin, radius circle, and results.
- Farms with missing coordinates are excluded and the count is stated.
- Linear scan is fine for thousands of farms; a bounding-box prefilter before haversine keeps it fast.

### 6.5 Customers
List with search, region filter, sort by name / farms count / total capacity. Profile: contact, region, number of farms, total capacity (sum of known capacities, with "N unknown" if any), farm list, map of their farms, their orders. Create / edit / delete. Delete is blocked while the customer has orders (existing rule) and asks whether to delete their farms or convert them to prospects.

### 6.6 Farms
List (same filters as map) with name, customer, capacity, status, location status. Farm form for create/edit/delete. A "Needs location" view lists `missing` and `verify` farms.

### 6.7 Dashboard and reports
Dashboard tiles: customers, farms (by status), total capacity, average capacity per farm (known capacities only), farms needing location, last backup age. Reports: farms and capacity by region (table + bar chart), top 10 farms by capacity, top 10 customers by total capacity, prospect capacity near customers. Charts are simple hand-rolled SVG bars (no chart library) — adequate for these few views. Stats respect the current filters where shown.

### 6.8 Import, export, backup
Library: SheetJS (`xlsx`) for reading/writing `.xlsx`/`.csv`.

**Full backup export** — one workbook `farm-backup-YYYY-MM-DD.xlsx`, sheets `Customers`, `Farms`, `Orders`, `DailyReports`, `Meta` (app version, schema version, export time). Every stored field, IDs included. Sets `lastBackupAt`. Dashboard and app header show "Last backup: N days ago", amber after 7 days.

**Restore** — reads that workbook; shows counts; user chooses *Replace all* (default: wipe and load, preserving every id including numeric order ids) or *Add missing* (only inserts records whose id is not already present; never overwrites). Restore is for the same user's own backups (new phone, or recovering deleted records), not for combining two devices' data — so numeric order ids stay as they are (builder's call). Must round-trip exactly; covered by tests. Arabic text must survive both directions.

**Spreadsheet import (new data)** — for arbitrary sheets:
1. Pick file and sheet; preview first rows.
2. Map columns to fields (auto-guessed from header names in EN/FR/AR, e.g. "Client", "Nom ferme", "Capacité", "Latitude", "GPS", "Lien"). A single "coordinates/link" column is parsed with the §6.3 parser.
3. Rows are grouped by customer name (normalised) into one *incoming* customer with many farms. Rows in the same file with the same name are treated as one customer, unless a mapped phone column differs, in which case they become separate incoming customers.
4. **Customer matching — always asked, never silent:** for each incoming customer whose normalised name matches one or more existing customers, the user sees the existing candidate(s) (phone, region, farm count, farm names) and picks *this existing customer* or *new customer with the same name*. No farm is attached to an existing customer without this confirmation. (Owner's decision.)
5. Farm duplicate check: by normalised name within the chosen customer; plus *possible* duplicates = any two farms within 100 m of each other. Each conflict: skip / update existing / import as new.
6. Rows lacking valid coordinates import with `locationStatus = missing`. Rows can carry a "verify" flag column.
7. Summary: created / updated / skipped / missing location.

**Filtered export** — Farms list and Customers list export exactly what is filtered, to `.xlsx`, with human-readable columns (no internal ids except a reference column).

### 6.9 Seed / test data
The first customer's real data (8 farms: maps link, Arabic name, capacity, resolved coordinates) is kept locally in the git-ignored `Client's Farms/` folder (`seed-local.json`). The repository uses this synthetic stand-in with the same shape (names, coordinates and links are demo values):

| Farm | Short link | Lat | Lng | Capacity | Verify |
|---|---|---|---|---|---|
| مزرعة الأمل | maps.app.goo.gl/DEMOLINK0000000001 | 34.518505 | -5.622656 | 40000 | |
| مزرعة النور | maps.app.goo.gl/DEMOLINK0000000002 | 34.498872 | -5.602563 | 42000 | |
| مزرعة الواحة | maps.app.goo.gl/DEMOLINK0000000003 | 34.491295 | -5.610422 | 40000 | yes (pinned to place "Lieu Test") |
| مزرعة السلام | maps.app.goo.gl/DEMOLINK0000000004 | 34.453587 | -5.570246 | 32000 | |
| مزرعة الربيع | maps.app.goo.gl/DEMOLINK0000000005 | 34.558805 | -5.540653 | 32000 | |
| مزرعة الخير 1 | maps.app.goo.gl/DEMOLINK0000000006 | 34.575806 | -5.579404 | 22000 | |
| مزرعة الخير 2 | maps.app.goo.gl/DEMOLINK0000000007 | 34.568115 | -5.567138 | 10000 | yes (pinned to place "Lieu Test") |
| مزرعة الزيتون | maps.app.goo.gl/DEMOLINK0000000008 | 34.590505 | -5.535438 | 15000 | yes (pinned to place "Lieu Test") |

Customer: Client Démo, status customer, region Région Test. The three Verify farms keep their coordinates (that is what was shared) with `locationStatus = verify`, so they appear on the map with the verify badge until confirmed on satellite. A test file `Client's Farms/seed-farms.xlsx` is produced from this table with columns Client, Farm, Latitude, Longitude, Capacity, Maps link, Verify. Total capacity 233,000. No duplicates.

## 7. Offline behaviour
App shell and data work offline (as today). Map tiles already viewed are cached by the service worker (cache-first, capped ~2,000 tiles, LRU-ish by cache trimming). No bulk prefetch (OSM tile policy). Nominatim search needs network and says so.

## 8. Technology
- Add: `leaflet`, `react-leaflet` (v4, React 18 compatible), `leaflet.markercluster`, `xlsx` (SheetJS, from its official CDN tarball as SheetJS recommends), `vitest` for unit tests.
- Pure logic modules with unit tests: coordinate parser, haversine + nearby filter, import mapping/grouping/duplicate detection, backup round-trip (serialise → parse → equal), migration.
- Tile attribution displayed as required by OSM and Esri.

## 9. Implementation stages
1. Data layer: DB v3, customers/farms stores, migration, `clients.js` wrapper; tests.
2. Navigation shell + Farms and Customers pages + farm form with the three location methods.
3. Map page: tiles, layers, clustering, bottom sheet, filters, search.
4. Nearby farms.
5. Import (mapping, duplicates), filtered export, full backup/restore; seed Excel file.
6. Dashboard and reports.
7. Offline tile cache, translations (EN/FR), polish, deploy.

Each stage is usable and deployable on its own.

## 10. Left to the builder
Exact visual styling (consistent with existing `styles.css`), component breakdown, file layout under `src/`, marker icon design, chart styling.
