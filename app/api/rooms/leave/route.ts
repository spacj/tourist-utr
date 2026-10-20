import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id } from '@/lib/apiAuth'
import { roomRef, playerRef, releaseRoomCode } from '@/lib/roomsServer'
import { userActiveRoomRef } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/leave  { roomId }
 * Auth: registered user; acts only on the caller's own player.
 * Lobby only — during a race use /api/rooms/abandon.
 * Host leaving → host passes to the earliest-joined remaining player;
 * last player leaving → the room is deleted.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  const body = await readJson(req)
  const roomId = id(body.roomId, 'roomId')
  const db = adminDb()
  const rRef = roomRef(roomId)
  const pRef = playerRef(roomId, user.uid)
  const aRef = userActiveRoomRef(user.uid)

  const result = await db.runTransaction(async (tx) => {
    const [r, p, a] = await tx.getAll(rRef, pRef, aRef)
    const clearPointer = () => { if (a.exists && a.data()?.roomId === roomId) tx.delete(aRef) }

    if (!r.exists) {
      clearPointer()
      return { ok: true as const }
    }
    const room = r.data()!
    if (room.state !== 'lobby') {
      // During a race the player record stays so the scoreboard is coherent.
      return { ok: true as const, racing: true }
    }
    if (!p.exists) {
      clearPointer()
      return { ok: true as const }
    }

    const others = (await tx.get(rRef.collection('players').orderBy('joinedAt')))
      .docs.filter(d => d.id !== user.uid)

    tx.delete(pRef)
    clearPointer()

    if (others.length === 0) {
      tx.delete(rRef)
      return { ok: true as const, closed: true, code: room.code as string | undefined }
    }

    const update: Record<string, unknown> = { playerCount: FieldValue.increment(-1) }
    if (room.hostUserId === user.uid) {
      const next = others[0]
      update.hostUserId = next.id
      tx.update(next.ref, { isHost: true })
    }
    tx.update(rRef, update)
    return { ok: true as const }
  })

  if ('closed' in result && result.closed) await releaseRoomCode(result.code, roomId)
  return NextResponse.json({
    ok: true,
    ...('racing' in result ? { racing: true } : {}),
    ...('closed' in result ? { closed: true } : {}),
  })
})
