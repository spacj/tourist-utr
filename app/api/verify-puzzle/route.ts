import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { SCORE, normalizePuzzleAnswer } from '@/types'
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'

/**
 * POST /api/verify-puzzle
 *
 * Body: { sessionId, clueId, answer }
 *
 * Validates the player's answer against the clue's `puzzle.answer` field.
 * Multiple accepted answers can be `|`-separated in the seed
 * (e.g. "20|twenty|TWENTY"). Server normalizes both sides (strip case +
 * whitespace + punctuation + diacritics) before comparison.
 *
 * On the first correct answer for a (session, clue) pair, awards
 * `puzzle.bonus` (or SCORE.puzzleBonus by default) and writes a
 * sessions/{sessionId}/puzzleClaims/{clueId} doc for idempotency.
 *
 * Subsequent correct answers return `{ correct: true, alreadyClaimed: true }`
 * with no score change.
 */
export async function POST(req: NextRequest) {
  const { sessionId, clueId, answer } = await req.json()
  if (!sessionId || !clueId || typeof answer !== 'string') {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const sessionRef = doc(db, 'sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)
  if (!sessionSnap.exists()) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }
  const session = sessionSnap.data() as { huntId?: string }

  if (!session.huntId) {
    return NextResponse.json({ error: 'no_hunt' }, { status: 400 })
  }

  const clueSnap = await getDoc(doc(db, 'hunts', session.huntId, 'clues', clueId))
  if (!clueSnap.exists()) {
    return NextResponse.json({ error: 'clue_not_found' }, { status: 404 })
  }
  const clue = clueSnap.data() as { puzzle?: { answer?: string; bonus?: number } }

  if (!clue.puzzle?.answer) {
    return NextResponse.json({ error: 'no_puzzle' }, { status: 400 })
  }

  const accepted = clue.puzzle.answer.split('|').map(normalizePuzzleAnswer).filter(Boolean)
  const submitted = normalizePuzzleAnswer(answer)
  const correct = accepted.includes(submitted) && submitted.length > 0

  if (!correct) {
    return NextResponse.json({ correct: false })
  }

  // Already claimed?
  const claimRef = doc(db, 'sessions', sessionId, 'puzzleClaims', clueId)
  const claimSnap = await getDoc(claimRef)
  if (claimSnap.exists()) {
    return NextResponse.json({ correct: true, alreadyClaimed: true, bonus: 0 })
  }

  const bonus = clue.puzzle.bonus ?? SCORE.puzzleBonus

  await setDoc(claimRef, {
    clueId,
    bonus,
    submittedAt: serverTimestamp(),
  })
  await updateDoc(sessionRef, { score: increment(bonus) })

  return NextResponse.json({ correct: true, alreadyClaimed: false, bonus })
}
