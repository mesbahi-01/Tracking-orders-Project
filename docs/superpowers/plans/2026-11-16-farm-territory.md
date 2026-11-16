# Farm Territory Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customers with multiple farms, an interactive farm map, nearby-farm search, dashboard/reports, and Excel import/export/backup to the existing Tracking-orders PWA.

**Architecture:** Everything stays client-side. Customers, farms and settings become new stores in the existing IndexedDB `orders-db` (v3). Pure logic (coordinates, distance, filters, stats, import, backup) lives in `src/territory/*.js` with Vitest unit tests; React pages/components consume it. Map is Leaflet via react-leaflet with OSM street and Esri satellite tiles.

**Tech Stack:** React 18, Vite 5, react-router 6, idb 7, i18next (en/fr), leaflet 1.9.4, react-leaflet 4.2.1, leaflet.markercluster 1.5.3, SheetJS xlsx 0.20.3, Vitest 2 + jsdom + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-11-16-farm-territory-design.md`

## Global Constraints

- Never invent, approximate or default coordinates. A farm with no supplied coordinates has `lat = lng = null`, `locationStatus = 'missing'`, is not drawn and is excluded from distances.
- `lat`/`lng` are both null or both numbers; lat ∈ [-90, 90], lng ∈ [-180, 180].
- Farm `status` ∈ `customer | prospect | competitor`; `customerId` required iff status is `customer`.
- `locationStatus` ∈ `ok | verify | missing`; `locationSource` ∈ `typed | map | gps | import | null`.
- Customer names are NOT unique. Attaching anything to an existing customer by name asks the user when ≥1 match exists in import, and when >1 match exists in the order/report forms.
- Unknown capacity is `null`, shown as `—`, excluded from sums and averages.
- Nearby radii exactly `[5, 10, 20, 30, 50]` km; distance haversine, earth radius 6371.0088 km, displayed to 0.1 km, labelled straight-line.
- Possible-duplicate farm distance threshold: 100 m. GPS accuracy warning threshold: 100 m. Backup-age warning after 7 days.
- Backup workbook: sheets `Customers`, `Farms`, `Orders`, `DailyReports`, `Meta`; filename `farm-backup-YYYY-MM-DD.xlsx`; `Meta.schemaVersion = 3`.
- Every user-visible string goes through i18next with keys present in both `src/locales/en.json` and `fr.json`.
- Deployed under base `/Tracking-orders-Project/`; no API keys; no server.
- Tile attribution shown: "© OpenStreetMap contributors" (streets), "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" (satellite).
- Existing orders and daily reports must keep working and keep their `client` name string.

## Review Focus

1. Coordinates and numbers typed in French/Moroccan locale Excel use a comma decimal (`34,518505`) and capacities like `40 000`, `40.000` or `40000 poussins` should be read as 34.518505 and 40000, not rejected or misread. Tests in Task 1.
2. Arabic names typed slightly differently (`مزرعة الزيتون` vs `مزرعة  الزيتون`, `أ` vs `ا`, tatweel `ـ`, Arabic-Indic digits `مزرعة الخير ١`) should be recognised as the same name by duplicate checks and search. Tests in Task 1.
3. A backup containing nulls (missing location, unknown capacity, empty phone) should restore with nulls, not `0`, `""` or `"null"`; Arabic text must be byte-identical. Tests in Task 10.
4. Location permission denied, GPS timeout, or no geolocation support should show a message and leave the form/nearby page usable. Tests in Task 1 (wrapper) and manual check in Tasks 7 and 9.
5. A spreadsheet with the same customer name on rows meant for two people (different phone numbers) should produce two incoming customers, not one merged profile. Test in Task 11.

---

## File Structure

```
src/territory/
  normalize.js        normalizeName, parseNumberLoose, parseCapacity
  geo.js              parseCoordinates, haversineKm, isInMorocco, findNearby, RADII_KM, mapsLinks
  geolocation.js      getCurrentPosition wrapper
  store.js            customers / farms / settings CRUD over orders-db v3
  migrate.js          runMigrationV3
  customerLink.js     name → customer resolution for orders/reports, rename, delete guards
  filters.js          applyFarmFilters
  stats.js            computeStats, prospectsNearCustomers
  xlsxIO.js           SheetJS read/write helpers
  backup.js           buildBackup, parseBackup, restoreBackup
  importer.js         guessMapping, rowsToIncoming, matchCustomers, findFarmConflicts, applyImport
  exporter.js         farmsWorkbook, customersWorkbook
  useTerritory.js     React hook: loads customers+farms, exposes reload
  *.test.js           unit tests next to each module
src/components/territory/
  BottomNav.jsx, CustomerPicker.jsx, LocationInput.jsx, MapPicker.jsx,
  FarmMap.jsx, ClusterLayer.jsx, FarmSheet.jsx, FilterPanel.jsx, BarChart.jsx,
  ImportWizard.jsx, FarmForm.jsx, CustomerForm.jsx
src/pages/
  MapPage.jsx, FarmsPage.jsx, FarmDetailPage.jsx, CustomersPage.jsx (replaces Clients.jsx),
  CustomerProfilePage.jsx, NearbyPage.jsx, DashboardPage.jsx, ReportsPage.jsx,
  DataPage.jsx, MorePage.jsx
src/territory.css
scripts/make-seed-xlsx.mjs
Client's Farms/seed-farms.xlsx   (generated)
```

Modified: `package.json`, `vite.config.js`, `src/db.js`, `src/clients.js`, `src/App.jsx`, `src/components/Layout.jsx`, `src/components/OrderForm.jsx`, `src/components/DailyReportsForm.jsx`, `src/pages/DailyReportsPage.jsx`, `src/locales/en.json`, `src/locales/fr.json`, `public/sw.js`. Deleted: `src/pages/Clients.jsx`.

---

### Task 1: Test tooling, normalisation, coordinates and distance

**Files:**
- Modify: `package.json`, `vite.config.js`
- Create: `src/territory/normalize.js`, `src/territory/geo.js`, `src/territory/geolocation.js`, `src/test/setup.js`
- Test: `src/territory/normalize.test.js`, `src/territory/geo.test.js`, `src/territory/geolocation.test.js`

**Interfaces:**
- Produces:
  - `normalizeName(s: string): string`: trim, collapse whitespace, lowercase, remove tatweel `ـ` and Arabic diacritics U+064B–U+0652, fold `أ إ آ ٱ`→`ا` and `ى`→`ي`, Arabic-Indic digits `٠-٩`→`0-9`. `null`/`undefined` → `''`.
  - `parseNumberLoose(v: unknown): number | null`: numbers pass through; strings trimmed, one comma decimal → dot; anything else null.
  - `parseCapacity(v: unknown): number | null`: strips spaces, thousands `.`/`,`/NBSP and trailing words; non-negative integer or null.
  - `parseCoordinates(input: string): {lat:number,lng:number} | {error:'empty'|'short-link'|'unrecognized'|'out-of-range'}`
  - `haversineKm(a:{lat,lng}, b:{lat,lng}): number`
  - `isInMorocco({lat,lng}): boolean`: bbox lat 20.7..35.95, lng -17.2..-0.95.
  - `RADII_KM = [5,10,20,30,50]`
  - `findNearby(origin:{lat,lng}, farms:Farm[], radiusKm:number, opts?:{excludeId?:string, statuses?:string[]}): {results: Array<{farm:Farm, distanceKm:number}>, missingCount:number}`, sorted ascending; bounding-box prefilter then haversine.
  - `mapsLinks({lat,lng}): {view:string, directions:string}`: `https://www.google.com/maps/search/?api=1&query=LAT,LNG` and `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`.
  - `getCurrentPosition(opts?:{timeoutMs?:number}): Promise<{lat,lng,accuracy} | {error:'denied'|'unavailable'|'timeout'|'unsupported'}>`, default timeout 15000, `enableHighAccuracy: true`. Never rejects.

