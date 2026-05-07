import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { captureOrder } from '@/lib/paypal'
import { CITY_UNLOCK_PRICE_EUROS } from '@/types'
import { cityUnlockId } from '@/lib/cityUnlock'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get('cityId')
  const userId = req.nextUrl.searchParams.get('userId')
  const paypalToken = req.nextUrl.searchParams.get('token')

  if (!cityId || !userId || !paypalToken) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const unlockRef = doc(db, 'cityUnlocks', cityUnlockId(userId, cityId))

  // Idempotency — webhook might have written this already.
  const existing = await getDoc(unlockRef)
  if (existing.exists()) {
    return NextResponse.redirect(new URL(`/city/${cityId}?unlocked=1`, req.url))
  }

  const result = await captureOrder(paypalToken)
  if (!result.success) {
    return NextResponse.redirect(new URL(`/city/${cityId}?paypal=cancelled`, req.url))
  }

  // Security: verify the captured order's metadata matches the URL params.
  // Without this, an attacker could swap cityId/userId in the redirect URL
  // to grant a different unlock from their own paid order.
  const meta = result.metadata
  if (
    !meta ||
    meta.kind !== 'city_unlock' ||
    meta.cityId !== cityId ||
    meta.userId !== userId
  ) {
    // The capture went through on PayPal's side but the metadata doesn't
    // match — refuse to grant. The customer keeps their charge but we
    // don't grant access; investigate via PayPal dashboard if this happens.
    return NextResponse.redirect(new URL(`/city/${cityId}?paypal=mismatch`, req.url))
  }

  const citySnap = await getDoc(doc(db, 'cities', cityId))
  const priceEuros = (citySnap.data() as { priceEuros?: number } | undefined)?.priceEuros ?? CITY_UNLOCK_PRICE_EUROS

  await setDoc(unlockRef, {
    userId,
    cityId,
    paypalCaptureId: result.captureId ?? paypalToken,
    paypalOrderId: paypalToken,
    amountCents: Math.round(priceEuros * 100),
    completedAt: serverTimestamp(),
    grantedVia: 'redirect',
  })

  return NextResponse.redirect(new URL(`/city/${cityId}?unlocked=1`, req.url))
}
