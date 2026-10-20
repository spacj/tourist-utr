import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle } from '@/lib/apiAuth'

// Rendered per request (no build-time Firestore access); cached at the CDN.
export const dynamic = 'force-dynamic'

const CACHE = 'public, s-maxage=60, stale-while-revalidate=300'

/** GET /api/hunts — public catalogue of active hunts (top-level docs only, no clues). */
export const GET = handle(async () => {
  const snap = await adminDb().collection('hunts').where('active', '==', true).get()
  const hunts = snap.docs.map(d => {
    // rating/badge aren't part of the data model (GAME_DESIGN.md) — never ship them.
    const { rating: _rating, badge: _badge, ...data } = d.data() as Record<string, any>
    if (data.i18n && typeof data.i18n === 'object') {
      data.i18n = Object.fromEntries(Object.entries(data.i18n as Record<string, any>).map(
        ([lang, tr]) => {
          const { badge: _b, ...rest } = (tr ?? {}) as Record<string, unknown>
          return [lang, rest]
        },
      ))
    }
    // Never ship the mystery solution — accusations are graded in /api/accuse.
    if (data.mystery) {
      const { solution: _solution, ...mystery } = data.mystery
      data.mystery = mystery
    }
    return { id: d.id, ...data }
  })
  return NextResponse.json(hunts, { headers: { 'Cache-Control': CACHE } })
})
