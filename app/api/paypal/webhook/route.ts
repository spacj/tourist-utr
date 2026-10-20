import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook, captureOrder, PayPalError, type CaptureInfo } from '@/lib/paypal'
import { processCapture, processRefund } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * PayPal webhook. Subscribe (PayPal Developer dashboard) to:
 *   CHECKOUT.ORDER.APPROVED    — capture orders whose buyer never made it back
 *                                to the redirect capture route (closed tab)
 *   PAYMENT.CAPTURE.COMPLETED  — grant (also completes PENDING captures)
 *   PAYMENT.CAPTURE.REFUNDED   — revoke on full refund
 *   PAYMENT.CAPTURE.REVERSED   — revoke on chargeback/reversal
 *
 * Grants go through the same idempotent processCapture() as the redirect
 * routes (payments/{orderId} + paymentsByCapture/{captureId} locks), so the
 * order of redirect vs. webhook delivery doesn't matter.
 *
 * Answers 500 on handler failure so PayPal retries.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text()
  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const headers: Record<string, string | null> = {
    'paypal-transmission-id':   req.headers.get('paypal-transmission-id'),
    'paypal-transmission-time': req.headers.get('paypal-transmission-time'),
    'paypal-transmission-sig':  req.headers.get('paypal-transmission-sig'),
    'paypal-cert-url':          req.headers.get('paypal-cert-url'),
    'paypal-auth-algo':         req.headers.get('paypal-auth-algo'),
  }

  let verified = false
  try {
    verified = await verifyWebhook(headers, event)
  } catch (e) {
    // Couldn't reach PayPal to verify — let PayPal retry later.
    console.error('[paypal/webhook] verification call failed', e)
    return NextResponse.json({ error: 'verify_failed' }, { status: 500 })
  }
  if (!verified) {
    console.warn('[paypal/webhook] signature verification failed', event?.id)
    return NextResponse.json({ error: 'unverified' }, { status: 401 })
  }

  try {
    const type = String(event?.event_type ?? '')
    const resource = event?.resource
    switch (type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        const orderId = typeof resource?.id === 'string' ? resource.id : null
        if (orderId) {
          let info: CaptureInfo
          try {
            info = await captureOrder(orderId)
          } catch (e) {
            if (e instanceof PayPalError && e.status === 422) {
              // Unprocessable (declined instrument, expired order…): retrying won't help.
              console.warn('[paypal/webhook] approved order not capturable', orderId, e.message)
              break
            }
            throw e
          }
          const outcome = await processCapture(info, 'webhook')
          console.info('[paypal/webhook] order approved → capture', orderId, outcome.status)
        }
        break
      }
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const info = captureFromResource(resource)
        if (!info) {
          console.error('[paypal/webhook] malformed capture resource', event?.id)
          break
        }
        const outcome = await processCapture(info, 'webhook')
        console.info('[paypal/webhook] capture completed', info.orderId, outcome.status)
        break
      }
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED':
        await processRefund(resource, type)
        break
      default:
        // Acknowledge so PayPal stops retrying.
        break
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[paypal/webhook] handler failed', event?.event_type, event?.id, e)
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }
}

/** Map a signature-verified capture resource onto the shared CaptureInfo. */
function captureFromResource(r: any): CaptureInfo | null {
  if (!r || typeof r.id !== 'string') return null
  const orderId = r.supplementary_data?.related_ids?.order_id
  return {
    // Without an order id we key the lock by capture id; paymentsByCapture
    // still dedupes against a redirect that keyed by order id.
    orderId: typeof orderId === 'string' ? orderId : r.id,
    orderStatus: '',
    captureId: r.id,
    status: String(r.status ?? ''),
    amountValue: String(r.amount?.value ?? ''),
    currency: String(r.amount?.currency_code ?? ''),
    payeeMerchantId: r.payee?.merchant_id ?? null,
    customId: typeof r.custom_id === 'string' ? r.custom_id : null,
  }
}