- [ ] **Step 1: Install dev tooling and dependencies**

```bash
npm i leaflet@1.9.4 react-leaflet@4.2.1 leaflet.markercluster@1.5.3 https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm i -D vitest@2.1.9 jsdom@25.0.1 fake-indexeddb@6.0.0
```

Add script `"test": "vitest run"` to `package.json`. Add to `vite.config.js`: `test: { environment: 'jsdom', setupFiles: ['src/test/setup.js'] }`. `src/test/setup.js` contains `import 'fake-indexeddb/auto'`.

- [ ] **Step 2: Write failing tests**

```js
// normalize.test.js
expect(normalizeName('  مزرعة   الزيتون ')).toBe(normalizeName('مزرعة الزيتون'))
expect(normalizeName('أحمد')).toBe(normalizeName('احمد'))
expect(normalizeName('مزرعة الـــنور')).toBe(normalizeName('مزرعة النور'))
expect(normalizeName('مزرعة الخير ١')).toBe('مزرعة الخير 1')
expect(normalizeName('Client  DÉMO')).toBe('client démo')
expect(parseNumberLoose('34,518505')).toBe(34.518505)
expect(parseNumberLoose(' -5.622656 ')).toBe(-5.622656)
expect(parseNumberLoose('abc')).toBeNull()
for (const v of ['40000', '40 000', '40.000', '40,000', '40000 poussins', 40000, '40 000'])
  expect(parseCapacity(v)).toBe(40000)
expect(parseCapacity('')).toBeNull(); expect(parseCapacity('-5')).toBeNull()

// geo.test.js
expect(parseCoordinates('34.518505, -5.622656')).toEqual({ lat: 34.518505, lng: -5.622656 })
expect(parseCoordinates('34,518505 ; -5,622656')).toEqual({ lat: 34.518505, lng: -5.622656 })
const dms = parseCoordinates(`34°27'12.9"N 5°34'12.9"W`)
expect(dms.lat).toBeCloseTo(34.453583, 5); expect(dms.lng).toBeCloseTo(-5.570250, 5)
expect(parseCoordinates('https://www.google.com/maps/place/34.498872,-5.602563/data=!4m6')).toEqual({ lat: 34.498872, lng: -5.602563 })
expect(parseCoordinates('https://www.google.com/maps/place/Lieu+Test/data=!4m6!3m5!1s0x0!7e2!8m2!3d34.4912945!4d-5.6104224')).toEqual({ lat: 34.4912945, lng: -5.6104224 })
expect(parseCoordinates('https://www.google.com/maps/@34.57,-5.57,15z')).toEqual({ lat: 34.57, lng: -5.57 })
expect(parseCoordinates('https://maps.google.com/?q=35.1,-5.2')).toEqual({ lat: 35.1, lng: -5.2 })
expect(parseCoordinates('https://maps.app.goo.gl/DEMOLINK0000000001')).toEqual({ error: 'short-link' })
expect(parseCoordinates('')).toEqual({ error: 'empty' })
expect(parseCoordinates('95, 10')).toEqual({ error: 'out-of-range' })
expect(parseCoordinates('hello')).toEqual({ error: 'unrecognized' })
// ain msbah -> l7oumar known distance
expect(haversineKm({lat:34.518505,lng:-5.622656},{lat:34.498872,lng:-5.602563})).toBeCloseTo(2.856, 2)
expect(isInMorocco({lat:34.52,lng:-5.62})).toBe(true)
expect(isInMorocco({lat:-5.62,lng:34.52})).toBe(false)
// findNearby: missing excluded and counted, origin excluded, sorted, radius inclusive
const farms = [
  {id:'o',lat:34.518505,lng:-5.622656,status:'customer'},
  {id:'a',lat:34.498872,lng:-5.602563,status:'customer'},
  {id:'b',lat:34.590505,lng:-5.535438,status:'prospect'},
  {id:'m',lat:null,lng:null,status:'customer'},
]
const r = findNearby({lat:34.518505,lng:-5.622656}, farms, 5, {excludeId:'o'})
expect(r.results.map(x=>x.farm.id)).toEqual(['a']); expect(r.missingCount).toBe(1)
expect(findNearby({lat:34.518505,lng:-5.622656}, farms, 20, {excludeId:'o'}).results.map(x=>x.farm.id)).toEqual(['a','b'])
expect(findNearby({lat:34.518505,lng:-5.622656}, farms, 20, {excludeId:'o', statuses:['prospect']}).results.map(x=>x.farm.id)).toEqual(['b'])

