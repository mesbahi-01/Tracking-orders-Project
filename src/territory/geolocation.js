const ERRORS = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }

export function getCurrentPosition({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geo) return resolve({ error: 'unsupported' })
    try {
      geo.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
        (err) => resolve({ error: ERRORS[err && err.code] || 'unavailable' }),
        { enableHighAccuracy: true, timeout: timeoutMs },
      )
    } catch {
      resolve({ error: 'unavailable' })
    }
  })
}
