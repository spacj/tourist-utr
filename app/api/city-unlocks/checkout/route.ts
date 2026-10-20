import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/city-unlocks/checkout — retired (410). City passes are no longer
 * sold: every account gets one free hunt, then each hunt is bought on its own
 * (POST /api/hunt-unlocks/checkout). Existing passes keep working, and
 * /api/city-unlocks/capture stays up for orders created before the change.
 */
export function POST() {
  return NextResponse.json({ error: 'city_pass_retired' }, { status: 410 })
}