// geolocation.test.js — stub navigator.geolocation.getCurrentPosition
// success → {lat,lng,accuracy}; error code 1 → {error:'denied'}; code 2 → 'unavailable'; code 3 → 'timeout'
// navigator.geolocation undefined → {error:'unsupported'}
```

- [ ] **Step 3: Run tests, expect FAIL** — `npm test` → failures "Failed to resolve import ./normalize.js" etc.

- [ ] **Step 4: Implement the three modules** per Interfaces. `parseCoordinates` tries in order: short-link host `maps.app.goo.gl`/`goo.gl` → `!3d..!4d..` → `/place/LAT,LNG` → `@LAT,LNG` → `q=`/`query=`/`ll=` → DMS pair → two loose decimals separated by `,` `;` or whitespace (when comma-decimal is used, separator must be `;` or whitespace).

- [ ] **Step 5: Run tests, expect PASS** — `npm test` → all green.

- [ ] **Step 6: Commit** — `git commit -m "feat(territory): coordinate parsing, distance and test tooling"`

---

### Task 2: Database v3 and the territory store

**Files:**
- Modify: `src/db.js` (export `getDB`, `VERSION = 3`, `addOrder` keeps `customerId`)
- Create: `src/territory/store.js`
- Test: `src/territory/store.test.js`

**Interfaces:**
- Consumes: `normalizeName` (Task 1).
- Produces:
  - `src/db.js`: `export async function getDB()`. Upgrade `oldVersion < 3` creates `customers` (keyPath `id`; indexes `nameKey`, `region`, non-unique), `farms` (keyPath `id`; indexes `customerId`, `status`, `region`), `settings` (keyPath `key`), and index `customerId` on `orders`. `addOrder` copies `order.customerId ?? null`.
  - Types: `Customer = {id,name,nameKey,phone,email,region,address,notes,createdAt,updatedAt}`; `Farm = {id,name,customerId,ownerName,status,lat,lng,locationSource,locationAccuracy,locationStatus,region,address,capacity,notes,createdAt,updatedAt}`.
  - `listCustomers(): Promise<Customer[]>` (sorted by `nameKey`), `getCustomer(id)`, `findCustomersByName(name): Promise<Customer[]>` (via `nameKey` index), `saveCustomer(partial): Promise<Customer>`
  - `listFarms(): Promise<Farm[]>`, `getFarm(id)`, `listFarmsByCustomer(customerId): Promise<Farm[]>`, `saveFarm(partial): Promise<Farm>`, `deleteFarm(id)`
  - `getSetting(key): Promise<any>`, `setSetting(key, value)`
  - `class ValidationError extends Error { field: string }`
  - Internal, for Tasks 3/10: `putRaw(storeName, record)`, `clearStores(storeNames: string[])`

`saveCustomer`/`saveFarm`: assign `crypto.randomUUID()` when no id, set `createdAt` once, `updatedAt` always, trim strings, default missing optional strings to `''`. `saveCustomer` derives `nameKey`; requires non-empty name. `saveFarm` rules:
- name required (`field:'name'`)
- status `customer` requires `customerId` (`field:'customerId'`); otherwise status defaults to `'customer'` if `customerId` is set, else `'prospect'`
- lat/lng: both null, or both finite and in range, else `field:'location'`
- `locationStatus`: `'missing'` when null coords; else `'verify'` if the input says `'verify'`; else `'ok'`
- `capacity`: `parseCapacity` result
- `region` defaults to the customer's region when empty and customerId is set

- [ ] **Step 1: Write failing tests**

```js
beforeEach: delete IndexedDB 'orders-db' (indexedDB.deleteDatabase) and reset modules
test('same-name customers both persist', async () => {
  await saveCustomer({ name: 'Mohamed Alaoui', phone: '0600000001' })
  await saveCustomer({ name: 'mohamed  alaoui', phone: '0600000002' })
  expect((await findCustomersByName('MOHAMED ALAOUI')).length).toBe(2)
})
test('farm without coords is missing; verify kept when coords present', async () => {
  const c = await saveCustomer({ name: 'Client Démo', region: 'Région Test' })
  const f1 = await saveFarm({ name: 'مزرعة الأمل', customerId: c.id, capacity: '40 000' })
  expect(f1).toMatchObject({ lat: null, lng: null, locationStatus: 'missing', capacity: 40000, status: 'customer', region: 'Région Test' })
  const f2 = await saveFarm({ name: 'مزرعة الخير 2', customerId: c.id, lat: 34.568115, lng: -5.567138, locationStatus: 'verify', locationSource: 'import' })
  expect(f2.locationStatus).toBe('verify')
  expect((await listFarmsByCustomer(c.id)).length).toBe(2)
})
test('validation', async () => {
  await expect(saveFarm({ name: 'x', status: 'customer' })).rejects.toMatchObject({ field: 'customerId' })
  await expect(saveFarm({ name: 'x', lat: 35, lng: null })).rejects.toMatchObject({ field: 'location' })
  await expect(saveFarm({ name: 'x', lat: 91, lng: 0 })).rejects.toMatchObject({ field: 'location' })
  expect((await saveFarm({ name: 'p', ownerName: 'Someone' })).status).toBe('prospect')
})
test('existing v2 orders survive the upgrade', async () => {
  // open orders-db at version 2 with the v2 schema (copy of old upgrade), add an order, close; then call getDB()
  expect((await getAllOrders())[0].client).toBe('Old Client')
})
test('settings round-trip', async () => { await setSetting('lastBackupAt', 'X'); expect(await getSetting('lastBackupAt')).toBe('X') })
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- store` → import errors.
- [ ] **Step 3: Implement** the `src/db.js` changes and `store.js` per Interfaces.
- [ ] **Step 4: Run, expect PASS** — `npm test` → all green.
- [ ] **Step 5: Commit** — `feat(territory): orders-db v3 with customers, farms, settings`

---

### Task 3: Migration, customer links for orders and reports

**Files:**
- Create: `src/territory/migrate.js`, `src/territory/customerLink.js`
- Modify: `src/clients.js` (rewrite), `src/App.jsx` (run migration after login), `src/components/OrderForm.jsx`, `src/components/DailyReportsForm.jsx`, `src/pages/DailyReportsPage.jsx`
- Create: `src/components/territory/CustomerPicker.jsx`
- Test: `src/territory/migrate.test.js`, `src/territory/customerLink.test.js`

**Interfaces:**
- Consumes: store (Task 2), `loadDailyReports`/`saveDailyReports` (existing), `getAllOrders`/`updateOrder` (existing).
- Produces:
  - `runMigrationV3(): Promise<{createdCustomers:number}>`: no-op returning `{createdCustomers:0}` when setting `migration.v3` is true. Otherwise: gathers names from every localStorage key starting `clients_` (JSON string arrays), from `order.client`, and from `report.client`; one customer per distinct `normalizeName` (first-seen spelling, non-empty only); sets `customerId` on each order/report whose name maps to a customer and has no `customerId`; sets `migration.v3 = true`. Leaves the localStorage keys untouched.
  - `resolveCustomerByName(name): Promise<{status:'none'} | {status:'one', customer} | {status:'many', customers}>`
  - `getClientNames(): Promise<string[]>`: distinct customer display names, sorted (for datalists).
  - `renameCustomer(id, newName): Promise<Customer>`: saves and updates `client` on orders and daily reports with that `customerId`.
  - `customerUsage(id): Promise<{orders:number, reports:number}>`
  - `deleteCustomer(id, farmsAction:'delete'|'prospect'): Promise<{ok:true} | {ok:false, reason:'has-orders'|'has-reports'}>`: refuses when usage > 0; otherwise deletes farms, or converts them to `status:'prospect', customerId:null, ownerName: customer.name`; then deletes the customer.
  - `src/clients.js` exports only `getClientNames` and `resolveCustomerByName` (re-exported).
  - `<CustomerPicker customers={Customer[]} onPick={(customer|null)=>void} title={string} />`: modal list showing name, phone and region; a "New customer with this name" choice calls `onPick(null)`.

Form behaviour (OrderForm and DailyReportsForm), on submit: `resolveCustomerByName(name)` → `none`: `saveCustomer({name})`, use its id; `one`: use its id; `many`: open CustomerPicker, use the picked id, or create a new one on `null`. Payload gains `customerId`. Datalist options come from `getClientNames()` (async `useEffect`). In `App.jsx`, after `user` is set, show loading until `runMigrationV3()` resolves; log errors and continue.

- [ ] **Step 1: Write failing tests**

```js
test('migrates clients from all usernames, orders and reports, idempotently', async () => {
  localStorage.setItem('clients_demo', JSON.stringify(['Client Démo', 'Ferme Sahel']))
  localStorage.setItem('clients_other', JSON.stringify(['client  démo', 'Only Other']))
  await addOrder({ client: 'Order Only', orderDetails: 'x' })
  await saveDailyReports([{ id: 'r1', date: '2026-11-01', client: 'Report Only', notes: '' }])
  expect((await runMigrationV3()).createdCustomers).toBe(5)
  expect((await runMigrationV3()).createdCustomers).toBe(0)
  expect((await listCustomers()).length).toBe(5)
  const [order] = await getAllOrders(); expect(order.customerId).toBeTruthy(); expect(order.client).toBe('Order Only')
  const [rep] = await loadDailyReports(); expect(rep.customerId).toBeTruthy()
  expect(localStorage.getItem('clients_demo')).not.toBeNull()
})
test('resolveCustomerByName none/one/many', ...)
test('delete blocked by orders and by reports; farms converted to prospects', async () => {
  // customer with a report only → {ok:false, reason:'has-reports'}
  // customer with no usage and 2 farms, farmsAction 'prospect' → farms now status prospect, customerId null, ownerName = customer name
})
test('rename updates client string on linked orders and reports', ...)
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `migrate.js`, `customerLink.js`, the `clients.js` rewrite, CustomerPicker, and the form/App changes.
- [ ] **Step 4: Run** `npm test` (PASS) and `npm run build` (succeeds).
- [ ] **Step 5: Manual check** with `npm run dev`. Log in. Existing clients appear in the Orders datalist. Create two customers named "Test Same" via the order form (the second time pick "New customer"). The next order for "Test Same" opens the picker.
- [ ] **Step 6: Commit** — `feat(territory): migrate clients to customer profiles, link orders and reports`

