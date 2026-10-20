import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, oneOf, rateLimit, HttpError } from '@/lib/apiAuth'
import { CREDIT_PACKAGES } from '@/types'
import { createOrder } from '@/lib/paypal'
import { encodeCustomId, siteOrigin } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/purchases/checkout  { sessionId, packageId }
 * Auth: Bearer ID token (guests allowed). Credits belong to the session, which
 * must belong to the caller. Price comes from CREDIT_PACKAGES only.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req)
  rateLimit(`checkout:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const packageId = oneOf(body.packageId, 'packageId', CREDIT_PACKAGES.map(p => p.id))
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)!

  const sessionSnap = await adminDb().collection('sessions').doc(sessionId).get()
  if (!sessionSnap.exists) throw new HttpError(404, 'session_not_found')
  if (sessionSnap.data()?.userId !== user.uid) throw new HttpError(403, 'not_your_session')

  const origin = siteOrigin()
  const sid = encodeURIComponent(sessionId)

  const { approvalUrl } = await createOrder({
    amountEur: (pkg.priceCents / 100).toFixed(2),
    description: `TourHunts — ${pkg.label}`,
    returnUrl: `${origin}/api/purchases/capture?session=${sid}`,
    cancelUrl: `${origin}/hunt?session=${sid}`,
    customId: encodeCustomId({ kind: 'credit_pack', uid: user.uid, sessionId, packageId }),
  })

  return NextResponse.json({ url: approvalUrl })
})
