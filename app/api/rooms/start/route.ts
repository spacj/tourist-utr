import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, HttpError } from '@/lib/apiAuth'
import { STARTING_CREDITS } from '@/types'
import { roomRef, privateRef, huntIsFree } from '@/lib/roomsServer'
import { userActiveRoomRef } from '@/lib/userActiveRoom'
import type { RoomStop } from '@/lib/rooms'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rooms/start  { roomId }
 * Auth: registered user who is the room's host.
 *
 * Everything (state flip to 'racing', one session per player, private
 * session mapping, active-room pointers, public `stops`/`clueCount`) commits
 * in ONE transaction, so a failed start leaves the room in 'lobby' — nothing
 * to roll back. The hunt's clues are loaded before the transaction, so a hunt
 * with no clues is rejected without touching the room.
 */
export const POST = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  const body = await readJson(req)
  const roomId = id(body.roomId, 'roomId')
  const db = adminDb()
  const rRef = roomRef(roomId)

  // Pre-checks (re-validated inside the transaction).
  const pre = await rRef.get()
  if (!pre.exists) throw new HttpError(404, 'not_found')
  const preRoom = pre.data()!
  if (preRoom.hostUserId !== user.uid) throw new HttpError(403, 'not_host')
  if (preRoom.state !== 'lobby') throw new HttpError(409, 'already_started')

  const huntId = String(preRoom.huntId)
  const [huntSnap, cluesSnap] = await Promise.all([
    db.collection('hunts').doc(huntId).get(),
    db.collection('hunts').doc(huntId).collection('clues').orderBy('order').get(),
  ])
  if (!huntSnap.exists) throw new HttpError(404, 'hunt_not_found')
  if (cluesSnap.empty) throw new HttpError(404, 'no_clues')
  const hunt = huntSnap.data()!
  const tourType: 'hunt' | 'tour' = hunt.tourType === 'tour' ? 'tour' : 'hunt'
  const freeHunt = huntIsFree(hunt)
  const cityId = typeof hunt.cityId === 'string' ? hunt.cityId : null
  const firstClue = cluesSnap.docs[0]

  // Public, spoiler-free stop list for the live scoreboard: no coordinates,
  // no answers, no location names.
  const stops: RoomStop[] = cluesSnap.docs.map(d => {
    const c = d.data()
    return {
      id: d.id,
      order: typeof c.order === 'number' ? c.order : 0,
      theme: typeof c.theme === 'string' ? c.theme : null,
      icon: typeof c.icon === 'string' ? c.icon : '📍',
    }
  })

  const hostSessionId = await db.runTransaction(async (tx) => {
    // ── reads ──
    const r = await tx.get(rRef)
    if (!r.exists) throw new HttpError(404, 'not_found')
    const room = r.data()!
    if (room.hostUserId !== user.uid) throw new HttpError(403, 'not_host')
    if (room.state !== 'lobby') throw new HttpError(409, 'already_started')

    const players = await tx.get(rRef.collection('players'))

    // ── writes ──
    let hostSid: string | null = null
    for (const p of players.docs) {
      const uid = p.id
      const sessionRef = db.collection('sessions').doc()
      if (uid === user.uid) hostSid = sessionRef.id

      tx.create(sessionRef, {
        huntId,
        huntCity: hunt.city || null,
        userId: uid,
        roomId,
        tourType,
        // Same flags as solo start-session (see docs/GAME_DESIGN.md).
        isFree: freeHunt,
        difficulty: ['easy', 'medium', 'hard'].includes(hunt.difficulty) ? hunt.difficulty : 'medium',
        cityId,
        score: 0,
        credits: tourType === 'tour' ? 0 : STARTING_CREDITS,
        startedAt: FieldValue.serverTimestamp(),
        completedAt: null,
      })
      tx.create(sessionRef.collection('sessionClues').doc(firstClue.id), {
        clueId: firstClue.id,
        unlockedAt: FieldValue.serverTimestamp(),
        arrivedAt: null,
        pointsEarned: 0,
      })
      // Server-only uid → session mapping (player docs are publicly readable).
      tx.set(privateRef(roomId, uid), { sessionId: sessionRef.id, userId: uid })
      tx.update(p.ref, { currentClueId: firstClue.id })
      tx.set(userActiveRoomRef(uid), {
        roomId,
        code: room.code,
        huntId,
        huntTitle: room.huntTitle ?? 'Hunt',
        state: 'racing',
        sessionId: sessionRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    tx.update(rRef, {
      state: 'racing',
      startedAt: FieldValue.serverTimestamp(),
      stops,
      clueCount: stops.length,
      tourType,
    })
    return hostSid
  })

  return NextResponse.json({ ok: true, hostSessionId })
})
