import { NextRequest, NextResponse } from 'next/server'
import { CREDIT_PACKAGES } from '@/types'
import { createOrder } from '@/lib/paypal'

function siteOrigin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    || req.headers.get('origin')
    || 'http://localhost:3000'
}

export async function POST(req: NextRequest) {
  const { sessionId, packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const origin = siteOrigin(req)

  const { approvalUrl } = await createOrder({
    amountEur: (pkg.priceCents / 100).toFixed(2),
    description: `TourHunts — ${pkg.label}`,
    returnUrl: `${origin}/api/purchases/capture?session=${sessionId}&pkg=${packageId}`,
    cancelUrl: `${origin}/hunt?session=${sessionId}`,
    metadata: { sessionId, packageId, credits: String(pkg.credits), kind: 'credit_pack' },
  })

  return NextResponse.json({ url: approvalUrl })
}
