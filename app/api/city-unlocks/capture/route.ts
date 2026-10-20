import { NextRequest } from 'next/server'
import { captureOrder } from '@/lib/paypal'
import { processCapture, priorPayment, redirectTo } from '@/lib/payments'

export const dynamic = 'force-dynamic'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/**
 * GET /api/city-unlocks/capture?cityId=…&token=<PayPal order id>
 *
 * Browser redirect back from PayPal — no Bearer token. Authorization comes
 * from the PayPal-verified order (custom_id → uid + cityId), never from the
 * query string; `cityId` in the URL is only used to pick a redirect target
 * when the order can't be read. Always answers with a redirect:
 *   /city/{cityId}?paypal=success&unlocked=1 | ?paypal=pending|refunded|error
 */
export async function GET(req: NextRequest) {
  const qCity = req.nextUrl.searchParams.get('cityId')
  const token = req.nextUrl.searchParams.get('token')
  const fallbackCity = qCity && ID_RE.test(qCity) ? qCity : null
  // `unlocked=1` is kept alongside paypal=success for the existing city page.
  const to = (cityId: string | null, flag: string) => {
    const q = flag === 'success' ? 'paypal=success&unlocked=1' : `paypal=${flag}`
    return redirectTo(cityId ? `/city/${encodeURIComponent(cityId)}?${q}` : `/?${q}`)
  }

  if (!token || !ID_RE.test(token)) return to(fallbackCity, 'error')

  try {
    const prior = await priorPayment(token)
    if (prior) {
      const flag = prior.status === 'granted' ? 'success' : prior.status === 'refunded' ? 'refunded' : 'error'
      return to(prior.cityId ?? fallbackCity, flag)
    }

    const info = await captureOrder(token)
    const outcome = await processCapture(info, 'redirect')
    const cityId = outcome.meta?.kind === 'city_unlock' ? outcome.meta.cityId : fallbackCity
    if (outcome.meta && outcome.meta.kind !== 'city_unlock') {
      // A credit-pack order sent to the city route — it was still processed
      // correctly by processCapture; just land somewhere sensible.
      return redirectTo(`/hunt?session=${encodeURIComponent(outcome.meta.sessionId)}&credits=${outcome.status === 'granted' ? 'added' : 'error'}`)
    }
    switch (outcome.status) {
      case 'granted': return to(cityId, 'success')
      case 'refunded': return to(cityId, 'refunded')
      case 'pending': return to(cityId, 'pending')
      default: return to(cityId, 'error')
    }
  } catch (e) {
    console.error('[city-unlocks/capture]', token, e)
    return to(fallbackCity, 'error')
  }
}
