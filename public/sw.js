const CACHE_NAME = 'tracking-orders-cache-v1'
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  )
})

// Simple network-first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const req = event.request
  // only handle GET requests
  if (req.method !== 'GET') return

  event.respondWith(
    fetch(req).then(res => {
      // clone and cache
      const resClone = res.clone()
      caches.open(CACHE_NAME).then(cache => {
        cache.put(req, resClone)
      })
      return res
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  )
})
