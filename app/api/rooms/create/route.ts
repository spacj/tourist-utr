import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { ROOM_TTL_HOURS, MAX_PLAYERS } from '@/lib/rooms'
import {
  allocateRoomCode, huntIsFree, userCanPlayHunt, cleanDisplayName, cleanPhotoURL, playerRef,
} from '@/lib/roomsServer'
import { userActiveRoomRef, isUserInOtherRoom } from '@/lib/userActiveRoom'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/create  { huntId, displayName?, force? }
 * Auth: registered (non-anonymous) user. Host must have access to the hunt
 * (free first hunt, or the city unlocked).
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  rateLimit(`rooms-create:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const huntId = id(body.huntId, 'huntId')
  const force = body.force === true

  // Block duplicate active rooms unless caller explicitly confirms (force=true).
  if (!force) {
    const existing = await isUserInOtherRoom(user.uid)
    if (existing) {
      return NextResponse.json({ error: 'already_in_room', existing }, { status: 409 })
    }
  }

  const db = adminDb()
  const huntSnap = await db.collection('hunts').doc(huntId).get()
  if (!huntSnap.exists) throw new HttpError(404, 'hunt_not_found')
  const hunt = huntSnap.data()!
  const cityId = typeof hunt.cityId === 'string' ? hunt.cityId : null

  if (!(await userCanPlayHunt(user.uid, hunt))) {
    return NextResponse.json({ error: 'city_locked', cityId }, { status: 402 })
  }

  const huntTitle = typeof hunt.title === 'string' && hunt.title ? hunt.title : 'Hunt'
  const expiresAt = Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000
  const roomDoc = db.collection('rooms').doc()
  const code = await allocateRoomCode(roomDoc.id, expiresAt)

  const batch = db.batch()
  batch.create(roomDoc, {
    code,
    hostUserId: user.uid,
    huntId,
    huntTitle,
    cityId,
    tourType: hunt.tourType === 'tour' ? 'tour' : 'hunt',
    huntIsFree: huntIsFree(hunt),
    state: 'lobby',
    createdAt: FieldValue.serverTimestamp(),
    startedAt: null,
    finishedAt: null,
    expiresAt,
    playerCount: 1,
    maxPlayers: MAX_PLAYERS,
  })
  batch.create(playerRef(roomDoc.id, user.uid), {
    userId: user.uid,
    displayName: cleanDisplayName(body.displayName, user.displayName),
    photoURL: cleanPhotoURL(user.photoURL),
    joinedAt: FieldValue.serverTimestamp(),
    isHost: true,
    score: 0,
    cluesDone: 0,
    finishedAt: null,
  })
  batch.set(userActiveRoomRef(user.uid), {
    roomId: roomDoc.id, code, huntId, huntTitle, state: 'lobby', sessionId: null,
    joinedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  return NextResponse.json({ roomId: roomDoc.id, code })
})
