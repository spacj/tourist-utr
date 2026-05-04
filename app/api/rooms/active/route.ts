import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'

/**
 * GET /api/rooms/active?userId=X
 *
 * Returns the active multiplayer experience for the given user, if any:
 *   - state='racing' with sessionId  → user has an in-progress race
 *   - state='finished' with sessionId → user has a finished race they haven't dismissed
 *
 * Lobby state isn't tracked here (it's stored client-side via localStorage)
 * because lobby rooms have no session and would require a collectionGroup index.
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ active: false })

  // Find sessions for this user that are still in progress and tied to a room.
  const sessionsSnap = await getDocs(
    query(
      collection(db, 'sessions'),
      where('userId', '==', userId),
      where('completedAt', '==', null),
    )
  )

  const active = sessionsSnap.docs
    .filter(d => !!d.data().roomId)
    .sort((a, b) => (b.data().startedAt?.toMillis?.() ?? 0) - (a.data().startedAt?.toMillis?.() ?? 0))

  if (active.length === 0) return NextResponse.json({ active: false })

  const sessionDoc = active[0]
  const session = sessionDoc.data()

  const roomSnap = await getDoc(doc(db, 'rooms', session.roomId))
  if (!roomSnap.exists()) {
    // Orphaned session (room deleted) — treat as inactive.
    return NextResponse.json({ active: false })
  }
  const room = roomSnap.data()

  // Verify the player is still listed in the room.
  const playerSnap = await getDoc(doc(db, 'rooms', session.roomId, 'players', userId))
  if (!playerSnap.exists()) {
    return NextResponse.json({ active: false })
  }

  return NextResponse.json({
    active: true,
    roomId: session.roomId,
    code: room.code,
    state: room.state,                         // 'racing' | 'finished' (not 'lobby' since session exists)
    huntId: room.huntId,
    huntTitle: room.huntTitle,
    sessionId: sessionDoc.id,
    cluesDone: playerSnap.data().cluesDone ?? 0,
    score: playerSnap.data().score ?? 0,
    finishedAt: playerSnap.data().finishedAt?.toMillis?.() ?? null,
  })
}
