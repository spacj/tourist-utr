import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { clearUserActiveRoom } from '@/lib/userActiveRoom'
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'

/**
 * POST /api/rooms/abandon
 *
 * Lets a player officially bow out of an in-progress race.
 *  - Marks their player record as finished (with current score)
 *  - Marks their session as completed (so progress freezes)
 *  - Clears their userActiveRooms pointer
 *  - If they were the last unfinished racer, flips the room to 'finished'
 *
 * Different from /leave: leave is for lobby; abandon is for racing.
 */
export async function POST(req: NextRequest) {
  const { roomId, userId } = await req.json()
  if (!roomId || !userId) return NextResponse.json({ error: 'missing' }, { status: 400 })

  const roomRef = doc(db, 'rooms', roomId)
  const playerRef = doc(db, 'rooms', roomId, 'players', userId)

  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) return NextResponse.json({ error: 'room_not_found' }, { status: 404 })

  const playerSnap = await getDoc(playerRef)
  if (!playerSnap.exists()) return NextResponse.json({ error: 'not_a_player' }, { status: 404 })
  const player = playerSnap.data()

  // Already finished? Just clear pointer.
  if (player.finishedAt) {
    await clearUserActiveRoom(userId)
    return NextResponse.json({ ok: true, alreadyFinished: true })
  }

  const batch = writeBatch(db)
  batch.update(playerRef, { finishedAt: serverTimestamp(), abandoned: true })
  if (player.sessionId) {
    batch.update(doc(db, 'sessions', player.sessionId), { completedAt: serverTimestamp(), abandoned: true })
  }
  await batch.commit()

  // After commit, check whether everyone is now finished and flip room state if so.
  const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'))
  const allDone = playersSnap.docs.every(d => d.data().finishedAt != null)
  if (allDone) {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(roomRef)
      if (fresh.exists() && fresh.data().state === 'racing') {
        tx.update(roomRef, { state: 'finished', finishedAt: serverTimestamp() })
      }
    }).catch(() => {})
  }

  await clearUserActiveRoom(userId)
  return NextResponse.json({ ok: true })
}
