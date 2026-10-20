import { NextRequest, NextResponse } from 'next/server'
import { handle, requireUser, HttpError } from '@/lib/apiAuth'
import { clearUserActiveRoom, getUserActiveRoom } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/dismiss  (no body needed)
 * Auth: registered user; clears only the caller's own active-room pointer.
 * Only allowed once the race is 'finished', so an in-progress race can't be
 * orphaned from the resume flow.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })

  const active = await getUserActiveRoom(user.uid)
  if (!active) return NextResponse.json({ ok: true })
  if (active.state !== 'finished') throw new HttpError(409, 'race_in_progress')

  await clearUserActiveRoom(user.uid)
  return NextResponse.json({ ok: true })
})
