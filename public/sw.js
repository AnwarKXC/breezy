// public/sw.js - Service Worker with caching strategies (registered in production only)

// Bump the version to drop every previously cached response on activate.
const STATIC_CACHE = 'hotel-ms-static-v3'
const DYNAMIC_CACHE = 'hotel-ms-dynamic-v3'

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed for some URLs:', err)
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request))
    return
  }

  if (isStaticResource(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse
    throw error
  }
}

async function networkFirstWithOffline(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) return cachedResponse

    const offlineResponse = await caches.match('/offline')
    if (offlineResponse) return offlineResponse

    return new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
    })
  }
}

async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    // Background refresh: a failure (offline, server restart) must not surface
    // as an unhandled rejection; the cached response was already served.
    fetchAndCache(request).catch(() => {})
    return cachedResponse
  }
  return fetchAndCache(request)
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    // Background refresh: a failure (offline, server restart) must not surface
    // as an unhandled rejection; the cached response was already served.
    fetchAndCache(request).catch(() => {})
    return cachedResponse
  }

  return fetchAndCache(request)
}

const MAX_DYNAMIC_CACHE_ENTRIES = 100

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map((key) => cache.delete(key)))
  }
}

async function fetchAndCache(request) {
  const networkResponse = await fetch(request)
  if (networkResponse.ok) {
    const cache = await caches.open(DYNAMIC_CACHE)
    cache.put(request, networkResponse.clone())
    void trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ENTRIES)
  }
  return networkResponse
}

function isStaticResource(pathname) {
  return (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  )
}

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Hotel Management</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    h1 { color: #1f2937; margin-bottom: 1rem; }
    p { color: #6b7280; margin-bottom: 1.5rem; }
    button { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>Please check your internet connection and try again.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`
