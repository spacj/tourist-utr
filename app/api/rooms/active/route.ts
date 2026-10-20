import { NextRequest, NextResponse } from 'next/server'
import { handle, getAuthUser } from '@/lib/apiAuth'
import { roomRef, playerRef, millis } from '@/lib/roomsServer'
import { userActiveRoomRef } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/active
 * The caller's active multiplayer room across devices. Identity from the
 * Bearer token only; signed-out or guest callers simply get {active:false}
 * (guests can't be in rooms).
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await getAuthUser(req)
  if (!user || user.isAnonymous) return NextResponse.json({ active: false })

  const activeSnap = await userActiveRoomRef(user.uid).get()
  if (!activeSnap.exists) return NextResponse.json({ active: false })
  const a = activeSnap.data()!

  const [roomSnap, playerSnap] = await Promise.all([
    roomRef(String(a.roomId)).get(),
    playerRef(String(a.roomId), user.uid).get(),
  ])
  if (!roomSnap.exists || !playerSnap.exists) return NextResponse.json({ active: false })
  const player = playerSnap.data()!

  return NextResponse.json({
    active: true,
    roomId: a.roomId,
    code: a.code,
    huntId: a.huntId,
    huntTitle: a.huntTitle,
    state: a.state,                  // 'lobby' | 'racing' | 'finished'
    sessionId: a.sessionId ?? null,  // the caller's own session
    cluesDone: player.cluesDone ?? 0,
    score: player.score ?? 0,
    finishedAt: millis(player.finishedAt),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
})
