import { NextRequest, NextResponse } from 'next/server'
import { handle, readJson, rateLimit, HttpError } from '@/lib/apiAuth'
import { requireCreator } from '@/lib/creators'
import { expressDashboardLink, onboardingLink, refreshStripeAccount } from '@/lib/creatorPayments'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }

/**
 * POST /api/creator/stripe { action } for the caller's creator account:
 *   'onboard'   → { url }      Stripe-hosted onboarding (creates the account once)
 *   'refresh'   → { creator }  re-read the account flags from Stripe
 *   'dashboard' → { url }      the creator's Stripe Express dashboard (payouts)
 */
export const POST = handle(async (req: NextRequest) => {
  const { user, creator } = await requireCreator(req)
  rateLimit(`creator-stripe:${user.uid}`, 20, 60_000)
  const { action } = await readJson(req)
  if (action === 'onboard') return NextResponse.json({ url: await onboardingLink(user, creator) }, { headers })
  if (action === 'refresh') return NextResponse.json({ creator: await refreshStripeAccount(user.uid) }, { headers })
  if (action === 'dashboard') return NextResponse.json({ url: await expressDashboardLink(creator) }, { headers })
  throw new HttpError(400, 'invalid_action')
})
