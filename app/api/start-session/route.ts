import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import { isCityUnlocked } from '@/lib/cityUnlock'
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { huntId, userId } = await req.json()

  const huntSnap = await getDoc(doc(db, 'hunts', huntId))
  if (!huntSnap.exists()) return NextResponse.json({ error: 'Hunt not found' }, { status: 404 })

  // ── City-unlock gate ──
  // First hunt in any city (order === 0) is free for everyone.
  // Other hunts require the user to have unlocked the city (€5).
  const hunt = huntSnap.data() as { cityId?: string; city?: string; order?: number }
  const isFree = (hunt.order ?? 0) === 0
  if (!isFree) {
    if (!userId) {
      return NextResponse.json({ error: 'sign_in_required', cityId: hunt.cityId ?? null }, { status: 401 })
    }
    const unlocked = hunt.cityId ? await isCityUnlocked(userId, hunt.cityId) : false
    if (!unlocked) {
      return NextResponse.json({ error: 'city_locked', cityId: hunt.cityId ?? null }, { status: 402 })
    }
  }

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
    huntCity: hunt.city || null,
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
