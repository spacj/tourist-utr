import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/firebase'
import { CREDIT_PACKAGES } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed')
    return NextResponse.json({ received: true })

  const cs = event.data.object as Stripe.Checkout.Session
  const { sessionId, packageId, credits } = cs.metadata!
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Unknown package' }, { status: 400 })

  const paymentId = cs.payment_intent as string
  const sessionRef = db.collection('sessions').doc(sessionId)
  const purchaseRef = sessionRef.collection('purchases').doc(paymentId)

  const existing = await purchaseRef.get()
  if (existing.exists) return NextResponse.json({ received: true })

  const batch = db.batch()
  batch.set(purchaseRef, {
    packageId,
    creditsAdded: parseInt(credits),
    amountCents: pkg.priceCents,
    stripePaymentId: paymentId,
    completedAt: FieldValue.serverTimestamp(),
  })
  batch.update(sessionRef, { credits: FieldValue.increment(parseInt(credits)) })
  await batch.commit()

  return NextResponse.json({ received: true })
}
