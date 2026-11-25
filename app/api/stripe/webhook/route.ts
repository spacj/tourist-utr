import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { HttpError } from '@/lib/apiAuth'
import { constructStripeEvent } from '@/lib/stripe'
import { processCreatorCheckout, processCreatorRefund, syncStripeAccount } from '@/lib/creatorPayments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/webhook — Stripe events (signature verified). Answers 500
 * on processing errors so Stripe retries; every handler is idempotent.
 *
 * Subscribe the platform endpoint to: checkout.session.completed,
 * checkout.session.async_payment_succeeded, charge.refunded,
 * charge.dispute.closed. Subscribe a connected-accounts endpoint (same URL
 * is fine) to: account.updated.
 */
export async function POST(req: NextRequest) {
  let event: Stripe.Event
  try {
    event = constructStripeEvent(await req.text(), req.headers.get('stripe-signature'))
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 400
    return NextResponse.json({ error: e instanceof HttpError ? e.code : 'bad_request' }, { status })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await processCreatorCheckout(event.data.object, 'webhook')
        break
      case 'charge.refunded': {
        const charge = event.data.object
        const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (pi) await processCreatorRefund(pi, charge.refunded === true)
        break
      }
      case 'charge.dispute.closed': {
        const dispute = event.data.object
        const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id
        if (pi && dispute.status === 'lost') await processCreatorRefund(pi, true)
        break
      }
      case 'account.updated':
        await syncStripeAccount(event.data.object)
        break
      default:
        break
    }
  } catch (e) {
    console.error('[stripe/webhook]', event.type, event.id, e)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
