import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, str, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned, type SessionDoc } from '@/lib/sessionServer'
import {
  type ClueDoc, type SessionClueDoc, matchesAnswer, sessionDifficulty, loadActiveClueView,
} from '@/lib/clueView'
import { applyStopPoints, readRoomPlayer } from '@/lib/arrival'
import { SCORE } from '@/types'

/**
 * POST /api/verify-puzzle — Authorization: Bearer <ID token>
 * Body: { sessionId, clueId, answer }
 *
 * Wrong → { correct: false }
 * Right → { correct: true, alreadyClaimed, bonus, totalScore, navigation, target, riddle, clue }
 *   bonus      — SCORE.puzzle the first time (0 on repeats / after arrival)
 *   navigation — the stop's navigation mode now that it's solved
 *   target     — exact target if the new mode allows it (else null)
 *   riddle     — the story text (Txt), now unlocked
 *   clue       — the refreshed ActiveClueView
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const clueId = id(body.clueId, 'clueId')
  const answer = str(body.answer, 'answer', 200)
  rateLimit(`verify-puzzle:${user.uid}:${clueId}`, 10, 60_000)

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')

  const clueSnap = await db.collection('hunts').doc(session.huntId).collection('clues').doc(clueId).get()
  if (!clueSnap.exists) throw new HttpError(404, 'clue_not_found')
  const clue = clueSnap.data() as ClueDoc
  if (!clue.puzzle?.answer) throw new HttpError(400, 'no_puzzle')

  if (!matchesAnswer(clue.puzzle.answer, answer)) return NextResponse.json({ correct: false })

  const scRef = sessionRef.collection('sessionClues').doc(clueId)
  const r = await db.runTransaction(async (tx) => {
    const [sc, fresh, player] = await Promise.all([
      tx.get(scRef),
      tx.get(sessionRef),
      readRoomPlayer(tx, db, session, user.uid),
    ])
    if (!sc.exists) return { kind: 'not_active' as const }
    const scData = sc.data() as SessionClueDoc
    const s = (fresh.data() ?? {}) as SessionDoc
    if (scData.puzzleSolvedAt || scData.arrivedAt) {
      return { kind: 'ok' as const, alreadyClaimed: true, bonus: 0, totalScore: Number(s.score) || 0 }
    }
    const points = session.tourType === 'tour' ? 0 : SCORE.puzzle
    const { totalScore } = applyStopPoints(tx, {
      sessionRef, sessionData: s, scRef, scData, field: 'puzzle', points, player,
      extra: { puzzleSolvedAt: FieldValue.serverTimestamp() },
    })
    return { kind: 'ok' as const, alreadyClaimed: false, bonus: points, totalScore }
  })
  if (r.kind === 'not_active') throw new HttpError(403, 'clue_not_active')

  const totalClues = (await db.collection('hunts').doc(session.huntId).collection('clues').count().get()).data().count
  const view = await loadActiveClueView({
    db, sessionRef, huntId: session.huntId, clueId,
    difficulty: await sessionDifficulty(db, session), totalClues, clue,
  })

  return NextResponse.json({
    correct: true,
    alreadyClaimed: r.alreadyClaimed,
    bonus: r.bonus,
    totalScore: r.totalScore,
    navigation: view?.navigation ?? 'warmth',
    target: view?.target ?? null,
    riddle: view?.riddle ?? null,
    clue: view,
  })
})