---

### Task 4: Filters and statistics

**Files:**
- Create: `src/territory/filters.js`, `src/territory/stats.js`
- Test: `src/territory/filters.test.js`, `src/territory/stats.test.js`

**Interfaces:**
- Consumes: `normalizeName`, `haversineKm` (Task 1).
- Produces:
  - `FarmFilters = {text?:string, customerId?:string, statuses?:string[], region?:string, capMin?:number|null, capMax?:number|null, locationStatuses?:string[]}`
  - `applyFarmFilters(farms:Farm[], customersById:Record<string,Customer>, f:FarmFilters): Farm[]`. Text matches (normalised substring) the farm name, address, region, notes, customer name or ownerName. The capacity filters exclude null-capacity farms only when a bound is set. Empty arrays mean "all".
  - `computeStats(customers, farms): {customerCount, farmCount, farmsByStatus:{customer,prospect,competitor}, totalCapacity, knownCapacityCount, unknownCapacityCount, avgCapacity:number|null, needsLocation:number, byRegion:Array<{region:string, farms:number, capacity:number}>, topFarms:Farm[], topCustomers:Array<{customer, farms:number, capacity:number, unknown:number}>}`
    - Capacity totals, averages, top lists and byRegion capacity count only farms with `status === 'customer'`. Prospect/competitor capacity is reported separately by `prospectsNearCustomers`. `farmsByStatus` and `needsLocation` count all farms.
    - `avgCapacity` = round(total / known); null when known = 0.
    - `byRegion`: empty region → `''`; sorted by capacity desc.
    - Top lists hold 10 items, capacity desc, null capacity excluded.
    - `needsLocation` = count of `missing` + `verify`.
  - `prospectsNearCustomers(farms, radiusKm=10): Array<{farm, nearest:Farm, distanceKm}>`: each located prospect/competitor farm whose nearest located customer farm is ≤ radius; sorted by farm capacity desc.

- [ ] **Step 1: Write failing tests** with the 8 seed farms (spec §6.9) as one customer, plus a prospect at (34.52, -5.62) capacity 20000 and a customer farm with null capacity and no location:

```js
expect(s.totalCapacity).toBe(233000); expect(s.knownCapacityCount).toBe(8)
expect(s.unknownCapacityCount).toBe(1); expect(s.avgCapacity).toBe(29125)
expect(s.farmsByStatus).toEqual({ customer: 9, prospect: 1, competitor: 0 })
expect(s.needsLocation).toBe(4)   // 3 verify + 1 missing
expect(s.topFarms[0].name).toBe('مزرعة النور')
expect(s.topCustomers[0]).toMatchObject({ farms: 9, capacity: 233000, unknown: 1 })
expect(prospectsNearCustomers(farms)[0].nearest.name).toBe('مزرعة الأمل')
// filters
expect(applyFarmFilters(farms, byId, { text: 'النـــور' }).length).toBe(1)
expect(applyFarmFilters(farms, byId, { text: 'client' }).length).toBe(9)
expect(applyFarmFilters(farms, byId, { capMin: 32000 }).map(f => f.capacity).sort()).toEqual([32000,32000,40000,40000,42000])
expect(applyFarmFilters(farms, byId, { locationStatuses: ['verify'] }).length).toBe(3)
expect(applyFarmFilters(farms, byId, { statuses: ['prospect'] }).length).toBe(1)
```

- [ ] **Step 2: Run, expect FAIL.**  **Step 3: Implement.**  **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `feat(territory): farm filters and statistics`

---

### Task 5: Navigation shell, translations check, data hook

**Files:**
- Create: `src/components/territory/BottomNav.jsx`, `src/pages/MorePage.jsx`, `src/territory/useTerritory.js`, `src/territory.css`, `src/locales/locales.test.js`
- Modify: `src/App.jsx`, `src/components/Layout.jsx`, `src/main.jsx` (import `territory.css`), `src/locales/en.json`, `src/locales/fr.json`

**Interfaces:**
- Produces:
  - Routes (relative to the existing `/` layout): `index` → MapPage; `farms`, `farms/new`, `farms/:id`, `farms/:id/edit`; `customers`, `customers/new`, `customers/:id`, `customers/:id/edit`; `nearby` (query `?farm=<id>` or `?me=1`, `&r=<km>`); `dashboard`; `reports`; `data`; `more`; `orders` (existing Orders page moves here from index); `daily-reports`. The old `clients` route redirects to `customers`. Routes whose page is not built yet render a `Placeholder` component, defined in `App.jsx`, that shows their title. Each later task creates its page file and swaps it in.
  - `useTerritory(): {customers:Customer[], farms:Farm[], customersById:Record<string,Customer>, loading:boolean, reload:()=>Promise<void>}`
  - `BottomNav`: shown at ≤768px, fixed bottom, 5 items: Map `/`, Farms `/farms`, Customers `/customers`, Nearby `/nearby`, More `/more`; active item highlighted (NavLink). On wider screens the top nav lists all sections.
  - `MorePage`: links to Dashboard, Reports, Import/Export (`/data`), Orders, Daily Reports, then the LanguageSwitcher and logout.
  - i18n: all new keys live under the top-level `territory` key in both locale files.
