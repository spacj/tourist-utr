/* ═══════════════════════════════════════════════════════════════
   TourHunts — Service Worker
   Registered by hooks/useServiceWorker as /sw.js?v=<build id>.

   Strategies
   - App shell (offline page, icons): precached per build.
   - /_next/static, images, fonts: cache-first, capped (FIFO ≈ LRU).
   - Page navigations: network-first → cached page → /offline.html.
   - Public catalogue API (/api/countries|cities|hunts): stale-while-
     revalidate. Their responses are identical for every caller (the
     Authorization header our fetch helper always attaches is ignored by
     those routes), so they're safe to share. EVERY OTHER /api route is
     per-user or a write and is never cached.
   - OpenFreeMap style / TileJSON: stale-while-revalidate; tiles, sprites
     and glyphs: cache-first, capped — map areas seen online work offline.
   - "Save map for offline": {type:'PRECACHE_TILES', urls} (+ MessagePort
     for progress) stores tiles in a separate, larger cache.

   Updates: no automatic skipWaiting. A new worker waits until the page
   posts {type:'SKIP_WAITING'} (the "New version — Reload" banner).
   ═══════════════════════════════════════════════════════════════ */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev'

const SHELL_CACHE = `th-shell-${VERSION}`
const STATIC_CACHE = `th-static-${VERSION}`
const PAGES_CACHE = `th-pages-${VERSION}`
const API_CACHE = `th-api-${VERSION}`
// Map caches outlive deploys: tiles don't depend on our build.
const MAP_CACHE = 'th-map-v1'
const MAP_SAVED_CACHE = 'th-map-saved-v1'

const KEEP = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, API_CACHE, MAP_CACHE, MAP_SAVED_CACHE]

const LIMITS = {
  [STATIC_CACHE]: 150,
  [PAGES_CACHE]: 40,
  [API_CACHE]: 20,
  [MAP_CACHE]: 2000,
  [MAP_SAVED_CACHE]: 6000,
}

const OFFLINE_PAGE = '/offline.html'
const SHELL_URLS = [OFFLINE_PAGE, '/icon.svg', '/icon-192.png', '/manifest.json']

const MAP_ORIGIN = 'https://tiles.openfreemap.org'

const PUBLIC_API = new Set(['/api/countries', '/api/cities', '/api/hunts'])
const STATIC_EXT = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/i

// ── Lifecycle ─────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {})
  )
  // Intentionally no skipWaiting(): see header comment.
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((k) => (k.startsWith('th-') || k.startsWith('tourhunts-')) && !KEEP.includes(k))
        .map((k) => caches.delete(k))
    )
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (data.type === 'PRECACHE_TILES' && Array.isArray(data.urls)) {
    const port = event.ports && event.ports[0]
    event.waitUntil(precacheTiles(data.urls, port))
  }
})

// ── Routing ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Map: OpenFreeMap style, TileJSON, tiles, sprites, glyphs.
  if (url.origin === MAP_ORIGIN) {
    const isMetadata = url.pathname.startsWith('/styles/') || !/\.[a-z0-9]+$/i.test(url.pathname)
    event.respondWith(
      isMetadata
        ? staleWhileRevalidate(event, request, MAP_CACHE, request.url, MAP_SAVED_CACHE)
        : cacheFirst(request, MAP_CACHE, [MAP_SAVED_CACHE])
    )
    return
  }

  if (url.origin !== self.location.origin) return
  if (url.pathname === '/sw.js') return

  if (url.pathname.startsWith('/api/')) {
    // Public catalogue only. Keyed by URL alone (no headers) so the cached
    // entry never carries a caller's Authorization context.
    if (PUBLIC_API.has(url.pathname)) {
      event.respondWith(staleWhileRevalidate(event, request, API_CACHE, url.pathname + url.search))
    }
    return // everything else: straight to the network, never cached
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  // React Server Component payloads for client-side navigation: not cached.
  // If they fail offline, Next falls back to a full navigation, which the
  // page handler above serves from cache or /offline.html.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    STATIC_EXT.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, [SHELL_CACHE]))
  }
})

