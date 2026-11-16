import { describe, test, expect, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import { resetAll } from '../test/resetDbs.js'
import { readWorkbook, sheetRows } from './xlsxIO.js'
import { saveCustomer, saveFarm, listCustomers, listFarms } from './store.js'
import { buildSeedWorkbook } from '../../scripts/make-seed-xlsx.mjs'
import { normalizeName } from './normalize.js'
import { haversineKm } from './geo.js'
import {
  IMPORT_FIELDS, guessMapping, rowsToIncoming, matchCustomers, findFarmConflicts, findImportConflicts, applyImport,
} from './importer.js'

beforeEach(resetAll)

async function seedSheet() {
  const buf = XLSX.write(buildSeedWorkbook(), { type: 'array', bookType: 'xlsx' })
  const wb = await readWorkbook(buf)
  return sheetRows(wb, 'Farms')
}

describe('guessMapping', () => {
  test('IMPORT_FIELDS', () => {
    expect(IMPORT_FIELDS).toEqual(['customerName', 'customerPhone', 'customerRegion', 'farmName', 'status', 'lat', 'lng', 'coordinates', 'address', 'region', 'capacity', 'notes', 'verify'])
  })

  test('seed headers', async () => {
    const { headers } = await seedSheet()
    expect(headers).toEqual(['Client', 'Farm', 'Latitude', 'Longitude', 'Capacity', 'Maps link', 'Verify', 'Region'])
    const m = guessMapping(headers)
    expect(m).toMatchObject({ customerName: 0, farmName: 1, lat: 2, lng: 3, capacity: 4, coordinates: 5, verify: 6, region: 7 })
    expect(m.customerRegion).toBeNull()
    expect(m.customerPhone).toBeNull()
  })

  test('French / Arabic headers, client region vs region, one field per header', () => {
    const m = guessMapping(['Nom client', 'Téléphone', 'Région client', 'Nom ferme', 'Statut', 'Coordonnées GPS', 'Douar', 'Province', 'Capacité', 'Remarque', 'À vérifier'])
    expect(m).toMatchObject({
      customerName: 0, customerPhone: 1, customerRegion: 2, farmName: 3, status: 4,
      coordinates: 5, address: 6, region: 7, capacity: 8, notes: 9, verify: 10, lat: null, lng: null,
    })
    const a = guessMapping(['العميل', 'الهاتف', 'المزرعة', 'الموقع', 'السعة', 'ملاحظات', 'المنطقة'])
    expect(a).toMatchObject({ customerName: 0, customerPhone: 1, farmName: 2, coordinates: 3, capacity: 4, notes: 5, region: 6 })
  })

  test("this app's own farm export maps back cleanly", () => {
    const m = guessMapping(['Reference', 'Farm', 'Customer / Owner', 'Status', 'Region', 'Address', 'Latitude', 'Longitude', 'Location status', 'Capacity', 'Notes'])
    expect(m).toMatchObject({ farmName: 1, customerName: 2, status: 3, region: 4, address: 5, lat: 6, lng: 7, capacity: 9, notes: 10, coordinates: null, verify: null })
  })

  test('a region header without "client" goes to region', () => {
    const m = guessMapping(['Client', 'Ferme', 'Région'])
    expect(m.region).toBe(2)
    expect(m.customerRegion).toBeNull()
  })
})

describe('rowsToIncoming', () => {
  test('seed file imports as 1 customer, 8 farms, 3 verify, 233000', async () => {
    const { headers, rows } = await seedSheet()
    const m = guessMapping(headers)
    expect(m.customerName).toBe(0); expect(m.farmName).toBe(1); expect(m.lat).toBe(2); expect(m.lng).toBe(3); expect(m.capacity).toBe(4)
    const { customers, rowErrors } = rowsToIncoming(rows, m)
    expect(rowErrors).toEqual([])
    expect(customers).toHaveLength(1)
    expect(customers[0]).toMatchObject({ name: 'Client Démo', status: 'customer', region: 'Région Test' })
    expect(customers[0].farms).toHaveLength(8)
    expect(customers[0].farms.filter((f) => f.locationStatus === 'verify')).toHaveLength(3)
    expect(customers[0].farms.reduce((s, f) => s + f.capacity, 0)).toBe(233000)
    // Short links are never resolved: the lat/lng columns are used as-is.
    expect(customers[0].farms[0]).toMatchObject({ row: 2, name: 'مزرعة الأمل', lat: 34.518505, lng: -5.622656, locationStatus: 'ok', region: 'Région Test' })
  })

  test('same name, different phones → two incoming customers', () => {
    const rows = [['Mohamed Alaoui', '0611', 'F1'], ['Mohamed Alaoui', '0622', 'F2'], ['mohamed  alaoui', '0611', 'F3']]
    const { customers } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2 })
    expect(customers.map((c) => c.farms.map((f) => f.name))).toEqual([['F1', 'F3'], ['F2']])
  })

  test('blank-phone rows join the only phone of the same name (phone only on one row)', () => {
    const rows = [['A', '06 11', 'F1'], ['A', '', 'F2'], ['A', null, 'F3'], ['A', '0611', 'F4']]
    const { customers, notes } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2 })
    expect(customers).toHaveLength(1)
    expect(customers[0]).toMatchObject({ name: 'A', phone: '06 11' })
    expect(customers[0].farms.map((f) => f.name)).toEqual(['F1', 'F2', 'F3', 'F4'])
    expect(notes).toEqual([])
  })

  test('blank-phone rows before the phone row are merged too, keeping row order and region', () => {
    const rows = [['A', '', 'F1', 'Asilah'], ['A', '0611', 'F2', null]]
    const { customers } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2, customerRegion: 3 })
    expect(customers).toHaveLength(1)
    expect(customers[0]).toMatchObject({ phone: '0611', region: 'Asilah' })
    expect(customers[0].farms.map((f) => f.name)).toEqual(['F1', 'F2'])
  })

  test('several phones for one name: blank-phone rows stay separate and a note is returned', () => {
    const rows = [['A', '0611', 'F1'], ['A', '0622', 'F2'], ['A', '', 'F3'], ['B', '', 'F4']]
    const { customers, notes } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2 })
    expect(customers.map((c) => c.farms.map((f) => f.name))).toEqual([['F1'], ['F2'], ['F3'], ['F4']])
    expect(notes).toEqual([{ code: 'blank-phone-ambiguous', name: 'A', phones: 2, farms: 1 }])
  })

  test('blank-phone merge never crosses statuses', () => {
    const rows = [['A', '0611', 'F1', 'customer'], ['A', '', 'F2', 'prospect']]
    const { customers } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2, status: 3 })
    expect(customers.map((c) => [c.status, c.farms.map((f) => f.name)])).toEqual([['customer', ['F1']], ['prospect', ['F2']]])
  })

  test('comma decimals and capacity formats in rows', () => {
    const rows = [
      ['C', 'F1', '34,518505', '-5,622656', '40 000'],
      ['C', 'F2', 35.4, -6.0, '40.000'],
      ['C', 'F3', null, null, '40000 poussins'],
      ['C', 'F4', null, null, 12000],
    ]
    const { customers } = rowsToIncoming(rows, { customerName: 0, farmName: 1, lat: 2, lng: 3, capacity: 4 })
    const f = customers[0].farms
    expect(f[0]).toMatchObject({ lat: 34.518505, lng: -5.622656, capacity: 40000, locationStatus: 'ok' })
    expect(f[1]).toMatchObject({ lat: 35.4, lng: -6.0, capacity: 40000 })
    expect(f[2]).toMatchObject({ lat: null, lng: null, capacity: 40000, locationStatus: 'missing' })
    expect(f[3].capacity).toBe(12000)
  })

  test('coordinates column with google URL; short link → missing + rowError', () => {
    const rows = [
      ['C', 'F1', 'https://www.google.com/maps/place/34.518505,-5.622656'],
      ['C', 'F2', 'https://maps.app.goo.gl/DEMOLINK0000000001'],
      ['C', 'F3', null],
      ['C', 'F4', 'not a place'],
    ]
    const { customers, rowErrors } = rowsToIncoming(rows, { customerName: 0, farmName: 1, coordinates: 2 })
    const f = customers[0].farms
    expect(f[0]).toMatchObject({ lat: 34.518505, lng: -5.622656, locationStatus: 'ok' })
    expect(f[1]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(f[2]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(f[3]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(rowErrors.map((e) => [e.row, e.code])).toEqual([[3, 'short-link'], [5, 'bad-coordinates']])
    expect(rowErrors.every((e) => typeof e.message === 'string' && e.message)).toBe(true)
  })

  test('lat/lng columns win over the coordinates column; bad lat/lng is reported, not invented', () => {
    const rows = [
      ['C', 'F1', '35.1', '-6.1', 'https://www.google.com/maps/@30,-7,15z'],
      ['C', 'F2', '95', '-6.1', null],
      ['C', 'F3', '35.1', null, null],
    ]
    const { customers, rowErrors } = rowsToIncoming(rows, { customerName: 0, farmName: 1, lat: 2, lng: 3, coordinates: 4 })
    const f = customers[0].farms
    expect(f[0]).toMatchObject({ lat: 35.1, lng: -6.1 })
    expect(f[1]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(f[2]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(rowErrors.map((e) => e.row)).toEqual([3, 4])
  })

  test('status values, verify flag, rows without farm name', () => {
    const rows = [
      ['A', 'F1', 'client', 35, -6, 'oui'],
      ['B', 'F2', 'Prospecte', 35, -6, 'x'],
      ['C', 'F3', 'concurrent', null, null, 'yes'],
      ['D', 'F4', 'منافس', 35, -6, null],
      ['E', 'F5', null, 35, -6, 'no'],
      ['F', null, 'client', 35, -6, null],
      ['G', 'F7', 'potentiel', 35, -6, 'نعم'],
      [null, null, null, null, null, null],
    ]
    const { customers, rowErrors } = rowsToIncoming(rows, { customerName: 0, farmName: 1, status: 2, lat: 3, lng: 4, verify: 5 })
    const byFarm = Object.fromEntries(customers.flatMap((c) => c.farms.map((f) => [f.name, { ...f, owner: c.name, cs: c.status }])))
    expect(byFarm.F1).toMatchObject({ status: 'customer', locationStatus: 'verify' })
    expect(byFarm.F2).toMatchObject({ status: 'prospect', locationStatus: 'verify' })
    expect(byFarm.F3).toMatchObject({ status: 'competitor', locationStatus: 'missing' })
    expect(byFarm.F4).toMatchObject({ status: 'competitor', locationStatus: 'ok' })
    expect(byFarm.F5).toMatchObject({ status: 'customer', locationStatus: 'ok' })
    expect(byFarm.F7).toMatchObject({ status: 'prospect', locationStatus: 'verify' })
    expect(Object.keys(byFarm)).toHaveLength(6)
    expect(rowErrors.map((e) => [e.row, e.code])).toEqual([[7, 'no-farm-name']])
  })

  test('prospect and customer with the same name stay separate', () => {
    const rows = [['X', 'F1', 'client'], ['X', 'F2', 'prospect']]
    const { customers } = rowsToIncoming(rows, { customerName: 0, farmName: 1, status: 2 })
    expect(customers.map((c) => c.status)).toEqual(['customer', 'prospect'])
    expect(customers[1].farms[0].ownerName).toBe('X')
  })
})

describe('matchCustomers', () => {
  test('returns candidates for existing same-name customer; never auto-picks', () => {
    const existing = [
      { id: 'e1', name: 'Client Démo', nameKey: 'client démo', phone: '0611' },
      { id: 'e2', name: 'CLIENT  démo', nameKey: 'client démo', phone: '0622' },
      { id: 'e3', name: 'Other', nameKey: 'other', phone: '' },
    ]
    const incoming = [
      { key: 'k1', name: 'Client Démo', phone: '0611', status: 'customer', farms: [] },
      { key: 'k2', name: 'Nobody', phone: '', status: 'customer', farms: [] },
      { key: 'k3', name: 'Other', phone: '', status: 'prospect', farms: [] },
    ]
    const res = matchCustomers(incoming, existing)
    expect(res).toHaveLength(1)
    expect(res[0].key).toBe('k1')
    expect(res[0].candidates.map((c) => c.id)).toEqual(['e1', 'e2'])
    expect(res[0]).not.toHaveProperty('selected')
    expect(res[0]).not.toHaveProperty('customerId')
  })
})

describe('findFarmConflicts', () => {
  const existing = [
    { id: 'x1', name: 'مزرعة الأمل', customerId: 'c1', ownerName: '', status: 'customer', lat: 34.518505, lng: -5.622656 },
    { id: 'x2', name: 'Ferme B', customerId: 'c2', ownerName: '', status: 'customer', lat: 34, lng: -5 },
    { id: 'x3', name: 'Voisin farm', customerId: null, ownerName: 'Voisin', status: 'prospect', lat: null, lng: null },
  ]

  test('same-name within customer and within 100 m', () => {
    const farms = [
      { row: 2, name: 'Other name', lat: 34.5189, lng: -5.6227, status: 'customer' },
      { row: 3, name: 'مزرعة  الأمل', lat: null, lng: null, status: 'customer' },
      { row: 4, name: 'Ferme B', lat: null, lng: null, status: 'customer' },
    ]
    const res = findFarmConflicts(farms, existing, 'c1')
    const nearby = res.find((r) => r.row === 2)
    expect(nearby).toMatchObject({ kind: 'nearby', existing: { id: 'x1' } })
    expect(nearby.distanceM).toBeGreaterThan(30)
    expect(nearby.distanceM).toBeLessThan(60)
    expect(res.filter((r) => r.row === 3)).toEqual([{ row: 3, kind: 'same-name', existing: existing[0] }])
    // Same farm name but another customer: not a same-name conflict.
    expect(res.filter((r) => r.row === 4)).toEqual([])
  })

  test('new customer has no same-name conflicts with existing farms', () => {
    const res = findFarmConflicts([{ row: 2, name: 'مزرعة الأمل', lat: null, lng: null, status: 'customer' }], existing, null)
    expect(res).toEqual([])
  })

  test('prospects compare ownerName', () => {
    const res = findFarmConflicts([
      { row: 2, name: 'voisin FARM', ownerName: 'voisin', lat: null, lng: null, status: 'prospect' },
      { row: 3, name: 'Voisin farm', ownerName: 'Someone else', lat: null, lng: null, status: 'prospect' },
    ], existing, null)
    expect(res).toEqual([{ row: 2, kind: 'same-name', existing: existing[2] }])
  })

  test('rows in the same file are checked against each other', () => {
    const res = findFarmConflicts([
      { row: 2, name: 'F1', lat: 30, lng: -7, status: 'customer' },
      { row: 3, name: 'f1', lat: null, lng: null, status: 'customer' },
      { row: 4, name: 'F4', lat: 30.0003, lng: -7, status: 'customer' },
    ], [], null)
    expect(res.map((r) => [r.row, r.kind, r.existing.row, r.existing.inFile])).toEqual([[3, 'same-name', 2, true], [4, 'nearby', 2, true]])
  })
})

describe('applyImport', () => {
  test('seed file import creates 1 customer, 8 farms with import source', async () => {
    const { headers, rows } = await seedSheet()
    const incoming = rowsToIncoming(rows, guessMapping(headers)).customers
    const sum = await applyImport(incoming, {}, {})
    expect(sum).toMatchObject({ customersCreated: 1, farmsCreated: 8, farmsUpdated: 0, farmsSkipped: 0, missingLocation: 0, errors: [] })
    const farms = await listFarms()
    expect(farms).toHaveLength(8)
    expect(farms.filter((f) => f.locationStatus === 'verify')).toHaveLength(3)
    expect(farms.every((f) => f.locationSource === 'import')).toBe(true)
    const [c] = await listCustomers()
    expect(c).toMatchObject({ name: 'Client Démo', region: 'Région Test' })
    expect(farms.every((f) => f.customerId === c.id)).toBe(true)
  })

  test('attaches only per decisions; missing location counted', async () => {
    const a = await saveCustomer({ name: 'Mohamed Alaoui', phone: '0611' })
    const b = await saveCustomer({ name: 'Mohamed Alaoui', phone: '0622' })
    const old = await saveFarm({ name: 'F1', customerId: b.id, status: 'customer', lat: 35, lng: -6, capacity: 1000, notes: 'keep' })
    const rows = [
      ['Mohamed Alaoui', '0622', 'F1', '', '', '5000'],
      ['Mohamed Alaoui', '0622', 'F2', '', '', ''],
      ['Mohamed Alaoui', '0999', 'F3', '33', '-7', ''],
      ['Voisin', '', 'P1', '', '', '', 'prospect'],
    ]
    const { customers: incoming } = rowsToIncoming(rows, { customerName: 0, customerPhone: 1, farmName: 2, lat: 3, lng: 4, capacity: 5, status: 6 })
    const matches = matchCustomers(incoming, await listCustomers())
    expect(matches.map((m) => m.candidates.length)).toEqual([2, 2])

    // A matched customer without a decision is never attached or created.
    await expect(applyImport(incoming, {}, {})).rejects.toThrow(/decision/i)
    expect(await listFarms()).toHaveLength(1)

    const [k1, k2] = incoming.map((c) => c.key)
    const sum = await applyImport(incoming, { [k1]: { type: 'existing', customerId: b.id }, [k2]: { type: 'new' } }, { 2: 'update' })
    expect(sum).toMatchObject({ customersCreated: 1, farmsCreated: 3, farmsUpdated: 1, farmsSkipped: 0, missingLocation: 2 })

    const farms = await listFarms()
    const byName = Object.fromEntries(farms.map((f) => [f.name, f]))
    expect(farms).toHaveLength(4)
    expect(byName.F1).toMatchObject({ id: old.id, customerId: b.id, capacity: 5000, notes: 'keep', lat: 35, lng: -6 })
    expect(byName.F2.customerId).toBe(b.id)
    expect(byName.F3.customerId).not.toBe(a.id)
    expect(byName.F3.customerId).not.toBe(b.id)
    expect(byName.F3).toMatchObject({ lat: 33, lng: -7, locationSource: 'import', locationStatus: 'ok' })
    expect(byName.P1).toMatchObject({ customerId: null, ownerName: 'Voisin', status: 'prospect', locationStatus: 'missing' })
    expect(farms.some((f) => f.customerId === a.id)).toBe(false)
    expect(await listCustomers()).toHaveLength(3)
  })

  test('conflicting rows default to skip; per-row validation errors are reported, not fatal', async () => {
    const c = await saveCustomer({ name: 'C' })
    await saveFarm({ name: 'F1', customerId: c.id, status: 'customer' })
    const incoming = [{
      key: 'k', name: 'C', phone: '', region: '', status: 'customer',
      farms: [
        { row: 2, name: 'F1', lat: null, lng: null, locationStatus: 'missing', capacity: null, address: '', region: '', notes: '', status: 'customer' },
        { row: 3, name: 'F9', lat: 999, lng: 0, locationStatus: 'ok', capacity: null, address: '', region: '', notes: '', status: 'customer' },
        { row: 4, name: 'F10', lat: null, lng: null, locationStatus: 'missing', capacity: null, address: '', region: '', notes: '', status: 'customer' },
      ],
    }]
    const sum = await applyImport(incoming, { k: { type: 'existing', customerId: c.id } }, {})
    expect(sum).toMatchObject({ customersCreated: 0, farmsCreated: 1, farmsUpdated: 0, farmsSkipped: 2, missingLocation: 1 })
    expect(sum.errors).toHaveLength(1)
    expect(sum.errors[0].row).toBe(3)
    expect(sum.errors[0].message).toBeTruthy()
    expect(sum.errors[0].field).toBe('location')
    expect(await listFarms()).toHaveLength(2)
  })
})

describe('fix round 1', () => {
  test('bad lat/lng falls back to a valid coordinates column, with a rowError', () => {
    const rows = [
      ['C', 'F1', 'abc', '-6.1', '35.2, -6.2'],
      ['C', 'F2', 'abc', '-6.1', 'https://maps.app.goo.gl/DEMOLINK0000000001'],
    ]
    const { customers, rowErrors } = rowsToIncoming(rows, { customerName: 0, farmName: 1, lat: 2, lng: 3, coordinates: 4 })
    expect(customers[0].farms[0]).toMatchObject({ lat: 35.2, lng: -6.2, locationStatus: 'ok' })
    expect(customers[0].farms[1]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
    expect(rowErrors.map((e) => [e.row, e.code])).toEqual([[2, 'bad-latlng'], [3, 'bad-coordinates']])
  })

  test('update keeps an existing verify flag unless coordinates change or the row says verify', async () => {
    const c = await saveCustomer({ name: 'C' })
    const a = await saveFarm({ name: 'A', customerId: c.id, status: 'customer', lat: 35, lng: -6, locationStatus: 'verify', locationSource: 'map' })
    const b = await saveFarm({ name: 'B', customerId: c.id, status: 'customer', lat: 35.1, lng: -6, locationStatus: 'verify' })
    const d = await saveFarm({ name: 'D', customerId: c.id, status: 'customer', lat: 35.2, lng: -6, locationStatus: 'ok' })
    const rows = [
      ['C', 'A', 35, -6, '50', null], // same coords, no verify: stays verify
      ['C', 'B', 35.15, -6, null, null], // coords changed: ok
      ['C', 'D', 35.2, -6, null, 'yes'], // explicit verify: verify
    ]
    const { customers: incoming } = rowsToIncoming(rows, { customerName: 0, farmName: 1, lat: 2, lng: 3, capacity: 4, verify: 5 })
    const sum = await applyImport(incoming, { [incoming[0].key]: { type: 'existing', customerId: c.id } }, { 2: 'update', 3: 'update', 4: 'update' })
    expect(sum.farmsUpdated).toBe(3)
    const byId = Object.fromEntries((await listFarms()).map((f) => [f.id, f]))
    expect(byId[a.id]).toMatchObject({ locationStatus: 'verify', locationSource: 'map', capacity: 50 })
    expect(byId[b.id]).toMatchObject({ locationStatus: 'ok', lat: 35.15, locationSource: 'import' })
    expect(byId[d.id]).toMatchObject({ locationStatus: 'verify' })
  })

  test('in-file 100 m check covers farms of different incoming customers; same-name stays per customer', () => {
    const incoming = [
      { key: 'a', name: 'A', status: 'customer', farms: [{ row: 2, name: 'Ferme', lat: 30, lng: -7, status: 'customer', ownerName: '' }] },
      { key: 'b', name: 'B', status: 'customer', farms: [
        { row: 3, name: 'Ferme', lat: 31, lng: -7, status: 'customer', ownerName: '' },
        { row: 4, name: 'Other', lat: 30.0003, lng: -7, status: 'customer', ownerName: '' },
      ] },
    ]
    const res = findImportConflicts(incoming, [], {})
    expect(res.map((r) => [r.row, r.kind, r.existing.row])).toEqual([[4, 'nearby', 2]])
  })

  // Brute-force reference with the same semantics, for comparison.
  function ownerKeyOf(f, targetId, groupKey) {
    if (f.status === 'customer') return targetId ? `c:${targetId}` : `n:${groupKey}`
    return `o:${normalizeName(f.ownerName)}`
  }
  function existingOwnerKey(e) {
    return e.customerId ? `c:${e.customerId}` : `o:${normalizeName(e.ownerName)}`
  }
  function bruteForce(incoming, existing, decisions) {
    const all = []
    for (const c of incoming) {
      const d = decisions[c.key]
      const t = c.status === 'customer' && d?.type === 'existing' ? d.customerId : null
      for (const f of c.farms) all.push({ f, ok: ownerKeyOf(f, t, c.key) })
    }
    all.sort((x, y) => x.f.row - y.f.row)
    const out = []
    all.forEach(({ f, ok }, i) => {
      const others = [
        ...existing.map((e) => ({ e, ok: existingOwnerKey(e) })),
        ...all.slice(0, i).map((x) => ({ e: { ...x.f, inFile: true }, ok: x.ok })),
      ]
      for (const { e, ok: eok } of others) {
        const id = e.id ?? `row${e.row}`
        if (eok === ok && normalizeName(e.name) === normalizeName(f.name)) out.push({ row: f.row, kind: 'same-name', id })
        else if (typeof f.lat === 'number' && typeof e.lat === 'number') {
          const m = Math.round(haversineKm(f, e) * 1000)
          if (m <= 100) out.push({ row: f.row, kind: 'nearby', id, distanceM: m })
        }
      }
    })
    return out
  }
  const canon = (list) => list
    .map((r) => `${r.row}|${r.kind}|${r.id ?? r.existing.id ?? `row${r.existing.row}`}|${r.distanceM ?? ''}`)
    .sort()

  function makeData(nExisting, nIncoming, spread, seed = 1) {
    let s = seed
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
    const existing = Array.from({ length: nExisting }, (_, i) => ({
      id: `e${i}`, name: `Farm ${i % 300}`, customerId: i % 5 === 0 ? null : `c${i % 40}`, ownerName: i % 5 === 0 ? `Owner ${i % 7}` : '',
      status: i % 5 === 0 ? 'prospect' : 'customer',
      lat: i % 11 === 0 ? null : 35 + rnd() * spread, lng: i % 11 === 0 ? null : -6 + rnd() * spread,
    }))
    const incoming = []
    for (let g = 0; g < 50; g++) {
      const status = g % 6 === 0 ? 'prospect' : 'customer'
      incoming.push({ key: `k${g}`, name: status === 'customer' ? `Cust ${g}` : `Owner ${g % 7}`, status, farms: [] })
    }
    for (let i = 0; i < nIncoming; i++) {
      const c = incoming[i % 50]
      const located = i % 9 !== 0
      c.farms.push({
        row: i + 2, name: `Farm ${(i * 7) % 300}`, status: c.status, ownerName: c.status === 'customer' ? '' : c.name,
        lat: located ? 35 + rnd() * spread : null, lng: located ? -6 + rnd() * spread : null,
      })
    }
    const decisions = {}
    incoming.forEach((c, g) => { if (c.status === 'customer' && g % 2 === 0) decisions[c.key] = { type: 'existing', customerId: `c${g % 40}` } })
    return { existing, incoming, decisions }
  }

  test('matches a brute-force reference on a dense sample', () => {
    const { existing, incoming, decisions } = makeData(300, 200, 0.01)
    const fast = findImportConflicts(incoming, existing, decisions)
    const ref = bruteForce(incoming, existing, decisions)
    expect(ref.length).toBeGreaterThan(50)
    expect(ref.some((r) => r.kind === 'same-name')).toBe(true)
    expect(ref.some((r) => r.kind === 'nearby')).toBe(true)
    expect(canon(fast)).toEqual(canon(ref))
  })

  test('2,000 incoming rows vs 2,000 existing farms in well under a second', () => {
    const { existing, incoming, decisions } = makeData(2000, 2000, 0.5, 7)
    const t0 = performance.now()
    const res = findImportConflicts(incoming, existing, decisions)
    const ms = performance.now() - t0
    console.log(`findImportConflicts 2000x2000: ${ms.toFixed(1)} ms, ${res.length} conflicts`)
    expect(ms).toBeLessThan(1000)
    expect(res.length).toBeGreaterThan(0)
  })
})

test('coordinates column: ambiguous comma pair "35,4" is not imported as a position', () => {
  const rows = [
    ['C', 'F1', '35,4'],
    ['C', 'F2', '35,41'],
    ['C', 'F3', '34.5185, -5.62'],
  ]
  const { customers, rowErrors } = rowsToIncoming(rows, { customerName: 0, farmName: 1, coordinates: 2 })
  const f = customers[0].farms
  expect(f[0]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
  expect(f[1]).toMatchObject({ lat: null, lng: null, locationStatus: 'missing' })
  expect(f[2]).toMatchObject({ lat: 34.5185, lng: -5.62, locationStatus: 'ok' })
  expect(rowErrors.map((e) => e.code)).toEqual(['bad-coordinates', 'bad-coordinates'])
})
