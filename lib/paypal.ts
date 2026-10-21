import 'server-only'

/**
 * Thin PayPal REST client (Orders v2 + Payments v2).
 *
 * Fails closed:
 *  - PAYPAL_MODE must be exactly 'live' or 'sandbox';
 *  - in production it must be 'live' unless PAYPAL_ALLOW_SANDBOX=true
 *    (for a staging deploy), so a typo can never silently take sandbox
 *    "payments" on the real site;
 *  - every HTTP call checks res.ok and throws PayPalError otherwise.
 */

export class PayPalError extends Error {
  constructor(
    public status: number,
    public op: string,
    /** PayPal's error name / first issue code, when available. */
    public issue: string | null = null,
  ) {
    super(`paypal_${op}_failed (${status}${issue ? ` ${issue}` : ''})`)
  }
}

export type PayPalMode = 'live' | 'sandbox'

export function paypalMode(): PayPalMode {
  const mode = process.env.PAYPAL_MODE
  if (mode !== 'live' && mode !== 'sandbox') {
    throw new PayPalError(0, 'config', 'PAYPAL_MODE must be "live" or "sandbox"')
  }
  if (
    process.env.NODE_ENV === 'production' &&
    mode !== 'live' &&
    process.env.PAYPAL_ALLOW_SANDBOX !== 'true'
  ) {
    throw new PayPalError(0, 'config', 'sandbox PayPal refused in production (set PAYPAL_ALLOW_SANDBOX=true for staging)')
  }
  return mode
}

function baseUrl(): string {
  return paypalMode() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

// ── OAuth token (cached until shortly before expiry) ────────────────────

let cachedToken: { token: string; expiresAt: number; base: string } | null = null

export async function getAccessToken(): Promise<string> {
  const base = baseUrl()
  if (cachedToken && cachedToken.base === base && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new PayPalError(0, 'config', 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing')

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  const data = await safeJson(res)
  if (!res.ok || typeof data?.access_token !== 'string') {
    throw new PayPalError(res.status, 'oauth', data?.error ?? null)
  }
  const ttlSec = typeof data.expires_in === 'number' ? data.expires_in : 300
  cachedToken = {
    token: data.access_token,
    // Refresh a minute early so an in-flight request never uses a stale token.
    expiresAt: Date.now() + Math.max(0, ttlSec - 60) * 1000,
    base,
  }
  return cachedToken.token
}

async function safeJson(res: Response): Promise<any> {
  try { return await res.json() } catch { return null }
}

function issueOf(data: any): string | null {
  return data?.details?.[0]?.issue ?? data?.name ?? null
}

async function call(
  op: string,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; requestId?: string },
): Promise<{ status: number; ok: boolean; data: any }> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (init.requestId) headers['PayPal-Request-Id'] = init.requestId
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  })
  if (res.status === 401) cachedToken = null
  return { status: res.status, ok: res.ok, data: await safeJson(res) }
}

// ── Orders ──────────────────────────────────────────────────────────────

export async function createOrder(opts: {
  amountEur: string
  description: string
  returnUrl: string
  cancelUrl: string
  /** Opaque string stored as purchase_units[0].custom_id (max 127 chars). */
  customId: string
}): Promise<{ id: string; approvalUrl: string }> {
  if (opts.customId.length > 127) throw new PayPalError(0, 'create_order', 'custom_id_too_long')
  const r = await call('create_order', '/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [{
        description: opts.description.slice(0, 127),
        custom_id: opts.customId,
        amount: { currency_code: 'EUR', value: opts.amountEur },
      }],
      application_context: {
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        brand_name: 'TourHunts',
      },
    },
  })
  const approvalUrl = r.data?.links?.find((l: any) => l?.rel === 'approve' || l?.rel === 'payer-action')?.href
  if (!r.ok || typeof r.data?.id !== 'string' || typeof approvalUrl !== 'string') {
    throw new PayPalError(r.status, 'create_order', issueOf(r.data))
  }
  return { id: r.data.id, approvalUrl }
}

