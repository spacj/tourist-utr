import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, str, rateLimit, clientIp, HttpError } from '@/lib/apiAuth'
import { MAX_PLAYERS, ROOM_CODE_LEN, normalizeCode, isRoomExpired } from '@/lib/rooms'
import {
  findRoomByCode, userCanPlayHunt, cleanDisplayName, cleanPhotoURL, playerRef, roomRef, getPlayerSessionId,
} from '@/lib/roomsServer'
import { txSetUserActiveRoom, isUserInOtherRoom, setUserActiveRoom } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/join  { code, displayName?, force? }
 * Auth: registered user. Rate-limited per uid and per IP (code enumeration).
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  rateLimit(`rooms-lookup:uid:${user.uid}`, 20, 60_000)
  rateLimit(`rooms-lookup:ip:${clientIp(req)}`, 60, 60_000)
  const body = await readJson(req)
  const code = normalizeCode(str(body.code, 'code', 32))
  if (code.length !== ROOM_CODE_LEN) throw new HttpError(400, 'invalid_code')
  const force = body.force === true

  const found = await findRoomByCode(code)
  if (!found) throw new HttpError(404, 'invalid_code')
  const { id: roomId, data: room } = found
  const huntTitle = room.huntTitle ?? 'Hunt'

  // Already a member? Idempotent — refresh active-room pointer and return.
  const existingPlayer = await playerRef(roomId, user.uid).get()
  if (existingPlayer.exists) {
    await setUserActiveRoom(user.uid, {
      roomId,
      code: room.code,
      huntId: room.huntId,
      huntTitle,
      state: room.state,
      sessionId: await getPlayerSessionId(roomId, user.uid),
    }, false)
    return NextResponse.json({ roomId, code: room.code, rejoined: true })
  }

  if (room.state !== 'lobby') throw new HttpError(409, 'race_started')

  if (!force) {
    const otherRoom = await isUserInOtherRoom(user.uid, roomId)
    if (otherRoom) {
      return NextResponse.json({ error: 'already_in_room', existing: otherRoom }, { status: 409 })
    }
  }

  // Paywall — same rule as start-session.
  const huntSnap = await adminDb().collection('hunts').doc(String(room.huntId)).get()
  if (!huntSnap.exists) throw new HttpError(404, 'hunt_not_found')
  if (!(await userCanPlayHunt(user.uid, huntSnap.data()!))) {
    return NextResponse.json({ error: 'city_locked', cityId: room.cityId ?? null }, { status: 402 })
  }

  const displayName = cleanDisplayName(body.displayName, user.displayName)
  const photoURL = cleanPhotoURL(user.photoURL)

  const result = await adminDb().runTransaction(async (tx) => {
    const rRef = roomRef(roomId)
    const pRef = playerRef(roomId, user.uid)
    const [r, p] = await tx.getAll(rRef, pRef)
    if (!r.exists) throw new HttpError(404, 'invalid_code')
    const fresh = r.data()!
    if (isRoomExpired(fresh)) throw new HttpError(404, 'invalid_code')
    if (p.exists) return { rejoined: true }
    if (fresh.state !== 'lobby') throw new HttpError(409, 'race_started')
    const max = typeof fresh.maxPlayers === 'number' ? Math.min(fresh.maxPlayers, MAX_PLAYERS) : MAX_PLAYERS
    if ((fresh.playerCount ?? 0) >= max) throw new HttpError(409, 'room_full')

    tx.create(pRef, {
      userId: user.uid,
      displayName,
      photoURL,
      joinedAt: FieldValue.serverTimestamp(),
      isHost: false,
      score: 0,
      cluesDone: 0,
      finishedAt: null,
    })
    tx.update(rRef, { playerCount: FieldValue.increment(1) })
    txSetUserActiveRoom(tx, user.uid, {
      roomId, code: fresh.code, huntId: fresh.huntId, huntTitle, state: 'lobby', sessionId: null,
    })
    return { rejoined: false }
  })

  return NextResponse.json({ roomId, code: room.code, rejoined: result.rejoined })
})
