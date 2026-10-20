import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { ROOM_TTL_HOURS, MAX_PLAYERS } from '@/lib/rooms'
import {
  allocateRoomCode, cleanDisplayName, cleanPhotoURL, playerRef,
} from '@/lib/roomsServer'
import { userActiveRoomRef, isUserInOtherRoom } from '@/lib/userActiveRoom'
import { getHuntAccess, huntLockedError, txClaimHuntAccess } from '@/lib/huntAccess'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/create  { huntId, displayName?, force? }
 * Auth: registered (non-anonymous) user. The host must own the hunt, or
 * spend their one free hunt on it — claimed in the same transaction that
 * creates the room. 402 hunt_locked { huntId, cityId, priceEuros } otherwise.
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

  if (hunt.active === false) throw new HttpError(404, 'hunt_not_found')
  const huntRef = { id: huntId, cityId, priceEuros: hunt.priceEuros }
  // Cheap pre-check so a locked hunt doesn't burn a room code.
  if ((await getHuntAccess(user.uid, huntRef)) === 'locked') throw huntLockedError(huntRef)

  const huntTitle = typeof hunt.title === 'string' && hunt.title ? hunt.title : 'Hunt'
  const expiresAt = Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000
  const roomDoc = db.collection('rooms').doc()
  const code = await allocateRoomCode(roomDoc.id, expiresAt)

  await db.runTransaction(async (tx) => {
    // Reads first: re-check access and, if needed, spend the free hunt on it.
    const claim = await txClaimHuntAccess(tx, user.uid, huntRef)
    claim.apply()
    tx.create(roomDoc, {
      code,
      hostUserId: user.uid,
      huntId,
      huntTitle,
      cityId,
      tourType: hunt.tourType === 'tour' ? 'tour' : 'hunt',
      state: 'lobby',
      createdAt: FieldValue.serverTimestamp(),
      startedAt: null,
      finishedAt: null,
      expiresAt,
      playerCount: 1,
      maxPlayers: MAX_PLAYERS,
    })
    tx.create(playerRef(roomDoc.id, user.uid), {
      userId: user.uid,
      displayName: cleanDisplayName(body.displayName, user.displayName),
      photoURL: cleanPhotoURL(user.photoURL),
      joinedAt: FieldValue.serverTimestamp(),
      isHost: true,
      score: 0,
      cluesDone: 0,
      finishedAt: null,
    })
    tx.set(userActiveRoomRef(user.uid), {
      roomId: roomDoc.id, code, huntId, huntTitle, state: 'lobby', sessionId: null,
      joinedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  })

  return NextResponse.json({ roomId: roomDoc.id, code })
})
