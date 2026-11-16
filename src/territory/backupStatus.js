// Backup reminder helpers. Kept free of xlsx so Layout stays in the small main chunk.
import { getDB } from '../db.js'
import { countDailyReports } from '../lib/dailyReportsStorage.js'

const DAY = 86400000

export async function getBackupStatus() {
  const db = await getDB()
  const lastBackupAt = (await db.get('settings', 'lastBackupAt'))?.value ?? null
  const counts = await Promise.all(['customers', 'farms', 'orders'].map((s) => db.count(s)))
  let hasData = counts.some((n) => n > 0)
  if (!hasData) hasData = (await countDailyReports()) > 0
  return { lastBackupAt, hasData }
}

export function backupAgeDays(lastBackupAt, now = new Date()) {
  if (!lastBackupAt) return null
  const t = new Date(lastBackupAt).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY))
}

// Days to show in the reminder chip, Infinity when never backed up, null when no chip.
export function backupReminderDays({ lastBackupAt, hasData }, now = new Date()) {
  if (!hasData) return null
  if (!lastBackupAt) return Infinity
  const t = new Date(lastBackupAt).getTime()
  if (Number.isNaN(t)) return Infinity
  return now.getTime() - t > 7 * DAY ? Math.floor((now.getTime() - t) / DAY) : null
}
