/* ═══════════════════════════════════════════════════════════════
   TourHunts — Service Worker
   Precaches shell, caches pages offline, persists hunt data.
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'tourhunts-v4'
const HUNT_CACHE_NAME = 'tourhunts-hunts-v1'
const API_CACHE_NAME = 'tourhunts-api-v1'
const HUNT_PAGE_CACHE_NAME = 'tourhunts-hunt-pages-v1'
const OFFLINE_PAGE = '/offline.html'

// Assets that are precached on SW install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/offline.html',
]

// Font & chunk patterns — cache-first, long-lived
const ASSET_PATTERNS = [
  /_next\/static\//,       // JS chunks, CSS
  /_next\/image/,          // Next.js image optimization
  /_next\/font/,           // Fonts
  /\.(woff2?|ttf|otf)$/,   // Font files
  /\.(png|jpe?g|gif|svg|webp|ico)$/,  // Images
]

// Page routes — network-first, fallback to cache
const PAGE_PATTERNS = [
  /^\/$/,                            // Homepage
  /^\/city\/[^/]+$/,                // City detail
  /^\/multiplayer(\/[^/]+)?$/,      // Multiplayer
  /^\/profile$/,                    // Profile
]

// Read-only API routes — network-first with cache fallback so the
// app remains browsable when offline (homepage countries, city hunts, etc.).
const READ_API_PATTERNS = [
  /^\/api\/countries(\?.*)?$/,
  /^\/api\/cities(\?.*)?$/,
  /^\/api\/hunts(\?.*)?$/,
  /^\/api\/city-unlocks(\?.*)?$/,
  /^\/api\/user-progress(\?.*)?$/,
  /^\/api\/user-history(\?.*)?$/,
  /^\/api\/leaderboard(\?.*)?$/,
  /^\/api\/session-credits(\?.*)?$/,
  /^\/api\/rooms\/(active|get|results)(\?.*)?$/,
]

// Write/realtime API routes — never cache, always go to network.
const API_PATTERNS = [
  /^\/api\//,
]

// Hunt page — network-first with IndexedDB fallback
const HUNT_PATTERN = /^\/hunt(\?.*)?$/

// Complete page — network-first
const COMPLETE_PATTERN = /^\/hunt\/complete(\?.*)?$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== HUNT_CACHE_NAME && k !== API_CACHE_NAME && k !== HUNT_PAGE_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests on same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Read-only APIs: network-first with cache fallback so offline users
  // still see countries/hunts/cities they've previously visited.
  if (READ_API_PATTERNS.some(p => p.test(url.pathname + url.search))) {
    event.respondWith(networkFirstCache(request, API_CACHE_NAME))
    return
  }

  // Other APIs (writes, realtime): network-only
  if (API_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkOnly(request))
    return
  }

  // Hunt page: try network, fall back to IndexedDB cached hunt data
  if (HUNT_PATTERN.test(url.pathname)) {
    event.respondWith(huntFallback(request, url))
    return
  }

  // Page routes: network-first, cache on success
  if (PAGE_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(networkFirstCache(request, CACHE_NAME))
    return
  }

  // Static assets: cache-first
  if (ASSET_PATTERNS.some(p => p.test(url.pathname))) {
    event.respondWith(cacheFirst(request, CACHE_NAME))
    return
  }

  // Default: network-first for any remaining pages
  event.respondWith(networkFirstCache(request, CACHE_NAME))
})

// ── Message handler: cache hunt data ──────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_HUNT') {
    const { huntId, huntData, clues } = event.data
    event.waitUntil(
      caches.open(HUNT_CACHE_NAME).then((cache) => {
        const response = new Response(
          JSON.stringify({ hunt: huntData, clues }),
          { headers: { 'Content-Type': 'application/json' } }
        )
        return cache.put(`/__hunt__/${huntId}`, response)
      })
    )
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Cache strategies ──────────────────────────────────────────

async function networkOnly(request) {
  return fetch(request)
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 404 })
  }
}

async function networkFirstCache(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Final fallback: offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
      const offline = await caches.match(OFFLINE_PAGE)
      if (offline) return offline
    }
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function huntFallback(request, url) {
  // Try network and cache the response on success. This is what lets the
  // user navigate to /hunt?session=X offline — we serve the previously
  // cached HTML so the React app can boot, hydrate from Firestore's
  // IndexedDB cache, and pick up where they left off.
  try {
    const response = await fetch(request)
    if (response.ok) {
      try {
        const cache = await caches.open(HUNT_PAGE_CACHE_NAME)
        await cache.put(request, response.clone())
      } catch {}
      return response
    }
  } catch {}

  // Offline: serve the cached HTML for this exact URL if we have it.
  const cached = await caches.match(request, { cacheName: HUNT_PAGE_CACHE_NAME })
  if (cached) return cached
  // Some Next.js navigations append _rsc=... params we cached separately —
  // try a URL-stripped lookup as a fallback.
  const fallbackUrl = new URL(request.url)
  fallbackUrl.searchParams.delete('_rsc')
  const fallbackReq = new Request(fallbackUrl.toString(), { headers: request.headers })
  const cachedFallback = await caches.match(fallbackReq, { cacheName: HUNT_PAGE_CACHE_NAME })
  if (cachedFallback) return cachedFallback

  // Last fallback: render a static HTML view from IndexedDB-cached clue data.
  const sessionId = url.searchParams.get('session')
  if (sessionId) {
    const allCaches = await caches.keys()
    if (allCaches.includes(HUNT_CACHE_NAME)) {
      const huntCache = await caches.open(HUNT_CACHE_NAME)
      const keys = await huntCache.keys()
      for (const key of keys) {
        const resp = await huntCache.match(key)
        if (resp) {
          const data = await resp.json()
          return buildOfflineHuntPage(sessionId, data)
        }
      }
    }
  }

  return caches.match(OFFLINE_PAGE).then(r => r || new Response('Offline', { status: 503 }))
}

function buildOfflineHuntPage(sessionId, data) {
  const { hunt, clues } = data
  const clueList = JSON.stringify(clues || []).replace(/</g, '\\u003c')
  const huntName = hunt?.title || 'Hunt'
  const huntCity = hunt?.city || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${huntName} — Offline</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0d1a;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}
.card{max-width:400px;background:#1a1d2e;border-radius:20px;padding:32px 24px;border:1px solid rgba(255,255,255,0.1)}
.icon{font-size:48px;margin-bottom:12px}
h1{font-size:22px;margin:0 0 8px}
p{font-size:14px;color:rgba(255,255,255,0.7);margin:0 0 20px;line-height:1.5}
.btn{display:inline-block;padding:14px 24px;background:#ff6a13;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none}
.btn:hover{background:#ff8a3d}
.clues{margin-top:20px;text-align:left;background:rgba(255,255,255,0.05);border-radius:12px;padding:16px;max-height:300px;overflow-y:auto}
.clue{padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)}
.clue:last-child{border-bottom:none}
.clue-name{font-weight:600;font-size:14px}
.clue-riddle{font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;line-height:1.5}
</style>
</head>
<body>
<div class="card">
  <div class="icon">📡</div>
  <h1>You're offline</h1>
  <p>Showing cached clues for <strong>${huntName}</strong>. GPS navigation works without data.</p>
  <a href="/" class="btn">Back to Home</a>
  <div class="clues" id="clues"></div>
</div>
<script>
try{
  var clues=${clueList};
  var el=document.getElementById('clues');
  if(clues&&clues.length){
    clues.sort(function(a,b){return(a.order||0)-(b.order||0)});
    clues.forEach(function(c,i){
      var d=document.createElement('div');
      d.className='clue';
      d.innerHTML='<div class="clue-name">'+(i+1)+'. '+(c.locationName||'Stop '+(i+1))+'</div>'
        +'<div class="clue-riddle">'+(c.riddle||'')+'</div>';
      el.appendChild(d);
    });
  }
}catch(e){}
</script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
