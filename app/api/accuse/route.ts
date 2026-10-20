import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned } from '@/lib/sessionServer'

/**
 * POST /api/accuse — Authorization: Bearer <ID token>
 * Body: { sessionId, suspect, weapon, place }
 *
 * One accusation per session, only after every stop has been found. The
 * accusation is recorded (create-once, in a transaction with the bonus)
 * BEFORE the solution is returned, so the solution can't be fished out with
 * a throwaway guess and then re-guessed.
 */
const ACCUSE_BONUS = 300

export const POST = handle(async (req) => {
  const user = await requireUser(req)
  rateLimit(`accuse:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const suspect = id(body.suspect, 'suspect')
  const weapon = id(body.weapon, 'weapon')
  const place = id(body.place, 'place')

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')

  const huntRef = db.collection('hunts').doc(session.huntId)
  // The solution lives in the server-only huntSecrets/{huntId}; older data
  // kept it on hunt.mystery.solution.
  const [secretSnap, huntSnap] = await Promise.all([
    db.collection('huntSecrets').doc(session.huntId).get(),
    huntRef.get(),
  ])
  type Solution = { suspect: string; weapon: string; place: string }
  const isSolution = (v: unknown): v is Solution =>
    !!v && typeof (v as Solution).suspect === 'string' &&
    typeof (v as Solution).weapon === 'string' && typeof (v as Solution).place === 'string'
  const secret = secretSnap.exists ? secretSnap.data()?.mysterySolution : undefined
  const legacy = huntSnap.exists ? huntSnap.data()?.mystery?.solution : undefined
  const solution: Solution | undefined = isSolution(secret) ? secret : isSolution(legacy) ? legacy : undefined
  if (!solution) throw new HttpError(400, 'not_a_mystery')

  // The case must be fully gathered: every stop of the hunt found.
  const [cluesCount, arrivedCount] = await Promise.all([
    huntRef.collection('clues').count().get(),
    sessionRef.collection('sessionClues').where('arrivedAt', '!=', null).count().get(),
  ])
  const total = cluesCount.data().count
  if (!session.completedAt || total === 0 || arrivedCount.data().count < total) {
    throw new HttpError(409, 'case_not_finished')
  }

  const correct = suspect === solution.suspect && weapon === solution.weapon && place === solution.place
  const accuseRef = sessionRef.collection('accusation').doc('result')

  const r = await db.runTransaction(async (tx) => {
    const existing = await tx.get(accuseRef)
    if (existing.exists) {
      return { alreadyAccused: true, correct: !!existing.data()?.correct, bonus: 0 }
    }
    const bonus = correct ? ACCUSE_BONUS : 0
    tx.create(accuseRef, { suspect, weapon, place, correct, bonus, at: FieldValue.serverTimestamp() })
    if (bonus > 0) tx.update(sessionRef, { score: FieldValue.increment(bonus) })
    return { alreadyAccused: false, correct, bonus }
  })

  // Recorded (now or earlier) → safe to reveal the solution. The full ending
  // (which names the culprit's motive) is the reward for a correct accusation.
  const story = secretSnap.exists ? secretSnap.data()?.solutionStory : undefined
  const solutionStory = r.correct && story && typeof story === 'object' ? story as Record<string, string> : null
  return NextResponse.json({ ...r, solution, solutionStory })
})