/** The facts about a capture that callers MUST verify before granting. */
export interface CaptureInfo {
  orderId: string
  orderStatus: string
  captureId: string
  /** Capture status: COMPLETED, PENDING, DECLINED, … */
  status: string
  /** Decimal string as PayPal returns it, e.g. "5.00". */
  amountValue: string
  currency: string
  payeeMerchantId: string | null
  customId: string | null
}

function extractCapture(order: any): CaptureInfo | null {
  const pu = order?.purchase_units?.[0]
  const capture = pu?.payments?.captures?.[0]
  if (!capture?.id) return null
  return {
    orderId: String(order.id),
    orderStatus: String(order.status ?? ''),
    captureId: String(capture.id),
    status: String(capture.status ?? ''),
    amountValue: String(capture.amount?.value ?? ''),
    currency: String(capture.amount?.currency_code ?? ''),
    payeeMerchantId: pu?.payee?.merchant_id ?? capture?.payee?.merchant_id ?? null,
    customId: capture.custom_id ?? pu?.custom_id ?? null,
  }
}

export async function getOrder(orderId: string): Promise<any> {
  const r = await call('get_order', `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' })
  if (!r.ok) throw new PayPalError(r.status, 'get_order', issueOf(r.data))
  return r.data
}

/**
 * Capture an approved order. Idempotent from the caller's point of view: if
 * the order was already captured (redirect refresh, webhook race) the
 * existing capture is returned instead of an error.
 */
export async function captureOrder(orderId: string): Promise<CaptureInfo> {
  const r = await call('capture', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
  })
  let order = r.data
  if (!r.ok) {
    if (r.status === 422 && issueOf(r.data) === 'ORDER_ALREADY_CAPTURED') {
      order = await getOrder(orderId)
    } else {
      throw new PayPalError(r.status, 'capture', issueOf(r.data))
    }
  }
  const info = extractCapture(order)
  if (!info) throw new PayPalError(r.status, 'capture', 'NO_CAPTURE_IN_RESPONSE')
  return info
}

/** Full refund of a capture. Idempotent per capture via PayPal-Request-Id. */
export async function refundCapture(captureId: string, reason: string): Promise<{ refundId: string; status: string }> {
  const r = await call('refund', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: 'POST',
    requestId: `refund-${captureId}`,
    body: { note_to_payer: reason.slice(0, 255) },
  })
  if (!r.ok || typeof r.data?.id !== 'string') {
    throw new PayPalError(r.status, 'refund', issueOf(r.data))
  }
  return { refundId: r.data.id, status: String(r.data.status ?? '') }
}

/** Capture details — used to tell full from partial refunds. */
export async function getCapture(captureId: string): Promise<{ status: string; amountValue: string; currency: string }> {
  const r = await call('get_capture', `/v2/payments/captures/${encodeURIComponent(captureId)}`, { method: 'GET' })
  if (!r.ok) throw new PayPalError(r.status, 'get_capture', issueOf(r.data))
  return {
    status: String(r.data?.status ?? ''),
    amountValue: String(r.data?.amount?.value ?? ''),
    currency: String(r.data?.amount?.currency_code ?? ''),
  }
}

// ── Webhooks ────────────────────────────────────────────────────────────

/**
 * Verify a PayPal webhook signature. Required before trusting the payload —
 * without this, anyone can POST fake "PAYMENT.CAPTURE.COMPLETED" events.
 *
 * Headers expected on the inbound POST:
 *   paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig,
 *   paypal-cert-url, paypal-auth-algo
 *
 * PAYPAL_WEBHOOK_ID comes from the PayPal Developer Dashboard.
 */
export async function verifyWebhook(
  headers: Record<string, string | null>,
  rawEvent: any,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    console.error('[paypal] PAYPAL_WEBHOOK_ID not set — refusing webhook')
    return false
  }

  const required = [
    'paypal-transmission-id',
    'paypal-transmission-time',
    'paypal-transmission-sig',
    'paypal-cert-url',
    'paypal-auth-algo',
  ] as const
  for (const h of required) {
    if (!headers[h]) return false
  }

  const r = await call('verify_webhook', '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: rawEvent,
    },
  })
  if (!r.ok) throw new PayPalError(r.status, 'verify_webhook', issueOf(r.data))
  return r.data?.verification_status === 'SUCCESS'
}
