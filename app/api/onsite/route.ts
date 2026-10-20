import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, str, num, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned, type SessionDoc } from '@/lib/sessionServer'
import { haversineM } from '@/lib/geo'
import {
  type ClueDoc, type SessionClueDoc, hasVerifiedOnSite, matchesAnswer, onSiteExplain, txt,
} from '@/lib/clueView'
import {
  performArrival, arrivalPayload, closeRoomIfDone, applyStopPoints, readRoomPlayer,
  resolveAt, roomIdOf,
} from '@/lib/arrival'
import { SCORE, ONSITE_MAX_ATTEMPTS, CHECKIN_MAX_DISTANCE_M } from '@/types'

/**
 * POST /api/onsite — Authorization: Bearer <ID token>
 * Body: { sessionId, clueId, answer?, lat?, lng?, accuracy?, at? }
 *
 * Without `answer` → { mode: 'peek', question: Txt, attemptsLeft } (the
 *   question text for the "I'm here" dialog; it isn't part of the clue view).
 *
 * Only for stops whose on-site question is verified (onSite.fieldChecked).
 * Max 3 attempts per stop, shared between check-in and the on-site phase.
 *
 * After arrival (the on-site question phase):
 *   → { mode: 'question', correct, attemptsLeft, done, bonus, explain: Txt|null, totalScore }
 *
 * Before arrival ("I'm here" manual check-in, when GPS is denied/poor):
 *   wrong          → { mode: 'checkin', arrived: false, correct: false, attemptsLeft }
 *   right, >300 m  → { mode: 'checkin', arrived: false, correct: true, tooFar: true, distanceM, attemptsLeft }
 *   right, ≤300 m or no coords → performs the arrival:
 *                    ArrivalResponse & { mode: 'checkin', correct: true, bonus, explain }
 *   no attempts left → 409 no_attempts_left
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const clueId = id(body.clueId, 'clueId')
  const peek = body.answer === undefined || body.answer === null || body.answer === ''
  const answer = peek ? '' : str(body.answer, 'answer', 200)
  rateLimit(`onsite:${user.uid}:${clueId}`, 10, 60_000)
  const hasCoords = typeof body.lat === 'number' && typeof body.lng === 'number'
  const lat = hasCoords ? num(body.lat, 'lat', -90, 90) : null
  const lng = hasCoords ? num(body.lng, 'lng', -180, 180) : null

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')

  const clueSnap = await db.collection('hunts').doc(session.huntId).collection('clues').doc(clueId).get()
  if (!clueSnap.exists) throw new HttpError(404, 'clue_not_found')
  const clue = clueSnap.data() as ClueDoc
  if (!hasVerifiedOnSite(clue)) throw new HttpError(400, 'no_onsite')

  const scRef = sessionRef.collection('sessionClues').doc(clueId)
  const scSnap = await scRef.get()
  if (!scSnap.exists) throw new HttpError(403, 'clue_not_active')
  const sc = scSnap.data() as SessionClueDoc
  if (peek) {
    return NextResponse.json({
      mode: 'peek',
      question: txt(clue.onSite!.question, clue.i18n, tr => tr?.onSite?.question),
      attemptsLeft: Math.max(0, ONSITE_MAX_ATTEMPTS - Number(sc.onSite?.attempts ?? 0)),
    })
  }
  const correct = matchesAnswer(clue.onSite!.answer, answer)
  const isTour = session.tourType === 'tour'

  // ── On-site question phase (already arrived) ──
  if (sc.arrivedAt) {
    const r = await db.runTransaction(async (tx) => {
      const [fresh, scNow, player] = await Promise.all([
        tx.get(sessionRef), tx.get(scRef), readRoomPlayer(tx, db, session, user.uid),
      ])
      const s = (fresh.data() ?? {}) as SessionDoc
      const scData = (scNow.data() ?? {}) as SessionClueDoc
      const attempts = Number(scData.onSite?.attempts ?? 0)
      const total = Number(s.score) || 0
      if (scData.onSite?.correct) return { correct: true, attempts, bonus: 0, totalScore: total }
      if (attempts >= ONSITE_MAX_ATTEMPTS) return { correct: false, attempts, bonus: 0, totalScore: total }
      const next = attempts + 1
      if (!correct) {
        tx.update(scRef, { onSite: { attempts: next, correct: false } })
        return { correct: false, attempts: next, bonus: 0, totalScore: total }
      }
      const points = isTour ? 0 : SCORE.onSite
      const { totalScore } = applyStopPoints(tx, {
        sessionRef, sessionData: s, scRef, scData, field: 'onSite', points, player,
        extra: { onSite: { attempts: next, correct: true } },
      })
      return { correct: true, attempts: next, bonus: points, totalScore }
    })
    const attemptsLeft = Math.max(0, ONSITE_MAX_ATTEMPTS - r.attempts)
    const done = r.correct || attemptsLeft === 0
    return NextResponse.json({
      mode: 'question',
      correct: r.correct,
      attemptsLeft,
      done,
      bonus: r.bonus,
      explain: done ? onSiteExplain(clue) : null,
      totalScore: r.totalScore,
    })
  }

  // ── "I'm here" manual check-in ──
  const attempts = Number(sc.onSite?.attempts ?? 0)
  if (attempts >= ONSITE_MAX_ATTEMPTS) throw new HttpError(409, 'no_attempts_left')

  if (!correct) {
    const used = await db.runTransaction(async (tx) => {
      const scNow = await tx.get(scRef)
      const d = (scNow.data() ?? {}) as SessionClueDoc
      if (d.arrivedAt) return Number(d.onSite?.attempts ?? 0)
      const next = Number(d.onSite?.attempts ?? 0) + 1
      tx.update(scRef, { onSite: { attempts: next, correct: false } })
      return next
    })
    return NextResponse.json({
      mode: 'checkin', arrived: false, correct: false,
      attemptsLeft: Math.max(0, ONSITE_MAX_ATTEMPTS - used),
    })
  }

  if (hasCoords) {
    const d = haversineM(lat!, lng!, clue.lat, clue.lng)
    if (d > CHECKIN_MAX_DISTANCE_M) {
      return NextResponse.json({
        mode: 'checkin', arrived: false, correct: true, tooFar: true,
        distanceM: Math.round(d), attemptsLeft: ONSITE_MAX_ATTEMPTS - attempts,
      })
    }
  }

  const result = await performArrival({
    db, uid: user.uid, sessionId, sessionRef, session, clueId, clue,
    atMs: resolveAt(body.at),
    onSiteCorrect: true,
    onSiteAttempts: attempts + 1,
  })
  if (result.kind === 'not_active') throw new HttpError(403, 'clue_not_active')
  if (result.kind === 'implausible') throw new HttpError(422, 'implausible_speed')
  if (result.kind === 'arrived' && result.huntComplete) await closeRoomIfDone(db, roomIdOf(session))

  const payload = await arrivalPayload({
    db, sessionRef, session, clueId, clue, alreadyConfirmed: result.kind === 'already',
  })
  return NextResponse.json({
    ...payload,
    mode: 'checkin',
    correct: true,
    bonus: result.kind === 'arrived' ? result.breakdown.onSite : 0,
    explain: onSiteExplain(clue),
  })
})
