import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, getAuthUser } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/city-unlocks — the caller's unlocked city ids (string[]).
 * Identity from the Bearer token only; no token → [] (signed out).
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json([])
  const snap = await adminDb().collection('cityUnlocks').where('userId', '==', user.uid).get()
  const cityIds = snap.docs.map(d => d.data().cityId).filter((c): c is string => typeof c === 'string')
  return NextResponse.json(cityIds, { headers: { 'Cache-Control': 'private, no-store' } })
})
