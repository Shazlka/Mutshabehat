const CACHE = 'mutshabehat-v4'

// Next.js static assets (JS bundles, CSS, fonts) — content-hashed, safe forever.
const STATIC = /^\/_next\/static\//
// Quran reference API — static corpus (surah names, ayah lookups, search).
const QURAN_API = /^\/api\/quran/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
))

// Cache-first: serve from cache, fall back to network and store.
function cacheFirst(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) cache.put(request, res.clone())
        return res
      })
    })
  )
}

// Stale-while-revalidate: serve cache immediately, refresh in background.
// Falls back to cache when offline.
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => { if (res.ok) cache.put(request, res.clone()); return res })
        .catch(() => cached)
      return cached || network
    })
  )
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  if (STATIC.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request))
  } else if (QURAN_API.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(e.request))
  }
  // Everything else (page HTML, auth, user data) goes straight to network.
})
