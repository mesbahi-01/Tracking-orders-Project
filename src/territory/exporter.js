import * as XLSX from 'xlsx'
import { rowsToSheet, downloadWorkbook } from './xlsxIO.js'
import { customerTotals } from './customerStats.js'
import { customerLabeler } from './customerLabel.js'

// This module pulls in SheetJS: load it with a dynamic import() so xlsx stays
// out of the main bundle.

export const FARM_COLUMNS = ['Reference', 'Farm', 'Customer / Owner', 'Status', 'Region', 'Address', 'Latitude', 'Longitude', 'Location status', 'Capacity', 'Notes']
export const CUSTOMER_COLUMNS = ['Reference', 'Customer', 'Phone', 'Email', 'Region', 'Farms', 'Total capacity', 'Unknown capacity farms', 'Notes']

const ref = (id) => String(id ?? '').slice(0, 8)
const orNull = (v) => (v === null || v === undefined || v === '' ? null : v)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function book(sheetName, headers, rows) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, rowsToSheet(headers, rows), sheetName)
  return wb
}

export function farmsWorkbook(farms, customersById = {}) {
  const label = customerLabeler(Object.values(customersById))
  const rows = farms.map((f) => [
    ref(f.id),
    orNull(f.name),
    orNull((f.customerId && customersById[f.customerId] && label(customersById[f.customerId])) || f.ownerName),
    orNull(f.status),
    orNull(f.region),
    orNull(f.address),
    num(f.lat),
    num(f.lng),
    f.locationStatus || 'missing',
    num(f.capacity),
    orNull(f.notes),
  ])
  return book('Farms', FARM_COLUMNS, rows)
}

export function customersWorkbook(customers, farms) {
  const rows = customers.map((c) => {
    const t = customerTotals(farms, c.id)
    return [
      ref(c.id), orNull(c.name), orNull(c.phone), orNull(c.email), orNull(c.region),
      t.farmCount, t.known > 0 ? t.capacity : null, t.unknown, orNull(c.notes),
    ]
  })
  return book('Customers', CUSTOMER_COLUMNS, rows)
}

export function exportFilename(prefix, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${prefix}-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.xlsx`
}

export function downloadFarms(farms, customersById) {
  downloadWorkbook(farmsWorkbook(farms, customersById), exportFilename('farms'))
}

export function downloadCustomers(customers, farms) {
  downloadWorkbook(customersWorkbook(customers, farms), exportFilename('customers'))
}
