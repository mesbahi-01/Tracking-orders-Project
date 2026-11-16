const CACHE_NAME = 'tracking-orders-cache-v2'
// v2: v1 could hold opaque (no-CORS) tiles, which Chrome pads to ~7 MB each in quota.
const TILE_CACHE = 'map-tiles-v2'
const TILE_MAX = 2000
const TILE_KEEP = 1800
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
]

function isTileHost(host) {
  return host === 'tile.openstreetmap.org' ||
    host.endsWith('.tile.openstreetmap.org') ||
    host === 'server.arcgisonline.com'
}

function isNominatim(host) {
  return host === 'nominatim.openstreetmap.org'
}

let trimming = false
async function trimTiles(cache) {
  if (trimming) return
  trimming = true
  try {
    const keys = await cache.keys()
    if (keys.length > TILE_MAX) {
      const excess = keys.length - TILE_KEEP
      for (let i = 0; i < excess; i++) await cache.delete(keys[i])
    }
  } finally {
    trimming = false
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k))
    ))
  )
})

async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  let res
  try {
    res = await fetch(req)
  } catch {
    // offline and not cached: a network error, not an unhandled rejection
    return Response.error()
  }
  // Only real CORS responses: opaque ones cannot be checked and cost ~7 MB of quota each.
  if (res && res.ok && res.type !== 'opaque') {
    await cache.put(req, res.clone()).catch(() => {})
    trimTiles(cache).catch(() => {})
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  // only handle GET requests
  if (req.method !== 'GET') return

  let url
  try { url = new URL(req.url) } catch { return }

  // Geocoding must always hit the network directly
  if (isNominatim(url.hostname)) return

  if (isTileHost(url.hostname)) {
    event.respondWith(tileFirst(req))
    return
  }

  // Network-first with cache fallback for everything else
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok && url.protocol.startsWith('http')) {
        const resClone = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone)).catch(() => {})
      }
      return res
    }).catch(async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html')
        if (shell) return shell
      }
      return Response.error()
    })
  )
})
