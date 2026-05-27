import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'

/**
 * POST /api/accuse  — body: { sessionId, suspect, weapon, place }
 *
 * Validates a mystery accusation against the hunt's solution (kept server-side
 * only, never shipped to the client). One accusation per session: the result
 * is stored idempotently so re-submitting can't farm the bonus. Returns the
 * solution ids so the finale can reveal the answer after the guess.
 */
const ACCUSE_BONUS = 300

export async function POST(req: NextRequest) {
  const { sessionId, suspect, weapon, place } = await req.json().catch(() => ({} as any))
  if (!sessionId || !suspect || !weapon || !place) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  const sessionRef = doc(db, 'sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)
  if (!sessionSnap.exists()) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  const session = sessionSnap.data() as { huntId?: string }
  if (!session.huntId) return NextResponse.json({ error: 'no_hunt' }, { status: 400 })

  const huntSnap = await getDoc(doc(db, 'hunts', session.huntId))
  const mystery = huntSnap.exists() ? (huntSnap.data() as any).mystery : null
  const solution = mystery?.solution
  if (!solution) return NextResponse.json({ error: 'not_a_mystery' }, { status: 400 })

  const correct = suspect === solution.suspect && weapon === solution.weapon && place === solution.place

  // One accusation per session — return the locked-in result on re-submit.
  const accuseRef = doc(db, 'sessions', sessionId, 'accusation', 'result')
  const existing = await getDoc(accuseRef)
  if (existing.exists()) {
    const d = existing.data() as { correct?: boolean }
    return NextResponse.json({ alreadyAccused: true, correct: !!d.correct, solution, bonus: 0 })
  }

  const bonus = correct ? ACCUSE_BONUS : 0
  await setDoc(accuseRef, { suspect, weapon, place, correct, bonus, at: serverTimestamp() })
  if (bonus > 0) await updateDoc(sessionRef, { score: increment(bonus) })

  return NextResponse.json({ correct, solution, bonus })
}
