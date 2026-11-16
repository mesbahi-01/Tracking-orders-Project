import { test, expect, beforeEach, vi } from 'vitest'
import * as XLSX from 'xlsx'

vi.mock('../lib/dailyReportsStorage.js', async (importOriginal) => {
  const orig = await importOriginal()
  return { ...orig, saveDailyReports: vi.fn(orig.saveDailyReports) }
})

const { saveDailyReports } = await import('../lib/dailyReportsStorage.js')
const { getDB } = await import('../db.js')
const { getSetting } = await import('./store.js')
const { buildBackup, parseBackup, restoreBackup, RestoreError } = await import('./backup.js')
const { resetAll } = await import('../test/resetDbs.js')

beforeEach(resetAll)

test('replace: a daily-reports failure after the main write is reported as reports-partial and lastBackupAt is not set', async () => {
  const data = {
    customers: [{ id: 'c1', name: 'A', nameKey: 'a', phone: '', email: '', region: '', address: '', notes: '', createdAt: '2026-11-16T10:00:00.000Z', updatedAt: '2026-11-16T10:00:00.000Z' }],
    farms: [], orders: [],
    dailyReports: [{ id: 'r1', date: '2026-11-15', client: 'A', customerId: 'c1', notes: '' }],
  }
  const wb = buildBackup(data, { appVersion: '0.8.0', exportedAt: '2026-11-16T12:00:00.000Z' })
  const parsed = parseBackup(XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' }))
  saveDailyReports.mockRejectedValueOnce(new Error('quota'))
  const err = await restoreBackup(parsed, 'replace').catch((e) => e)
  expect(err).toBeInstanceOf(RestoreError)
  expect(err.code).toBe('reports-partial')
  expect(await (await getDB()).get('customers', 'c1')).toEqual(data.customers[0])
  expect(await getSetting('lastBackupAt')).toBeUndefined()
  // tapping Restore again completes it
  await restoreBackup(parsed, 'replace')
  expect(await getSetting('lastBackupAt')).toBe('2026-11-16T12:00:00.000Z')
})
