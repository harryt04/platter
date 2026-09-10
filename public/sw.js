const CACHE = 'platter-shell-v1'
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
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/')
  )
    return
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .match(request)
        .then((response) => response ?? caches.match('/offline')),
    ),
  )
})
