import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { createOrder } from '@/lib/paypal'
import { CITY_UNLOCK_PRICE_EUROS } from '@/types'
import { doc, getDoc } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { cityId, userId } = await req.json()
  if (!cityId) return NextResponse.json({ error: 'cityId required' }, { status: 400 })
  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const citySnap = await getDoc(doc(db, 'cities', cityId))
  if (!citySnap.exists()) return NextResponse.json({ error: 'City not found' }, { status: 404 })
  const city = citySnap.data() as { name: string; priceEuros?: number }

  const amount = (city.priceEuros ?? CITY_UNLOCK_PRICE_EUROS).toFixed(2)
  const origin = req.headers.get('origin') ?? 'http://localhost:3000'

  const { approvalUrl } = await createOrder({
    amountEur: amount,
    description: `Tourist Hunt — Unlock ${city.name}`,
    returnUrl: `${origin}/api/city-unlocks/capture?cityId=${cityId}&userId=${encodeURIComponent(userId)}`,
    cancelUrl: `${origin}/city/${cityId}`,
    metadata: { cityId, userId, kind: 'city_unlock' },
  })

  return NextResponse.json({ url: approvalUrl })
}
