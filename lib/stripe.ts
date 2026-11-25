import 'server-only'
import Stripe from 'stripe'
import { HttpError } from '@/lib/apiAuth'

/**
 * Stripe client for creator-hunt sales (Stripe Connect, Express accounts,
 * destination charges). House hunts and hint credits stay on PayPal.
 *
 *   STRIPE_SECRET_KEY              sk_live_… / sk_test_…  (secret)
 *   STRIPE_WEBHOOK_SECRET          whsec_… of the platform endpoint
 *   STRIPE_CONNECT_WEBHOOK_SECRET  whsec_… of the "connected accounts" endpoint
 *                                  (account.updated); may be the same endpoint URL
 *
 * In production a test key is refused unless STRIPE_ALLOW_TEST=true
 * (staging deployments), mirroring PAYPAL_ALLOW_SANDBOX.
 */

let client: Stripe | null = null

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new HttpError(503, 'payments_unavailable')
  if (process.env.NODE_ENV === 'production' && key.startsWith('sk_test_') && process.env.STRIPE_ALLOW_TEST !== 'true') {
    throw new HttpError(503, 'payments_misconfigured')
  }
  return (client ??= new Stripe(key, { appInfo: { name: 'TourHunts' } }))
}

/** Verify a webhook signature against either configured endpoint secret. */
export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new HttpError(400, 'missing_signature')
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => !!s,
  )
  if (!secrets.length) throw new HttpError(503, 'webhook_not_configured')
  for (const secret of secrets) {
    try {
      return stripe().webhooks.constructEvent(rawBody, signature, secret)
    } catch {
      // try the next secret
    }
  }
  throw new HttpError(400, 'bad_signature')
}
