import { NextRequest } from 'next/server'
import { captureOrder } from '@/lib/paypal'
import { processCapture, priorPayment, redirectTo } from '@/lib/payments'
import { adminDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/**
 * GET /api/hunt-unlocks/capture?huntId=…&token=<PayPal order id>
 *
 * Browser redirect back from PayPal — no Bearer token. What gets granted
 * comes from the PayPal-verified order (custom_id → uid + huntId), never from
 * the query string; `huntId` in the URL only picks a redirect target when the
 * order can't be read. Always answers with a redirect:
 *   /city/{cityId}?paypal=success|pending|refunded|error&hunt={huntId}
 */
export async function GET(req: NextRequest) {
  const qHunt = req.nextUrl.searchParams.get('huntId')
  const token = req.nextUrl.searchParams.get('token')
  const fallbackHunt = qHunt && ID_RE.test(qHunt) ? qHunt : null

  const to = async (huntId: string | null, cityId: string | null, flag: string) => {
    let city = cityId && ID_RE.test(cityId) ? cityId : null
    if (!city && huntId) {
      try {
        const c = (await adminDb().collection('hunts').doc(huntId).get()).data()?.cityId
        city = typeof c === 'string' && ID_RE.test(c) ? c : null
      } catch {
        // Land on the home page instead.
      }
    }
    const q = `paypal=${flag}${huntId ? `&hunt=${encodeURIComponent(huntId)}` : ''}`
    return redirectTo(city ? `/city/${encodeURIComponent(city)}?${q}` : `/?${q}`)
  }

  if (!token || !ID_RE.test(token)) return to(fallbackHunt, null, 'error')

  try {
    const prior = await priorPayment(token)
    if (prior) {
      const flag = prior.status === 'granted' ? 'success' : prior.status === 'refunded' ? 'refunded' : 'error'
      return to(prior.huntId ?? fallbackHunt, prior.cityId, flag)
    }

    const info = await captureOrder(token)
    const outcome = await processCapture(info, 'redirect')
    const meta = outcome.meta
    if (meta?.kind === 'credit_pack') {
      // Processed correctly by processCapture; just land somewhere sensible.
      return redirectTo(`/hunt?session=${encodeURIComponent(meta.sessionId)}&credits=${outcome.status === 'granted' ? 'added' : 'error'}`)
    }
    const huntId = meta?.kind === 'hunt_unlock' ? meta.huntId : fallbackHunt
    const cityId = meta?.kind === 'city_unlock' ? meta.cityId : null
    switch (outcome.status) {
      case 'granted': return to(huntId, cityId, 'success')
      case 'refunded': return to(huntId, cityId, 'refunded')
      case 'pending': return to(huntId, cityId, 'pending')
      default: return to(huntId, cityId, 'error')
    }
  } catch (e) {
    console.error('[hunt-unlocks/capture]', token, e)
    return to(fallbackHunt, null, 'error')
  }
}
