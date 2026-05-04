import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import {
  collection, doc, getDoc, getDocs, runTransaction, serverTimestamp,
  query, orderBy, limit, writeBatch,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { roomId, userId } = await req.json()

  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  if (!roomId) return NextResponse.json({ error: 'room_required' }, { status: 400 })

  const roomRef = doc(db, 'rooms', roomId)

  // Step 1 — atomically claim the start.
  // Only the host, only from 'lobby', and the state flip happens inside the transaction
  // so any concurrent join still sees state='lobby' until commit, and the lobby check
  // in the join API rejects newcomers from this point on.
  type ClaimResult =
    | { ok: true; huntId: string }
    | { ok: false; reason: 'not_found' | 'not_host' | 'already_started' }

  const claim: ClaimResult = await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef)
    if (!snap.exists()) return { ok: false, reason: 'not_found' as const }
    const r = snap.data()
    if (r.hostUserId !== userId) return { ok: false, reason: 'not_host' as const }
    if (r.state !== 'lobby') return { ok: false, reason: 'already_started' as const }
    tx.update(roomRef, { state: 'racing', startedAt: serverTimestamp() })
    return { ok: true, huntId: r.huntId }
  })

  if (!claim.ok) {
    const status = claim.reason === 'not_host' ? 403
      : claim.reason === 'not_found' ? 404
      : 409
    return NextResponse.json({ error: claim.reason }, { status })
  }

  // Step 2 — load the hunt's first clue + city.
  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', claim.huntId, 'clues'), orderBy('order'), limit(1))
  )
  if (cluesSnap.empty) {
    // Roll back the state flip so the host can retry.
    await runTransaction(db, async (tx) => {
      const s = await tx.get(roomRef)
      if (s.exists() && s.data().state === 'racing' && !s.data().startedAt) {
        tx.update(roomRef, { state: 'lobby', startedAt: null })
      }
    }).catch(() => {})
    return NextResponse.json({ error: 'no_clues' }, { status: 404 })
  }
  const firstClue = cluesSnap.docs[0]

  const huntSnap = await getDoc(doc(db, 'hunts', claim.huntId))
  const huntCity = huntSnap.exists() ? (huntSnap.data().city || null) : null

  // Step 3 — enroll every player who joined before the state flip.
  // Anyone joining after step 1 was rejected by the join API.
  const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'))

  const batch = writeBatch(db)
  let hostSessionId: string | null = null

  for (const playerDoc of playersSnap.docs) {
    const player = playerDoc.data()
    const sessionRef = doc(collection(db, 'sessions'))
    if (player.userId === userId) hostSessionId = sessionRef.id

    batch.set(sessionRef, {
      huntId: claim.huntId,
      huntCity,
      userId: player.userId,
      roomId,
      score: 0,
      credits: STARTING_CREDITS,
      startedAt: serverTimestamp(),
      completedAt: null,
    })
    batch.set(doc(db, 'sessions', sessionRef.id, 'sessionClues', firstClue.id), {
      clueId: firstClue.id,
      unlockedAt: serverTimestamp(),
      arrivedAt: null,
      pointsEarned: 0,
    })
    batch.update(doc(db, 'rooms', roomId, 'players', player.userId), {
      sessionId: sessionRef.id,
    })
  }

  await batch.commit()

  return NextResponse.json({ ok: true, hostSessionId })
}
