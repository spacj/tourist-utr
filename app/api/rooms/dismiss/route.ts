import { NextRequest, NextResponse } from 'next/server'
import { clearUserActiveRoom, getUserActiveRoom } from '@/lib/userActiveRoom'

/**
 * POST /api/rooms/dismiss
 *
 * Clears the user's active-room pointer. Used when the user has seen the finished
 * race results and wants the resume banner to stop showing.
 *
 * Only allowed when the room state is 'finished' to avoid accidentally orphaning
 * an in-progress race from the user's resume flow.
 */
export async function POST(req: NextRequest) {
  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const active = await getUserActiveRoom(userId)
  if (!active) return NextResponse.json({ ok: true })

  if (active.state !== 'finished') {
    return NextResponse.json({ error: 'race_in_progress' }, { status: 409 })
  }

  await clearUserActiveRoom(userId)
  return NextResponse.json({ ok: true })
}
