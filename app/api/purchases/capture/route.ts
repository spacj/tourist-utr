import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { captureOrder } from '@/lib/paypal'
import { CREDIT_PACKAGES } from '@/types'
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')
  const packageId = req.nextUrl.searchParams.get('pkg')
  const paypalToken = req.nextUrl.searchParams.get('token')

  if (!sessionId || !packageId || !paypalToken) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Unknown package' }, { status: 400 })

  // Idempotency — skip if already processed
  const purchaseRef = doc(db, 'sessions', sessionId, 'purchases', paypalToken)
  const existing = await getDoc(purchaseRef)
  if (existing.exists()) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&credits=added`, req.url))
  }

  const result = await captureOrder(paypalToken)
  if (!result.success) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}`, req.url))
  }

  const sessionRef = doc(db, 'sessions', sessionId)
  await setDoc(purchaseRef, {
    packageId,
    creditsAdded: pkg.credits,
    amountCents: pkg.priceCents,
    paypalOrderId: paypalToken,
    completedAt: serverTimestamp(),
  })
  await updateDoc(sessionRef, { credits: increment(pkg.credits) })

  return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&credits=added`, req.url))
}
