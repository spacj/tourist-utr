import { NextRequest, NextResponse } from 'next/server'
import { CREDIT_PACKAGES } from '@/types'
import { createOrder } from '@/lib/paypal'

export async function POST(req: NextRequest) {
  const { sessionId, packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const { approvalUrl } = await createOrder({
    amountEur: (pkg.priceCents / 100).toFixed(2),
    description: `Utrecht Hunt — ${pkg.label}`,
    returnUrl: `${origin}/api/purchases/capture?session=${sessionId}&pkg=${packageId}`,
    cancelUrl: `${origin}/hunt?session=${sessionId}`,
    metadata: { sessionId, packageId, credits: String(pkg.credits) },
  })

  return NextResponse.json({ url: approvalUrl })
}
