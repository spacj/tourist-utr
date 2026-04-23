import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { huntId, userId } = await req.json()

  const huntSnap = await getDoc(doc(db, 'hunts', huntId))
  if (!huntSnap.exists()) return NextResponse.json({ error: 'Hunt not found' }, { status: 404 })

  // ── Resume an in-progress session if one exists for this user + hunt ──
  if (userId) {
    const existing = await getDocs(
      query(
        collection(db, 'sessions'),
        where('userId', '==', userId),
        where('huntId', '==', huntId),
      )
    )
    const inProgress = existing.docs
      .filter(d => !d.data().completedAt)
      .sort((a, b) => (b.data().startedAt?.toMillis?.() ?? 0) - (a.data().startedAt?.toMillis?.() ?? 0))
    if (inProgress.length) {
      return NextResponse.json({ sessionId: inProgress[0].id, resumed: true })
    }
  }

  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', huntId, 'clues'), orderBy('order'), limit(1))
  )
  if (cluesSnap.empty) return NextResponse.json({ error: 'No clues' }, { status: 404 })

  const firstClue = cluesSnap.docs[0]
  const sessionRef = doc(collection(db, 'sessions'))

  await setDoc(sessionRef, {
    huntId,
    userId: userId || null,
    score: 0,
    credits: STARTING_CREDITS,
    startedAt: serverTimestamp(),
    completedAt: null,
  })

  await setDoc(doc(db, 'sessions', sessionRef.id, 'sessionClues', firstClue.id), {
    clueId: firstClue.id,
    unlockedAt: serverTimestamp(),
    arrivedAt: null,
    pointsEarned: 0,
  })

  return NextResponse.json({ sessionId: sessionRef.id, resumed: false })
}
