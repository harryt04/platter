const CACHE = 'platter-shell-v2'
const STATIC_CACHE = 'platter-static-v1'
const PRIVATE_CACHE_PREFIX = 'platter-private-'

function privateCachePrefixForUser(userId) {
  return `${PRIVATE_CACHE_PREFIX}${encodeURIComponent(userId)}-`
}

function clearPrivateCaches(userId) {
  const cachePrefix = userId
    ? privateCachePrefixForUser(userId)
    : PRIVATE_CACHE_PREFIX
  return caches
    .keys()
    .then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix))
          .map((name) => caches.delete(name)),
      ),
    )
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'platter.clear-private-caches')
    event.waitUntil(clearPrivateCaches(event.data.userId))
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          '/offline',
          '/manifest.webmanifest',
          '/icons/platter.svg',
        ]),
      )
      .then(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            void caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
      }),
    )
    return
  }

  if (url.pathname.startsWith('/api/')) return

  // Private HTML is deliberately not cached. The offline route reads the
  // authenticated user's snapshot from their user-scoped Dexie database.
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .match(request)
        .then((response) => response ?? caches.match('/offline')),
    ),
  )
})