- [ ] **Step 1: Write failing test** `locales.test.js`: it flattens the en and fr JSON to dotted keys and runs `expect(frKeys).toEqual(enKeys)` (sorted). It passes today, so add the `territory.nav.*` keys to `en.json` only first, then confirm the test fails.
- [ ] **Step 2: Run** `npm test -- locales` → FAIL listing the missing fr keys.
- [ ] **Step 3: Implement** the routes, layout, BottomNav, MorePage, useTerritory, the fr keys and the base mobile CSS. Main content gets `padding-bottom` for the bar. Touch targets ≥ 44px.
- [ ] **Step 4: Run** `npm test` (PASS) and `npm run build` (succeeds).
- [ ] **Step 5: Manual check** with `npm run dev` in Chrome device emulation at 375px wide: the bottom bar is visible and every tab routes. Orders work at `/orders`, and `/clients` redirects to `/customers`.
- [ ] **Step 6: Commit** — `feat(territory): navigation shell and data hook`

---

### Task 6: Customers list, profile and form

**Files:**
- Create: `src/pages/CustomersPage.jsx`, `src/pages/CustomerProfilePage.jsx`, `src/components/territory/CustomerForm.jsx`
- Delete: `src/pages/Clients.jsx`
- Modify: locale files, `territory.css`

**Interfaces:**
- Consumes: `useTerritory`, `saveCustomer`, `findCustomersByName`, `renameCustomer`, `customerUsage`, `deleteCustomer`, `computeStats`-style per-customer totals (sum known capacities, count unknown), `getAllOrders`.
- Produces: the `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit` screens.

Behaviour:
- **List:** search (normalised), region filter, sort by name / farm count / total capacity. Rows show the name, the region, and the phone when another customer has the same name.
- **Form fields:** name*, phone, email, region (datalist of existing regions), address, notes. When the normalised name already exists on save, show the existing customer(s) (phone, region, farm count) and ask "Create anyway?". A name change goes through `renameCustomer`.
- **Profile:** contact (phone is a `tel:` link), region, farm count, total capacity with "N unknown", a small map of the customer's farms (reuses FarmMap from Task 8 once it exists; until then a list), the farm list linking to `/farms/:id`, an "Add farm" button that opens `/farms/new?customer=<id>`, and the customer's orders (filtered by `customerId`).
- **Delete:** if `customerUsage` > 0, show a message with the counts. Otherwise, a confirm dialog with two buttons: "Delete farms too" and "Keep farms as prospects".

- [ ] **Step 1: Implement** the screens and locale keys.
- [ ] **Step 2: Run** `npm test` (the locales test passes) and `npm run build`.
- [ ] **Step 3: Manual check:** create a customer; create a second customer with the same name, see the warning and confirm. Edit a name and see orders show the new name. Deleting a customer with orders is blocked. Deleting one with farms converts them to prospects.
- [ ] **Step 4: Commit** — `feat(territory): customer profiles`

---

### Task 7: Farm form with location input and map picker; Farms list

**Files:**
- Create: `src/components/territory/FarmForm.jsx`, `src/components/territory/LocationInput.jsx`, `src/components/territory/MapPicker.jsx`, `src/pages/FarmsPage.jsx`, `src/pages/FarmDetailPage.jsx`
- Create: `src/territory/tiles.js`
- Modify: locale files, `territory.css`

**Interfaces:**
- Consumes: `parseCoordinates`, `isInMorocco`, `getCurrentPosition`, `mapsLinks`, `saveFarm`, `deleteFarm`, `applyFarmFilters`, `useTerritory`.
- Produces:
  - `tiles.js`: `TILE_LAYERS = { streets: {url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution:'© OpenStreetMap contributors', maxZoom:19}, satellite: {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution:'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community', maxZoom:19}, labels: {url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', maxZoom:19} }`, `DEFAULT_CENTER = [35.43, -5.98]`, `DEFAULT_ZOOM = 11`.
  - `<LocationInput value={{lat,lng,locationSource,locationAccuracy}} onChange={fn} contextPoints={Array<{lat,lng}>} />` has:
    - (a) lat and lng number inputs, plus a "Paste coordinates or Google Maps link" text box that calls `parseCoordinates`. Errors: `short-link` → "Open this link in Google Maps, long-press the pin, and copy the coordinates shown"; `unrecognized`; `out-of-range`.
    - (b) a "Choose on map" button opening MapPicker.
    - (c) a "Use my current location" button: GPS errors show the matching message and the inputs stay editable. Accuracy above 100 m shows a warning that includes the value.
    - (d) a "Clear location" button.
    - A non-blocking warning when `!isInMorocco`.
    - `locationSource` is set to `typed`, `map` or `gps` as appropriate.
  - `<MapPicker initial={{lat,lng}|null} contextPoints onConfirm={({lat,lng})=>void} onCancel />`: full-screen overlay; streets/satellite toggle; tap places a draggable marker; Confirm stays disabled until a marker exists. Centre priority: initial, then the bounds of contextPoints, then the last GPS fix if one was obtained during this session, then DEFAULT_CENTER.
  - `<FarmForm initial={Partial<Farm>} onSaved={(farm)=>void} />` has:
    - name*, status (3 options), and either a customer select (shown when status is `customer`; same-name customers show phone and region) or an ownerName field.
    - capacity, region, address, notes, LocationInput, and a "Location needs verification" checkbox that maps to `locationStatus:'verify'`.
    - `ValidationError` messages appear next to the matching field.
    - Coordinates whose `locationSource` is `typed` or `map` and that sit within 100 m of another farm trigger a "possible duplicate of X" notice (non-blocking).
- Pages:
  - `/farms` list: the FilterPanel (from Task 8; until then a text search plus status chips), an export button (Task 11), and rows with name, customer/owner, capacity, status and a location status badge. Includes a "Needs location" quick filter (`missing` + `verify`).
  - `/farms/:id` detail: all fields plus the "location source" text, and buttons for Nearby, Edit, Delete (with confirm), Open in Google Maps, and Directions.
  - `/farms/new`: pre-selects the customer from `?customer=`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `npm test` and `npm run build`.
- [ ] **Step 3: Manual check (phone emulation 375px):**
  - Paste `34°27'12.9"N 5°34'12.9"W` → fields fill.
  - Paste a `maps.app.goo.gl` link → guidance message.
  - Choose on map → satellite toggle works, drag the pin, confirm.
  - Block location permission in DevTools, then press "Use my current location" → "permission denied" message and the form is still usable.
  - Save with no location → the badge reads "Location missing".
  - Swapped coordinates (`-5.62, 34.52`) → outside-Morocco warning, but saving is allowed.
- [ ] **Step 4: Commit** — `feat(territory): farm form, location input, map picker, farms list`

---

### Task 8: Interactive map page

**Files:**
- Create: `src/components/territory/FarmMap.jsx`, `src/components/territory/ClusterLayer.jsx`, `src/components/territory/FarmSheet.jsx`, `src/components/territory/FilterPanel.jsx`, `src/pages/MapPage.jsx`
- Modify: `src/pages/FarmsPage.jsx` (use FilterPanel), `src/pages/CustomerProfilePage.jsx` (use FarmMap), locale files, `territory.css`

