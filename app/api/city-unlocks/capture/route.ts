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

  // Idempotency
  const existing = await getDoc(unlockRef)
  if (existing.exists()) {
    return NextResponse.redirect(new URL(`/city/${cityId}?unlocked=1`, req.url))
  }

  const result = await captureOrder(paypalToken)
  if (!result.success) {
    return NextResponse.redirect(new URL(`/city/${cityId}?paypal=cancelled`, req.url))
  }

  const citySnap = await getDoc(doc(db, 'cities', cityId))
  const priceEuros = (citySnap.data() as { priceEuros?: number } | undefined)?.priceEuros ?? CITY_UNLOCK_PRICE_EUROS

  await setDoc(unlockRef, {
    userId,
    cityId,
    paypalOrderId: paypalToken,
    amountCents: Math.round(priceEuros * 100),
    completedAt: serverTimestamp(),
  })

  return NextResponse.redirect(new URL(`/city/${cityId}?unlocked=1`, req.url))
}