// ── Strategies ────────────────────────────────────────────────

/** Cache-first; also looks in `alsoIn` caches before hitting the network. */
async function cacheFirst(request, cacheName, alsoIn = []) {
  for (const name of [cacheName, ...alsoIn]) {
    const cache = await caches.open(name)
    const hit = await cache.match(request, { ignoreVary: true })
    if (hit) return hit
  }
  try {
    const response = await fetch(request)
    if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
      await putCapped(cacheName, request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' })
  }
}

/** Serve the cached copy at once (if any) and refresh it in the background. */
async function staleWhileRevalidate(event, request, cacheName, key, fallbackCache) {
  const cache = await caches.open(cacheName)
  const cached = (await cache.match(key, { ignoreVary: true }))
    || (fallbackCache ? await (await caches.open(fallbackCache)).match(key, { ignoreVary: true }) : undefined)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await putCapped(cacheName, key, response.clone())
      return response
    })
    .catch(() => null)

  if (cached) {
    event.waitUntil(network)
    return cached
  }
  const response = await network
  if (response) return response
  return new Response(JSON.stringify({ error: 'offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Pages: network-first, then the cached page, then the offline page. */
async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic' && !response.redirected) {
      await putCapped(PAGES_CACHE, stripRsc(request.url), response.clone())
    }
    return response
  } catch {
    const pages = await caches.open(PAGES_CACHE)
    const cached = await pages.match(stripRsc(request.url), { ignoreVary: true })
    if (cached) return cached
    const offline = await caches.match(OFFLINE_PAGE, { cacheName: SHELL_CACHE })
    return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}

function stripRsc(href) {
  const u = new URL(href)
  u.searchParams.delete('_rsc')
  return u.toString()
}

// ── Cache size caps (oldest-first eviction) ───────────────────

const putCounts = {}

async function putCapped(cacheName, key, response) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(key, response)
    const limit = LIMITS[cacheName]
    if (!limit) return
    // Listing a big cache is not free: check every few writes.
    putCounts[cacheName] = (putCounts[cacheName] || 0) + 1
    const every = limit > 500 ? 25 : 5
    if (putCounts[cacheName] % every !== 0) return
    const keys = await cache.keys()
    const excess = keys.length - limit
    for (let i = 0; i < excess; i++) await cache.delete(keys[i])
  } catch {
    // Quota exceeded or similar: caching is best-effort.
  }
}

// ── Save map for offline ──────────────────────────────────────

const MAX_PRECACHE = 3000
const PRECACHE_CONCURRENCY = 6

async function precacheTiles(rawUrls, port) {
  const urls = Array.from(new Set(rawUrls))
    .filter((u) => {
      try { return new URL(u).origin === MAP_ORIGIN } catch { return false }
    })
    .slice(0, MAX_PRECACHE)

  const total = urls.length
  let done = 0
  let failed = 0
  let bytes = 0
  const post = (type) => {
    try { port && port.postMessage({ type, done, total, failed, bytes }) } catch {}
  }

  const saved = await caches.open(MAP_SAVED_CACHE)
  const runtime = await caches.open(MAP_CACHE)
  let next = 0

  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      try {
        const existing = (await saved.match(url)) || (await runtime.match(url))
        if (existing) {
          // Promote into the saved cache so runtime eviction can't drop it.
          await saved.put(url, existing.clone())
        } else {
          const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
          if (!response.ok) throw new Error(String(response.status))
          const len = Number(response.headers.get('Content-Length')) || 0
          bytes += len
          await saved.put(url, response)
        }
      } catch {
        failed++
      }
      done++
      if (done % 5 === 0 || done === total) post('progress')
    }
  }

  post('progress')
  await Promise.all(Array.from({ length: PRECACHE_CONCURRENCY }, worker))
  // Keep the saved cache within its cap too.
  try {
    const keys = await saved.keys()
    const excess = keys.length - LIMITS[MAP_SAVED_CACHE]
    for (let i = 0; i < excess; i++) await saved.delete(keys[i])
  } catch {}
  post('done')
}
