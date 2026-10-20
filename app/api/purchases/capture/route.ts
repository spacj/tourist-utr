import { NextRequest } from 'next/server'
import { captureOrder } from '@/lib/paypal'
import { processCapture, priorPayment, redirectTo } from '@/lib/payments'

export const dynamic = 'force-dynamic'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/**
 * GET /api/purchases/capture?session=…&token=<PayPal order id>
 *
 * Browser redirect back from PayPal — no Bearer token. What gets credited is
 * derived only from the PayPal-verified order (custom_id → session + package
 * + uid). Always answers with a redirect:
 *   /hunt?session={sid}&credits=added|pending|refunded|error
 */
export async function GET(req: NextRequest) {
  const qSession = req.nextUrl.searchParams.get('session')
  const token = req.nextUrl.searchParams.get('token')
  const fallbackSession = qSession && ID_RE.test(qSession) ? qSession : null
  const to = (sessionId: string | null, flag: string) =>
    redirectTo(sessionId ? `/hunt?session=${encodeURIComponent(sessionId)}&credits=${flag}` : `/?credits=${flag}`)

  if (!token || !ID_RE.test(token)) return to(fallbackSession, 'error')

  try {
    const prior = await priorPayment(token)
    if (prior) {
      const flag = prior.status === 'granted' ? 'added' : prior.status === 'refunded' ? 'refunded' : 'error'
      return to(prior.sessionId ?? fallbackSession, flag)
    }

    const info = await captureOrder(token)
    const outcome = await processCapture(info, 'redirect')
    if (outcome.meta?.kind === 'city_unlock') {
      return redirectTo(`/city/${encodeURIComponent(outcome.meta.cityId)}?paypal=${outcome.status === 'granted' ? 'success&unlocked=1' : 'error'}`)
    }
    const sessionId = outcome.meta?.kind === 'credit_pack' ? outcome.meta.sessionId : fallbackSession
    switch (outcome.status) {
      case 'granted': return to(sessionId, 'added')
      case 'refunded': return to(sessionId, 'refunded')
      case 'pending': return to(sessionId, 'pending')
      default: return to(sessionId, 'error')
    }
  } catch (e) {
    console.error('[purchases/capture]', token, e)
    return to(fallbackSession, 'error')
  }
}
