import { describe, test, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { sheetRows } from './xlsxIO.js'
import { applyFarmFilters } from './filters.js'
import { allFarms, customers, customersById, seedFarms, prospectFarm } from './fixtures.js'
import { farmsWorkbook, customersWorkbook, exportFilename, FARM_COLUMNS, CUSTOMER_COLUMNS } from './exporter.js'

function roundTrip(wb, sheet) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return sheetRows(XLSX.read(buf, { type: 'array' }), sheet)
}

describe('farmsWorkbook', () => {
  test('farmsWorkbook columns and filtered rows', () => {
    expect(FARM_COLUMNS).toEqual(['Reference', 'Farm', 'Customer / Owner', 'Status', 'Region', 'Address', 'Latitude', 'Longitude', 'Location status', 'Capacity', 'Notes'])
    const filtered = applyFarmFilters(allFarms, customersById, { locationStatuses: ['verify'] })
    const wb = farmsWorkbook(filtered, customersById)
    expect(wb.SheetNames).toEqual(['Farms'])
    const { headers, rows } = roundTrip(wb, 'Farms')
    expect(headers).toEqual(FARM_COLUMNS)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['f3', 'مزرعة الواحة', 'Client Démo', 'customer', 'Région Test', null, 34.491295, -5.610422, 'verify', 40000, null])
  })

  test('reference is the first 8 characters of the id; owner name for prospects; missing location stays empty', () => {
    const farms = [
      { ...seedFarms[0], id: 'abcdef12-3456-7890-abcd-ef1234567890' },
      prospectFarm,
      allFarms[allFarms.length - 1],
    ]
    const { rows } = roundTrip(farmsWorkbook(farms, customersById), 'Farms')
    expect(rows[0][0]).toBe('abcdef12')
    expect(rows[1][2]).toBe('Voisin')
    expect(rows[1][3]).toBe('prospect')
    expect(rows[2].slice(6, 10)).toEqual([null, null, 'missing', null])
  })
})

describe('customersWorkbook', () => {
  test('columns and totals', () => {
    expect(CUSTOMER_COLUMNS).toEqual(['Reference', 'Customer', 'Phone', 'Email', 'Region', 'Farms', 'Total capacity', 'Unknown capacity farms', 'Notes'])
    const extra = { id: 'c2-longer-id', name: 'Sans fermes', nameKey: 'sans fermes', phone: '0611', email: 'a@b.c', region: '', notes: 'n' }
    const wb = customersWorkbook([...customers, extra], allFarms)
    expect(wb.SheetNames).toEqual(['Customers'])
    const { headers, rows } = roundTrip(wb, 'Customers')
    expect(headers).toEqual(CUSTOMER_COLUMNS)
    expect(rows[0]).toEqual(['c1', 'Client Démo', null, null, 'Région Test', 9, 233000, 1, null])
    expect(rows[1]).toEqual(['c2-longe', 'Sans fermes', '0611', 'a@b.c', null, 0, null, 0, 'n'])
  })
})

test('exportFilename uses the local date', () => {
  expect(exportFilename('farms', new Date(2026, 0, 5, 23, 30))).toBe('farms-2026-01-05.xlsx')
})

test('farm export tells same-name customers apart in "Customer / Owner" (M3)', () => {
  const byId = {
    a1: { id: 'a1', name: 'Mohamed Alaoui', nameKey: 'mohamed alaoui', phone: '0611', region: 'Asilah' },
    a2: { id: 'a2', name: 'Mohamed Alaoui', nameKey: 'mohamed alaoui', phone: '0622', region: '' },
  }
  const fs = [
    { id: 'f1', name: 'F1', customerId: 'a1', status: 'customer', locationStatus: 'missing' },
    { id: 'f2', name: 'F2', customerId: 'a2', status: 'customer', locationStatus: 'missing' },
    { id: 'f3', name: 'F3', customerId: null, ownerName: 'Owner', status: 'prospect', locationStatus: 'missing' },
  ]
  const { rows } = roundTrip(farmsWorkbook(fs, byId), 'Farms')
  const col = FARM_COLUMNS.indexOf('Customer / Owner')
  expect(rows.map((r) => r[col])).toEqual(['Mohamed Alaoui · 0611 · Asilah', 'Mohamed Alaoui · 0622', 'Owner'])
})
