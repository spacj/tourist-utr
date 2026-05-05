import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

/**
 * GET /api/rooms/active?userId=X
 *
 * Returns the user's active multiplayer room across devices.
 * Reads from `userActiveRooms/{userId}` (Firestore-backed source of truth).
 * Hydrates with progress data so the resume banner can render details.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ active: false })

  const activeSnap = await getDoc(doc(db, 'userActiveRooms', userId))
  if (!activeSnap.exists()) return NextResponse.json({ active: false })
  const a = activeSnap.data()

  // Verify the room still exists and the user is still listed.
  const roomSnap = await getDoc(doc(db, 'rooms', a.roomId))
  if (!roomSnap.exists()) return NextResponse.json({ active: false })

  const playerSnap = await getDoc(doc(db, 'rooms', a.roomId, 'players', userId))
  if (!playerSnap.exists()) return NextResponse.json({ active: false })
  const player = playerSnap.data()

  return NextResponse.json({
    active: true,
    roomId: a.roomId,
    code: a.code,
    huntId: a.huntId,
    huntTitle: a.huntTitle,
    state: a.state,                  // 'lobby' | 'racing' | 'finished'
    sessionId: a.sessionId ?? null,
    cluesDone: player.cluesDone ?? 0,
    score: player.score ?? 0,
    finishedAt: player.finishedAt?.toMillis?.() ?? null,
  })
}
