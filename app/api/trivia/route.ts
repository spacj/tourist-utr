import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, num, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned, type SessionDoc } from '@/lib/sessionServer'
import {
  type ClueDoc, type SessionClueDoc, hasTrivia, triviaExplain, funFactTxt,
} from '@/lib/clueView'
import { applyStopPoints, readRoomPlayer } from '@/lib/arrival'
import { SCORE } from '@/types'

/**
 * POST /api/trivia — Authorization: Bearer <ID token>
 * Body: { sessionId, clueId, index }
 *
 * One attempt per stop, only after arrival. The fun fact is released here,
 * after the quiz, so it can't give the answer away.
 * → { correct, correctIndex, explain: Txt|null, bonus, funFact: Txt|null,
 *     totalScore, alreadyAnswered }
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  rateLimit(`trivia:${user.uid}`, 30, 60_000)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const clueId = id(body.clueId, 'clueId')
  const index = num(body.index, 'index', 0, 9)
  if (!Number.isInteger(index)) throw new HttpError(400, 'invalid_index')

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')

  const clueSnap = await db.collection('hunts').doc(session.huntId).collection('clues').doc(clueId).get()
  if (!clueSnap.exists) throw new HttpError(404, 'clue_not_found')
  const clue = clueSnap.data() as ClueDoc
  if (!hasTrivia(clue)) throw new HttpError(400, 'no_trivia')
  const correctIndex = clue.trivia!.correctIndex

  const scRef = sessionRef.collection('sessionClues').doc(clueId)
  const r = await db.runTransaction(async (tx) => {
    const [sc, fresh, player] = await Promise.all([
      tx.get(scRef),
      tx.get(sessionRef),
      readRoomPlayer(tx, db, session, user.uid),
    ])
    if (!sc.exists) return { kind: 'not_active' as const }
    const scData = sc.data() as SessionClueDoc
    if (!scData.arrivedAt) return { kind: 'not_arrived' as const }
    const s = (fresh.data() ?? {}) as SessionDoc
    if (typeof scData.trivia?.pickedIndex === 'number') {
      return {
        kind: 'ok' as const, alreadyAnswered: true, bonus: 0,
        correct: scData.trivia.correct === true, totalScore: Number(s.score) || 0,
      }
    }
    const correct = index === correctIndex
    const points = correct && session.tourType !== 'tour' ? SCORE.trivia : 0
    const { totalScore } = applyStopPoints(tx, {
      sessionRef, sessionData: s, scRef, scData, field: 'trivia', points, player,
      extra: { trivia: { pickedIndex: index, correct } },
    })
    return { kind: 'ok' as const, alreadyAnswered: false, bonus: points, correct, totalScore }
  })
  if (r.kind === 'not_active') throw new HttpError(403, 'clue_not_active')
  if (r.kind === 'not_arrived') throw new HttpError(409, 'not_arrived')

  return NextResponse.json({
    correct: r.correct,
    correctIndex,
    explain: triviaExplain(clue),
    bonus: r.bonus,
    funFact: funFactTxt(clue),
    totalScore: r.totalScore,
    alreadyAnswered: r.alreadyAnswered,
  })
})
