import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

const CACHE = 'public, s-maxage=60, stale-while-revalidate=300'

/** GET /api/countries — public list of active countries, sorted by `order`. */
export const GET = handle(async () => {
  const snap = await adminDb().collection('countries').where('active', '==', true).get()
  const countries = snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as { id: string; order?: number })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return NextResponse.json(countries, { headers: { 'Cache-Control': CACHE } })
})
