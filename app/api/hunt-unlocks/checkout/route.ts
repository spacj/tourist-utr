import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { createOrder } from '@/lib/paypal'
import { getHuntAccess, isOwned } from '@/lib/huntAccess'
import { encodeCustomId, siteOrigin } from '@/lib/payments'
import { huntPriceEuros } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/hunt-unlocks/checkout  { huntId }  → { url }
 * Auth: registered (non-anonymous) account — a purchase must survive a
 * cleared browser. Price comes from the hunt doc only (huntPriceEuros).
 * 409 already_unlocked when the player already owns the hunt (bought, free
 * hunt spent on it, or a legacy city pass for its city).
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  rateLimit(`checkout:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const huntId = id(body.huntId, 'huntId')

  const snap = await adminDb().collection('hunts').doc(huntId).get()
  if (!snap.exists) throw new HttpError(404, 'hunt_not_found')
  const hunt = snap.data() ?? {}
  const cityId = typeof hunt.cityId === 'string' ? hunt.cityId : null
  if (hunt.active === false || !cityId) throw new HttpError(404, 'hunt_not_found')

  if (isOwned(await getHuntAccess(user.uid, { id: huntId, cityId }))) {
    throw new HttpError(409, 'already_unlocked')
  }

  const amount = huntPriceEuros(hunt).toFixed(2)
  const origin = siteOrigin()
  const title = typeof hunt.title === 'string' ? hunt.title.slice(0, 80) : huntId

  const { approvalUrl } = await createOrder({
    amountEur: amount,
    description: `TourHunts — ${title}`,
    returnUrl: `${origin}/api/hunt-unlocks/capture?huntId=${encodeURIComponent(huntId)}`,
    cancelUrl: `${origin}/city/${encodeURIComponent(cityId)}?paypal=cancelled&hunt=${encodeURIComponent(huntId)}`,
    customId: encodeCustomId({ kind: 'hunt_unlock', uid: user.uid, huntId }),
  })

  return NextResponse.json({ url: approvalUrl })
})
