import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { processCreatorCheckout } from '@/lib/creatorPayments'
import { redirectTo } from '@/lib/payments'

export const dynamic = 'force-dynamic'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/**
 * GET /api/stripe/return?session_id=cs_… — browser redirect back from Stripe
 * Checkout. What is granted comes from the Stripe-verified session, never the
 * query string. Lands on the same flags as PayPal so the city page shows the
 * usual messages: /city/{cityId}?paypal=success|pending|refunded|error&hunt=…
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const to = (cityId: string | null, huntId: string | null, flag: string) => {
    const q = `paypal=${flag}${huntId && ID_RE.test(huntId) ? `&hunt=${encodeURIComponent(huntId)}` : ''}`
    return redirectTo(cityId && ID_RE.test(cityId) ? `/city/${encodeURIComponent(cityId)}?${q}` : `/?${q}`)
  }
  if (!sessionId || !/^cs_[A-Za-z0-9_]{1,200}$/.test(sessionId)) return to(null, null, 'error')
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId)
    const out = await processCreatorCheckout(session, 'redirect')
    const flag = out.status === 'granted' || out.status === 'already' ? 'success'
      : out.status === 'pending' ? 'pending'
      : out.status === 'refunded' ? 'refunded' : 'error'
    return to(out.cityId, out.huntId, flag)
  } catch (e) {
    console.error('[stripe/return]', sessionId, e)
    return to(null, null, 'error')
  }
}
