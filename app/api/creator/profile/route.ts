import { NextRequest, NextResponse } from 'next/server'
import { handle, requireUser, readJson, rateLimit } from '@/lib/apiAuth'
import { getCreator, upsertCreatorProfile } from '@/lib/creators'
import { parseCreatorProfileInput } from '@/lib/creatorProfile'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

/** GET /api/creator/profile → { creator: CreatorProfile | null } for the caller. */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  return NextResponse.json({ creator: await getCreator(user.uid) }, { headers })
})

/**
 * POST /api/creator/profile { displayName, bio, country, acceptTerms }
 * → { creator }. Creates the caller's creator profile (acceptTerms must be
 * true) or updates name/bio (and country until Stripe onboarding starts).
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  rateLimit(`creator-profile:${user.uid}`, 10, 60_000)
  const input = parseCreatorProfileInput(await readJson(req))
  const creator = await upsertCreatorProfile(user, input)
  return NextResponse.json({ creator }, { headers })
})
