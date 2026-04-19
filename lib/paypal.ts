const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  return data.access_token
}

export async function createOrder(opts: {
  amountEur: string
  description: string
  returnUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}): Promise<{ id: string; approvalUrl: string }> {
  const token = await getAccessToken()

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        description: opts.description,
        custom_id: JSON.stringify(opts.metadata),
        amount: {
          currency_code: 'EUR',
          value: opts.amountEur,
        },
      }],
      application_context: {
        return_url: opts.returnUrl,
        cancel_url: opts.cancelUrl,
        user_action: 'PAY_NOW',
        brand_name: 'Utrecht Scavenger Hunt',
      },
    }),
  })

  const order = await res.json()
  const approvalUrl = order.links.find((l: any) => l.rel === 'approve')?.href
  return { id: order.id, approvalUrl }
}

export async function captureOrder(orderId: string): Promise<{
  success: boolean
  metadata?: Record<string, string>
}> {
  const token = await getAccessToken()

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const data = await res.json()

  if (data.status !== 'COMPLETED') {
    return { success: false }
  }

  const customId = data.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id
    || data.purchase_units?.[0]?.custom_id

  return {
    success: true,
    metadata: customId ? JSON.parse(customId) : undefined,
  }
}
