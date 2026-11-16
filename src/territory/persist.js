// Asks the browser to keep this site's storage (IndexedDB is the only copy of the
// data) out of automatic eviction. Asked at most once per page load; never throws.
let asked = null

export function requestPersistentStorage() {
  if (!asked) {
    asked = (async () => {
      try {
        const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
        if (!storage || typeof storage.persist !== 'function') return false
        if (typeof storage.persisted === 'function' && (await storage.persisted())) return true
        return (await storage.persist()) === true
      } catch {
        return false
      }
    })()
  }
  return asked
}

export function _resetPersistForTests() { asked = null }
