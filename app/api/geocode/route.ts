import { NextResponse, type NextRequest } from 'next/server'
import { handle, requireAdmin, num, HttpError } from '@/lib/apiAuth'
import { SITE_URL, LEGAL } from '@/lib/site'

/**
 * GET /api/geocode?lat=&lng= — reverse geocoding for the admin spot editor.
 *
 * Proxies OpenStreetMap Nominatim server-side so we respect its usage policy:
 * an identifying User-Agent, at most one request per second, and caching.
 * Admin-only: nobody else needs it and it must not become an open proxy.
 */
const cache = new Map<string, { at: number; body: unknown }>()
const CACHE_MS = 24 * 60 * 60 * 1000
let lastCall = 0

export const GET = handle(async (req: NextRequest) => {
  await requireAdmin(req)
  const q = req.nextUrl.searchParams
  const lat = num(Number(q.get('lat')), 'lat', -90, 90)
  const lng = num(Number(q.get('lng')), 'lng', -180, 180)
  const lang = (q.get('lang') ?? 'en').slice(0, 5)

  // ~11 m grid — plenty for street + house number.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${lang}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body)

  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCall = Date.now()

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    {
      headers: {
        'User-Agent': `TourHunts/1.0 (${SITE_URL}; ${LEGAL.email})`,
        'Accept-Language': lang,
      },
      cache: 'no-store',
    },
  )
  if (!res.ok) throw new HttpError(502, 'geocode_failed')
  const data = await res.json()
  const body = { address: data?.address ?? {}, displayName: data?.display_name ?? null }
  cache.set(key, { at: Date.now(), body })
  if (cache.size > 2000) cache.delete(cache.keys().next().value as string)
  return NextResponse.json(body)
})