**Interfaces:**
- Consumes: `TILE_LAYERS`, `applyFarmFilters`, `useTerritory`, `getCurrentPosition`, `mapsLinks`.
- Produces:
  - `<FarmMap farms={Farm[]} customersById selectedId? onSelect={(farm)=>void} circle?={{center:{lat,lng}, radiusKm}} origin?={{lat,lng}} fitTo?={'farms'|'circle'} height? />`. It draws only farms with non-null coords. It has a streets/satellite layer toggle (satellite adds the labels overlay); the chosen layer is remembered in setting `map.layer`. Markers are `L.divIcon` circles coloured by status, customer `#1b7f3b`, prospect `#e08a00`, competitor `#c0392b`, with a "?" badge when `locationStatus === 'verify'`. They are clustered through `ClusterLayer`, which uses `useMap()` plus `L.markerClusterGroup({ showCoverageOnHover:false, maxClusterRadius:50 })` and rebuilds when `farms` changes. A "My location" control draws a blue dot.
  - `FilterPanel value={FarmFilters} onChange regions customers` is a collapsible sheet with search text, customer select, status chips, region select, capacity min/max and location status chips. The current filters are kept in the URL query (`?q=&c=&s=&r=&min=&max=&ls=`) so the Map and Farms pages share them on navigation.
  - `FarmSheet farm customer onClose` is a bottom sheet with the fields from spec §6.2 and actions Nearby (`/nearby?farm=id`), Edit, Open customer, Open in Google Maps, and Directions.
  - On `MapPage`, the search box filters local data on input. On submit with no local match it calls `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ma&limit=5&q=<q>` (submit only, never per keystroke), lists the places, and panning to one never creates a farm. Network failure shows "Place search needs an internet connection". A "N farms without location" chip links to `/farms?ls=missing`.

- [ ] **Step 1: Implement.** Import `leaflet/dist/leaflet.css`, `leaflet.markercluster/dist/MarkerCluster.css` and `MarkerCluster.Default.css`.
- [ ] **Step 2: Run** `npm test` and `npm run build`.
- [ ] **Step 3: Manual check:**
  - The 8 seed farms (entered by hand, or imported after Task 11) cluster when zoomed out and separate when zoomed in.
  - Tapping a marker opens the sheet, and the Google Maps link opens the right point.
  - The satellite toggle survives a reload.
  - A filter set on the Map stays applied after navigating to Farms.
  - Searching "Asilah" pans the map.
  - Offline, the search shows the message.
- [ ] **Step 4: Commit** — `feat(territory): interactive farm map`

---

### Task 9: Nearby farms

**Files:**
- Create: `src/pages/NearbyPage.jsx`
- Modify: locale files, `territory.css`

**Interfaces:**
- Consumes: `findNearby`, `RADII_KM`, `getCurrentPosition`, `FarmMap`, `useTerritory`, settings `nearby.radius`.
- Produces: the `/nearby` page:
  - **Origin selector:** a farm search/select, or "My location". The origin is read from `?farm=` or `?me=1`. If the selected origin farm has no location, the page says so and offers Edit.
  - **Radius chips:** taken from `RADII_KM`. The default is the last radius used, otherwise 10.
  - **Status filter chips:** the default is all statuses.
  - **Results list:** distance to 0.1 km plus a "straight-line" label, farm name, customer/owner, status, capacity. Tapping a result selects it on the map.
  - **Map:** FarmMap with the origin marker, the radius circle and the results only.
  - **Footer:** "N farms without location were not included" whenever `missingCount > 0`.
  - **GPS errors:** shown inline with a retry button.
  - **Empty result:** "No farms within X km", with a button to widen the radius to the next value.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `npm test` and `npm run build`.
- [ ] **Step 3: Manual check:**
  - From مزرعة الأمل at 5 km, مزرعة النور (≈2.9 km) and مزرعة الواحة (≈3.2 km) are listed.
  - At 20 km all 7 other seed farms are listed.
  - "My location" with a location spoofed in DevTools Sensors to 34.57, -5.57 shows مزرعة الخير 2 first (≈0.3 km), then مزرعة الخير 1 (≈1.1 km).
  - Denied permission shows the inline error and retry.
- [ ] **Step 4: Commit** — `feat(territory): nearby farm detection`

---

### Task 10: Excel I/O, full backup and restore

**Files:**
- Create: `src/territory/xlsxIO.js`, `src/territory/backup.js`
- Create: `src/pages/DataPage.jsx` (backup and restore sections; the import and export sections are added in Task 11)
- Modify: `src/App.jsx` (route `data` → DataPage), `src/components/Layout.jsx` (last backup indicator), locale files
- Test: `src/territory/backup.test.js`

**Interfaces:**
- Consumes: store (`listCustomers`, `listFarms`, `putRaw`, `clearStores`, `getSetting`, `setSetting`), `getAllOrders`, `loadDailyReports`, `saveDailyReports`.
- Produces:
  - `xlsxIO.js`: `readWorkbook(fileOrArrayBuffer): Promise<WorkBook>`, `downloadWorkbook(wb, filename)`, `sheetRows(wb, sheetName): {headers:string[], rows:any[][]}` (raw values, `defval: null`), `rowsToSheet(headers, rows)`.
  - `FIELDS`: an ordered field list per sheet with a type each. Exact lists:
    - **Customers:** id s, name s, nameKey s, phone s, email s, region s, address s, notes s, createdAt s, updatedAt s
    - **Farms:** id s, name s, customerId s?, ownerName s, status s, lat n?, lng n?, locationSource s?, locationAccuracy n?, locationStatus s, region s, address s, capacity n?, notes s, createdAt s, updatedAt s
    - **Orders:** id n, client s, customerId s?, desiredDate s, orderDetails s, delivered b, cancelled b, createdAt s
    - **DailyReports:** id s, date s, client s, customerId s?, notes s, plus every other key found on report objects, stored as a JSON string in a `extra` column so that unknown fields (e.g. voice-note metadata) survive.
    - Types: `s` is a string (empty cell → `''`); `s?`/`n?` are nullable (empty cell → `null`); `n` is a number; `b` is a boolean written as `TRUE`/`FALSE`.
  - `buildBackup({customers, farms, orders, dailyReports}, {appVersion, exportedAt}): WorkBook`. The `Meta` sheet holds key/value rows `schemaVersion=3`, `appVersion`, `exportedAt`, and per-sheet counts.
  - `parseBackup(wb): {customers, farms, orders, dailyReports, meta}`. It throws `BackupFormatError('not-a-backup')` when the Meta sheet is missing, and `BackupFormatError('schema')` when schemaVersion ≠ 3. Counts are checked against Meta, and a mismatch throws `BackupFormatError('counts')`.
  - `exportFullBackup(): Promise<void>` loads all the data, downloads `farm-backup-YYYY-MM-DD.xlsx` and sets `lastBackupAt`.
  - `restoreBackup(data, mode:'replace'|'add-missing'): Promise<{added:Record<sheet,number>, skipped:Record<sheet,number>}>`.
    - `replace`: clears customers, farms and orders, then writes all records with their ids (orders keep numeric ids via `put`). Daily reports are replaced via `saveDailyReports`. Sets `migration.v3 = true`.
    - `add-missing`: inserts only the ids that are absent.
  - DataPage backup section:
    - An "Export everything" button and the "Last backup: N days ago" text.
    - Restore: pick a file → show the counts from Meta → choose "Replace all" (default; confirm dialog: "This replaces all data on this phone") or "Add missing only" → show the result.
  - Layout shows an amber "Backup N days old" chip when `lastBackupAt` is more than 7 days ago or missing (and data exists). The chip links to `/data`.

