import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { CREDIT_PACKAGES } from '@/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

export async function POST(req: NextRequest) {
  const { sessionId, packageId } = await req.json()
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: pkg.priceCents,
        product_data: {
          name: `Utrecht Hunt — ${pkg.label}`,
          description: `${pkg.credits} hint credits`,
        },
      },
      quantity: 1,
    }],
    metadata: { sessionId, packageId, credits: String(pkg.credits) },
    success_url: `${origin}/hunt?session=${sessionId}&credits=added`,
    cancel_url: `${origin}/hunt?session=${sessionId}`,
  })

  return NextResponse.json({ url: checkout.url })
}
