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

  // Idempotency keyed by paypal token (order id) — the webhook keys by
  // capture id so they may write different docs, but we check both before
  // crediting to avoid double-credit.
  const existingByOrder = await getDoc(doc(db, 'sessions', sessionId, 'purchases', paypalToken))
  if (existingByOrder.exists()) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&credits=added`, req.url))
  }

  const result = await captureOrder(paypalToken)
  if (!result.success) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}`, req.url))
  }

  // Security: validate the captured order's metadata matches our URL params.
  const meta = result.metadata
  if (
    !meta ||
    meta.kind !== 'credit_pack' ||
    meta.sessionId !== sessionId ||
    meta.packageId !== packageId
  ) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&paypal=mismatch`, req.url))
  }

  // Webhook may have written by captureId already — second guard.
  const captureId = result.captureId ?? paypalToken
  const existingByCapture = await getDoc(doc(db, 'sessions', sessionId, 'purchases', captureId))
  if (existingByCapture.exists()) {
    return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&credits=added`, req.url))
  }

  await setDoc(doc(db, 'sessions', sessionId, 'purchases', captureId), {
    packageId,
    creditsAdded: pkg.credits,
    amountCents: pkg.priceCents,
    paypalOrderId: paypalToken,
    paypalCaptureId: captureId,
    completedAt: serverTimestamp(),
    grantedVia: 'redirect',
  })
  await updateDoc(doc(db, 'sessions', sessionId), { credits: increment(pkg.credits) })

  return NextResponse.redirect(new URL(`/hunt?session=${sessionId}&credits=added`, req.url))
}