- [ ] **Step 1: Write failing tests**

```js
const data = {
  customers: [{ id:'c1', name:'Client Démo', nameKey:'client démo', phone:'', email:'', region:'Région Test', address:'', notes:'', createdAt:'2026-11-16T10:00:00.000Z', updatedAt:'2026-11-16T10:00:00.000Z' }],
  farms: [
    { id:'f1', name:'مزرعة الأمل', customerId:'c1', ownerName:'', status:'customer', lat:34.518505, lng:-5.622656, locationSource:'import', locationAccuracy:null, locationStatus:'ok', region:'Région Test', address:'', capacity:40000, notes:'ملاحظة', createdAt:'…', updatedAt:'…' },
    { id:'f2', name:'Prospect X', customerId:null, ownerName:'Someone', status:'prospect', lat:null, lng:null, locationSource:null, locationAccuracy:null, locationStatus:'missing', region:'', address:'', capacity:null, notes:'', createdAt:'…', updatedAt:'…' },
  ],
  orders: [{ id: 7, client:'Client Démo', customerId:'c1', desiredDate:'2026-11-20', orderDetails:'40 000 poussins', delivered:false, cancelled:true, createdAt:'…' }],
  dailyReports: [{ id:'r1', date:'2026-11-15', client:'Client Démo', customerId:'c1', notes:'visite', audio:{ name:'a.webm' } }],
}
test('round-trips exactly through an xlsx byte buffer', () => {
  const wb = buildBackup(data, { appVersion:'0.8.0', exportedAt:'2026-11-16T12:00:00.000Z' })
  const buf = XLSX.write(wb, { type:'array', bookType:'xlsx' })
  expect(parseBackup(XLSX.read(buf, { type:'array' }))).toMatchObject(data) // deep-equal per sheet
})
test('rejects non-backup and wrong schema', ...)
test('restore replace preserves numeric order id 7 and nulls; add-missing never overwrites', async () => { ... })
```

  Use `toEqual` on each sheet array, not only `toMatchObject`, so that an extra `null` → `''` conversion fails the test.
- [ ] **Step 2: Run, expect FAIL.**  **Step 3: Implement.**  **Step 4: Run, expect PASS**, then `npm run build`.
- [ ] **Step 5: Manual check:** export, clear site data in DevTools, log in, restore → orders, reports, customers and farms are all back. Opening the file in Excel shows Arabic correctly.
- [ ] **Step 6: Commit** — `feat(territory): full backup export and restore`

---

### Task 11: Spreadsheet import wizard, filtered export, seed file

**Files:**
- Create: `src/territory/importer.js`, `src/territory/exporter.js`, `src/components/territory/ImportWizard.jsx`, `scripts/make-seed-xlsx.mjs`
- Generate: `Client's Farms/seed-farms.xlsx`
- Modify: `src/pages/DataPage.jsx`, `src/pages/FarmsPage.jsx`, `src/pages/CustomersPage.jsx` (export buttons), locale files, `package.json` (script `"seed:xlsx": "node scripts/make-seed-xlsx.mjs"`)
- Test: `src/territory/importer.test.js`, `src/territory/exporter.test.js`

**Interfaces:**
- Consumes: `normalizeName`, `parseNumberLoose`, `parseCapacity`, `parseCoordinates`, `haversineKm`, store, `xlsxIO`.
- Produces:
  - `IMPORT_FIELDS = ['customerName','customerPhone','customerRegion','farmName','status','lat','lng','coordinates','address','region','capacity','notes','verify']`
  - `guessMapping(headers:string[]): Record<ImportField, number|null>`. Matching is normalised and checks whether a synonym is contained in the header. Synonyms:
    - customerName: client, customer, nom client, propriétaire, proprietaire, العميل, الزبون, المالك
    - customerPhone: phone, tel, téléphone, telephone, gsm, الهاتف
    - customerRegion: client region, région client
    - farmName: farm, ferme, élevage, elevage, poulailler, nom ferme, الضيعة, المزرعة
    - status: status, statut, type
    - lat: lat, latitude; lng: lng, lon, long, longitude
    - coordinates: gps, coordonnées, coordinates, lien, link, maps, localisation, location, الموقع
    - address: address, adresse, douar, العنوان
    - region: région, region, province, commune, المنطقة
    - capacity: capacity, capacité, capacite, poussins, effectif, السعة
    - notes: notes, remarque, observations, ملاحظات
    - verify: verify, vérifier, a verifier
    - A header that matches both customerRegion and region goes to customerRegion only when it contains "client".
  - `rowsToIncoming(rows:any[][], mapping): {customers: IncomingCustomer[], rowErrors: Array<{row:number, message:string}>}`
    - `IncomingCustomer = {key, name, phone, region, status:'customer'|'prospect'|'competitor', farms: IncomingFarm[]}`
    - `IncomingFarm = {row, name, lat, lng, locationStatus, capacity, address, region, notes, status}`
    - Grouping key: normalised name plus normalised phone, where phone is digits only and empty matches empty. Two rows with the same name and different non-empty phones become two customers.
    - Coordinates: lat/lng columns via `parseNumberLoose`; otherwise the coordinates column via `parseCoordinates`. Invalid or missing → null with locationStatus `missing`, and the row is noted in `rowErrors` only when the cell was non-empty but unparseable.
    - Status values: client/customer/عميل → customer; prospect/prospect(e)/potentiel → prospect; concurrent/competitor/منافس → competitor. When missing, the status is customer.
    - Verify: a truthy value (yes, oui, x, 1, true, نعم) with coords present → `verify`.
    - Rows without farmName are reported in rowErrors and skipped.
  - `matchCustomers(incoming:IncomingCustomer[], existing:Customer[]): Array<{key, candidates: Customer[]}>`. Only `status === 'customer'` incoming customers are matched (prospect/competitor rows put the name into `ownerName` and create no customer).
  - `findFarmConflicts(farms:IncomingFarm[], existingFarms:Farm[], targetCustomerId:string|null): Array<{row, kind:'same-name'|'nearby', existing:Farm, distanceM?:number}>`. `same-name` means the normalised name matches within the same customer (or the same ownerName for prospects). `nearby` means within 100 m of any existing farm. Rows inside the same file are also checked against each other.
  - `applyImport(incoming, customerDecisions: Record<key, {type:'existing', customerId}|{type:'new'}>, farmDecisions: Record<row, 'skip'|'update'|'new'>): Promise<{customersCreated, farmsCreated, farmsUpdated, farmsSkipped, missingLocation}>`. Rows with no conflict default to `'new'`. `update` overwrites the existing farm's non-empty incoming fields only. Imported coords get `locationSource:'import'`.
  - `ImportWizard` steps: file and sheet → preview of 5 rows → column mapping (selects, prefilled by guessMapping) → customer matching (one card per match: candidate cards with phone, region and farm names; buttons "Same customer" / "New customer"; there is no default selection and Next stays disabled until each card is decided) → farm conflicts (skip / update / import as new; default skip) → summary.
  - `exporter.js`: `farmsWorkbook(farms, customersById): WorkBook` with sheet `Farms` and columns `Reference, Farm, Customer / Owner, Status, Region, Address, Latitude, Longitude, Location status, Capacity, Notes`. `customersWorkbook(customers, farms): WorkBook` with sheet `Customers` and columns `Reference, Customer, Phone, Email, Region, Farms, Total capacity, Unknown capacity farms, Notes`. Export buttons on Farms and Customers download what is currently filtered, as `farms-YYYY-MM-DD.xlsx` and `customers-YYYY-MM-DD.xlsx`. Reference = the first 8 characters of the id.
  - `scripts/make-seed-xlsx.mjs` writes `Client's Farms/seed-farms.xlsx` with sheet `Farms`, columns `Client, Farm, Latitude, Longitude, Capacity, Maps link, Verify, Region` and the 8 rows from spec §6.9. Verify is `yes` for the three flagged farms; Region is `Région Test`.

