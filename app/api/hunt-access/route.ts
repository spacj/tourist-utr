import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, getAuthUser } from '@/lib/apiAuth'
import { freeHuntIdOf, userRef } from '@/lib/huntAccess'
import type { HuntAccessSummary } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/hunt-access → HuntAccessSummary — what the caller may play.
 * Identity from the Bearer token only (guests: their anonymous uid).
 * No token → a fresh visitor: free hunt available, nothing owned.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getAuthUser(req)
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!user) {
    const empty: HuntAccessSummary = { freeHuntId: null, freeAvailable: true, owned: [], cityPasses: [] }
    return NextResponse.json(empty, { headers })
  }
  const db = adminDb()
  const [u, hunts, cities] = await Promise.all([
    userRef(user.uid).get(),
    db.collection('huntUnlocks').where('userId', '==', user.uid).get(),
    db.collection('cityUnlocks').where('userId', '==', user.uid).get(),
  ])
  const freeHuntId = freeHuntIdOf(u.data())
  const body: HuntAccessSummary = {
    freeHuntId,
    freeAvailable: !freeHuntId,
    owned: hunts.docs.map(d => d.data().huntId).filter((h): h is string => typeof h === 'string'),
    cityPasses: cities.docs.map(d => d.data().cityId).filter((c): c is string => typeof c === 'string'),
  }
  return NextResponse.json(body, { headers })
})
