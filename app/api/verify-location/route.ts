import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, num, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned } from '@/lib/sessionServer'
import { haversineM, bearingDeg } from '@/lib/geo'
import {
  type ClueDoc, type SessionClueDoc, navState, sessionDifficulty, unlockedTiersFor,
} from '@/lib/clueView'
import { performArrival, arrivalPayload, closeRoomIfDone, resolveAt, roomIdOf } from '@/lib/arrival'
import { arrivalRadiusM, warmthFor, type NotArrivedResponse } from '@/types'

/**
 * POST /api/verify-location — Authorization: Bearer <ID token>
 * Body: { sessionId, clueId, lat, lng, accuracy?, at?, debugArrive? }
 *   at          — ms epoch of the fix, for queued offline replays (accepted within 2 h)
 *   debugArrive — admins only: treat as arrived
 *
 * Not arrived → NotArrivedResponse { arrived:false, warmth, distanceM?, bearing?, totalScore }
 *   (distance/bearing only while the stop's navigation is 'compass')
 * Arrived     → ArrivalResponse (see types/index.ts)
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  rateLimit(`verify-location:${user.uid}`, 40, 60_000)

  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const clueId = id(body.clueId, 'clueId')
  const lat = num(body.lat, 'lat', -90, 90)
  const lng = num(body.lng, 'lng', -180, 180)
  const accuracy = body.accuracy === undefined || body.accuracy === null
    ? 0
    : num(body.accuracy, 'accuracy', 0, 100_000)
  const debugArrive = user.isAdmin && body.debugArrive === true

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')

  const clueSnap = await db.collection('hunts').doc(session.huntId).collection('clues').doc(clueId).get()
  if (!clueSnap.exists) throw new HttpError(404, 'clue_not_found')
  const clue = clueSnap.data() as ClueDoc

  const scSnap = await sessionRef.collection('sessionClues').doc(clueId).get()
  if (!scSnap.exists) throw new HttpError(403, 'clue_not_active')
  const sc = scSnap.data() as SessionClueDoc
  if (sc.arrivedAt) {
    return NextResponse.json(await arrivalPayload({ db, sessionRef, session, clueId, clue, alreadyConfirmed: true }))
  }

  const distanceM = haversineM(lat, lng, clue.lat, clue.lng)
  if (!debugArrive && distanceM > arrivalRadiusM(clue.radiusM, accuracy)) {
    const [difficulty, tiers] = await Promise.all([
      sessionDifficulty(db, session),
      unlockedTiersFor(sessionRef, clueId),
    ])
    const hasPuzzle = !!clue.puzzle?.prompt && !!clue.puzzle?.answer
    const nav = navState(
      difficulty,
      hasPuzzle && !!sc.puzzleSolvedAt,
      !!sc.pinRevealedAt || tiers.includes('3'),
    )
    const out: NotArrivedResponse = {
      arrived: false,
      warmth: warmthFor(distanceM),
      totalScore: Number(session.score) || 0,
    }
    if (nav.navigation === 'compass') {
      out.distanceM = Math.round(distanceM)
      out.bearing = Math.round(bearingDeg(lat, lng, clue.lat, clue.lng))
    }
    return NextResponse.json(out)
  }

  const result = await performArrival({
    db, uid: user.uid, sessionId, sessionRef, session, clueId, clue,
    atMs: resolveAt(body.at),
    skipSpeedCheck: debugArrive,
  })
  if (result.kind === 'not_active') throw new HttpError(403, 'clue_not_active')
  if (result.kind === 'implausible') throw new HttpError(422, 'implausible_speed')
  if (result.kind === 'arrived' && result.huntComplete) await closeRoomIfDone(db, roomIdOf(session))

  return NextResponse.json(await arrivalPayload({
    db, sessionRef, session, clueId, clue, alreadyConfirmed: result.kind === 'already',
  }))
})
