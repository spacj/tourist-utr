import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, HttpError } from '@/lib/apiAuth'
import { roomRef, playerRef, getPlayerSessionId } from '@/lib/roomsServer'
import { clearUserActiveRoomIf } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/abandon  { roomId }
 * Auth: registered user; acts only on the caller's own player.
 *
 * Bows out of an in-progress race:
 *  - player: finishedAt + abandoned
 *  - session: abandoned + abandonedAt + completedAt (finish refuses XP for it)
 *  - clears the caller's userActiveRooms pointer
 *  - if everyone is now done, flips the room to 'finished'
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  const body = await readJson(req)
  const roomId = id(body.roomId, 'roomId')
  const db = adminDb()
  const rRef = roomRef(roomId)
  const pRef = playerRef(roomId, user.uid)

  const [roomSnap, playerSnap] = await db.getAll(rRef, pRef)
  if (!roomSnap.exists) throw new HttpError(404, 'room_not_found')
  if (!playerSnap.exists) throw new HttpError(404, 'not_a_player')
  if (roomSnap.data()?.state === 'lobby') throw new HttpError(409, 'not_racing')

  if (playerSnap.data()?.finishedAt) {
    await clearUserActiveRoomIf(user.uid, roomId)
    return NextResponse.json({ ok: true, alreadyFinished: true })
  }

  const sessionId = await getPlayerSessionId(roomId, user.uid)
  const batch = db.batch()
  batch.update(pRef, { finishedAt: FieldValue.serverTimestamp(), abandoned: true, currentClueId: null })
  if (sessionId) {
    batch.update(db.collection('sessions').doc(sessionId), {
      abandoned: true,
      abandonedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()

  // Close the race if nobody is still running.
  try {
    await db.runTransaction(async (tx) => {
      const [fresh, players] = await Promise.all([tx.get(rRef), tx.get(rRef.collection('players'))])
      const allDone = players.docs.every(d => d.data().finishedAt != null)
      if (allDone && fresh.exists && fresh.data()?.state === 'racing') {
        tx.update(rRef, { state: 'finished', finishedAt: FieldValue.serverTimestamp() })
      }
    })
  } catch (e) {
    console.error('[rooms/abandon] finish-room check failed', roomId, e)
  }

  await clearUserActiveRoomIf(user.uid, roomId)
  return NextResponse.json({ ok: true })
})