- [ ] **Step 1: Write failing tests**

```js
test('seed file imports as 1 customer, 8 farms, 3 verify, 233000', async () => {
  const wb = await readWorkbook(fs.readFileSync("Client's Farms/seed-farms.xlsx"))
  const { headers, rows } = sheetRows(wb, 'Farms')
  const m = guessMapping(headers)
  expect(m.customerName).toBe(0); expect(m.farmName).toBe(1); expect(m.lat).toBe(2); expect(m.lng).toBe(3); expect(m.capacity).toBe(4)
  const { customers } = rowsToIncoming(rows, m)
  expect(customers).toHaveLength(1); expect(customers[0].farms).toHaveLength(8)
  expect(customers[0].farms.filter(f => f.locationStatus === 'verify')).toHaveLength(3)
  expect(customers[0].farms.reduce((s,f)=>s+f.capacity,0)).toBe(233000)
})
test('same name, different phones → two incoming customers', () => {
  const rows = [['Mohamed Alaoui','0611','F1'],['Mohamed Alaoui','0622','F2'],['mohamed  alaoui','0611','F3']]
  const { customers } = rowsToIncoming(rows, { customerName:0, customerPhone:1, farmName:2 })
  expect(customers.map(c=>c.farms.map(f=>f.name))).toEqual([['F1','F3'],['F2']])
})
test('comma decimals and capacity formats in rows', () => { /* '34,518505' '-5,622656' '40 000' → numbers */ })
test('coordinates column with google URL; short link → missing + rowError', ...)
test('matchCustomers returns candidates for existing same-name customer; never auto-picks', ...)
test('findFarmConflicts: same-name within customer and within 100 m', () => { /* 34.518505,-5.622656 vs 34.5189,-5.6227 → nearby (~45 m) */ })
test('applyImport attaches only per decisions; missing location counted', async () => { ... })
test('farmsWorkbook columns and filtered rows', ...)
```

- [ ] **Step 2: Run** `npm run seed:xlsx`, then `npm test -- importer` → FAIL (modules missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` (PASS) and `npm run build`.
- [ ] **Step 5: Manual check:**
  - Import the seed file on a fresh profile → 8 farms appear on the map, 3 of them with the "?" badge.
  - Import it again → the matching card for "Client Démo" appears. Choosing "Same customer" lists 8 same-name conflicts, defaulting to skip.
  - A filtered Farms export opens in Excel with Arabic intact.
- [ ] **Step 6: Commit** — include the generated xlsx and the `Client's Farms/` screenshots folder: `feat(territory): spreadsheet import, filtered export, seed data`

---

### Task 12: Dashboard and reports

**Files:**
- Create: `src/pages/DashboardPage.jsx`, `src/pages/ReportsPage.jsx`, `src/components/territory/BarChart.jsx`
- Modify: `src/App.jsx` (routes `dashboard`, `reports`), locale files, `territory.css`

**Interfaces:**
- Consumes: `computeStats`, `prospectsNearCustomers`, `applyFarmFilters`, `useTerritory`, `getSetting('lastBackupAt')`.
- Produces:
  - `<BarChart data={Array<{label:string, value:number}>} format={(n)=>string} />`: horizontal SVG bars sized to the container width, a label on the left and the value at the bar end. Uses theme CSS variables and works right-to-left for Arabic labels (`direction:auto` on the label text).
  - Dashboard tiles: customers, farms (with a status breakdown), total capacity, average per farm (`—` when null), farms needing location (links to `/farms?ls=missing,verify`), last backup age. Below the tiles: a farms-by-region BarChart plus the top 5 farms and top 5 customers, each linking to their page.
  - Reports page: a FilterPanel scope; a table and BarChart by region (farms, capacity); the top 10 farms; the top 10 customers; and "Prospects within 10 km of a customer farm" (farm, nearest customer farm, distance, capacity). Each section has an export button that uses `rowsToSheet`.
  - Numbers are formatted with `Intl.NumberFormat(i18n.language)`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `npm test` and `npm run build`.
- [ ] **Step 3: Manual check:** with the seed data, the total is 233,000, the average is 29,125, the top farm is مزرعة النور at 42,000, and "Needs location" shows 3.
- [ ] **Step 4: Commit** — `feat(territory): dashboard and reports`

---

### Task 13: Offline tiles, polish, deploy check

**Files:**
- Modify: `public/sw.js`, `package.json` (`version` → `0.8.0`), `README.md` (Farm territory section: backup routine, location rules), `src/locales/*`, `territory.css`

**Interfaces:**
- Produces, in the service worker:
  - `CACHE_NAME = 'tracking-orders-cache-v2'` and `TILE_CACHE = 'map-tiles-v1'`.
  - Requests whose host is `tile.openstreetmap.org` (or a subdomain of it) or `server.arcgisonline.com` use cache-first and are stored in `TILE_CACHE`. After each put, if the key count exceeds 2000, the oldest keys are deleted until 1800 remain.
  - Requests to `nominatim.openstreetmap.org` bypass the service worker (no `respondWith`).
  - The activate step keeps `TILE_CACHE`.
  - Everything else keeps the existing network-first behaviour.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `npm test` and `npm run build && npm run preview`.
- [ ] **Step 3: Manual check:**
  - In the preview, browse the map around the farms, switch DevTools to Offline and reload → the app, the data and the viewed tiles still show.
  - Run Lighthouse in mobile mode: no layout overflow at 375px.
  - Switch to French → no raw keys visible on any new page.
- [ ] **Step 4: Commit** — `feat(territory): offline map tiles, polish, v0.8.0`
- [ ] **Step 5:** Run the whole-branch review, then finish with superpowers:finishing-a-development-branch (merge to `main` triggers the existing GitHub Pages deploy workflow).
