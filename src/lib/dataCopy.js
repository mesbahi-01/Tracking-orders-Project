import { getDB } from '../db'
import { loadDailyReports } from './dailyReportsStorage'

// Read-only safety copy of everything this app stores on the device.
// Never writes, never changes the database version.

const EXCLUDED_KEYS = ['auth_user'] // holds the login password

function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function readLocalStorage() {
  const out = {}
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key && !EXCLUDED_KEYS.includes(key)) out[key] = window.localStorage.getItem(key)
  }
  return out
}

export async function buildDataCopy(appVersion) {
  const db = await getDB()
  const orders = await db.getAll('orders') // whole store, not an index: no record can be skipped
  const dailyReports = await loadDailyReports()
  return {
    format: 'tracking-orders-data-copy',
    formatVersion: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    counts: { orders: orders.length, dailyReports: dailyReports.length },
    orders,
    dailyReports,
    localStorage: readLocalStorage()
  }
}

export async function downloadDataCopy(appVersion) {
  const copy = await buildDataCopy(appVersion)
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tracking-orders-copy-${localDate()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return copy.counts
}
