const DB_NAME = 'tracking-orders-db'
const STORE_NAME = 'daily-reports'
const FALLBACK_KEY = 'daily-reports'

function getFallbackReports() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawValue = window.localStorage.getItem(FALLBACK_KEY)

    if (!rawValue) {
      return []
    }

    return JSON.parse(rawValue)
  } catch (error) {
    console.warn('Unable to load fallback reports', error)
    return []
  }
}

function saveFallbackReports(reports) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(reports))
}

function openDb() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('indexedDB unavailable'))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadDailyReports() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const db = await openDb()

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn('IndexedDB unavailable, using localStorage fallback', error)
    return getFallbackReports()
  }
}

export async function saveDailyReports(reports) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const db = await openDb()

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      store.clear()

      reports.forEach((report) => {
        store.put(report)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch (error) {
    console.warn('Unable to save to IndexedDB, using localStorage fallback', error)
    saveFallbackReports(reports)
  }
}

export function createDailyReportId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function formatDisplayDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}