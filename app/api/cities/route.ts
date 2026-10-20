import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, optionalId } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

const CACHE = 'public, s-maxage=60, stale-while-revalidate=300'

/** GET /api/cities[?countryId=X] — public list of active cities, sorted by `order`. */
export const GET = handle(async (req) => {
  const countryId = optionalId(req.nextUrl.searchParams.get('countryId'), 'countryId')
  const snap = await adminDb().collection('cities').where('active', '==', true).get()
  // Legacy cities without a countryId default to the Netherlands.
  let cities = snap.docs.map(d => ({ id: d.id, ...d.data(), countryId: d.data().countryId ?? 'nl' })) as any[]
  if (countryId) cities = cities.filter(c => c.countryId === countryId)
  cities.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return NextResponse.json(cities, { headers: { 'Cache-Control': CACHE } })
})
