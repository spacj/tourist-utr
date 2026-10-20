import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { createOrder } from '@/lib/paypal'
import { cityPriceEuros, isCityUnlocked } from '@/lib/cityUnlock'
import { encodeCustomId, siteOrigin } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/city-unlocks/checkout  { cityId }
 * Auth: Bearer ID token (guests/anonymous allowed — the unlock binds to the
 * uid, which survives account linking). Price comes from the city doc only.
 */
export const POST = handle(async (req: NextRequest) => {
  // A city pass must survive a cleared browser, so it needs a real account.
  const user = await requireUser(req, { registered: true })
  rateLimit(`checkout:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const cityId = id(body.cityId, 'cityId')

  const citySnap = await adminDb().collection('cities').doc(cityId).get()
  if (!citySnap.exists) throw new HttpError(404, 'city_not_found')
  const city = citySnap.data() ?? {}

  if (await isCityUnlocked(user.uid, cityId)) throw new HttpError(409, 'already_unlocked')

  const amount = cityPriceEuros(city).toFixed(2)
  const origin = siteOrigin()
  const name = typeof city.name === 'string' ? city.name.slice(0, 60) : cityId

  const { approvalUrl } = await createOrder({
    amountEur: amount,
    description: `TourHunts — Unlock ${name}`,
    returnUrl: `${origin}/api/city-unlocks/capture?cityId=${encodeURIComponent(cityId)}`,
    cancelUrl: `${origin}/city/${encodeURIComponent(cityId)}?paypal=cancelled`,
    customId: encodeCustomId({ kind: 'city_unlock', uid: user.uid, cityId }),
  })

  return NextResponse.json({ url: approvalUrl })
})
