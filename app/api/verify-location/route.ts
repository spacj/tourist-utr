import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { SCORE } from '@/types'
import {
  doc, getDoc, getDocs, collection, query, where, orderBy,
  writeBatch, serverTimestamp, increment,
} from 'firebase/firestore'

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000
  const r = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(r(lng2 - lng1)) * Math.cos(r(lat2))
  const x = Math.cos(r(lat1)) * Math.sin(r(lat2)) -
             Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(r(lng2 - lng1))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function compassDir(deg: number) {
  const dirs = ['north','north-east','east','south-east','south','south-west','west','north-west']
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

export async function POST(req: NextRequest) {
  const { sessionId, clueId, lat, lng } = await req.json()

  const sessionRef = doc(db, 'sessions', sessionId)
  const sessionSnap = await getDoc(sessionRef)
  if (!sessionSnap.exists()) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const session = sessionSnap.data()

  const clueSnap = await getDoc(doc(db, 'hunts', session.huntId, 'clues', clueId))
  if (!clueSnap.exists()) return NextResponse.json({ error: 'Clue not found' }, { status: 404 })
  const clue = clueSnap.data()

  const scRef = doc(db, 'sessions', sessionId, 'sessionClues', clueId)
  const scSnap = await getDoc(scRef)
  if (!scSnap.exists()) return NextResponse.json({ error: 'Clue not active' }, { status: 403 })
  const sc = scSnap.data()

  if (sc.arrivedAt) return NextResponse.json({ arrived: true, alreadyConfirmed: true })

  const distanceM = haversineM(lat, lng, clue.lat, clue.lng)
  const bearing = bearingDeg(lat, lng, clue.lat, clue.lng)
  const rounded = Math.round(distanceM / 10) * 10

  if (distanceM > clue.radiusM) {
    return NextResponse.json({
      arrived: false,
      distanceM: Math.round(distanceM),
      bearing,
      dynamicHint3: `You're about ${rounded}m ${compassDir(bearing)} of the location.`,
    })
  }

  // --- Scoring ---

  const hintsSnap = await getDocs(
    query(collection(db, 'sessions', sessionId, 'hintUnlocks'), where('clueId', '==', clueId))
  )
  const hintTiers = hintsSnap.docs.map(d => d.data().tier as number)
  const hintPenalty = hintsSnap.docs.reduce((acc: number, d) => {
    const h = d.data()
    if (h.tier === 2) return acc + SCORE.hint2Penalty
    if (h.tier === 3) return acc + SCORE.hint3Penalty
    return acc
  }, 0)

  const elapsedMs = Date.now() - sc.unlockedAt.toMillis()
  const timeFraction = Math.max(0, 1 - elapsedMs / SCORE.timeBonusWindowMs)
  const timeBonus = Math.round(SCORE.timeBonus * timeFraction)

  const usedNoHints = hintTiers.length === 0
  const perfectBonus = usedNoHints ? SCORE.perfectClueBonus : 0

  // Streak: count consecutive completed clues that also earned time bonus
  const allScSnap = await getDocs(collection(db, 'sessions', sessionId, 'sessionClues'))
  const completedClues = allScSnap.docs
    .filter(d => d.data().arrivedAt !== null)
    .sort((a, b) => {
      const aTime = a.data().arrivedAt?.toMillis?.() ?? 0
      const bTime = b.data().arrivedAt?.toMillis?.() ?? 0
      return bTime - aTime
    })

  let streak = 0
  for (const d of completedClues) {
    if ((d.data().pointsEarned ?? 0) >= SCORE.base) {
      streak++
    } else {
      break
    }
  }
  if (timeBonus > 0 && usedNoHints) streak++
  else streak = 0

  const streakBonus = streak >= 2 ? SCORE.streakBonus * (streak - 1) : 0

  const pointsEarned = Math.max(0, SCORE.base + timeBonus + perfectBonus + streakBonus - hintPenalty)

  // --- Next clue ---

  const allCluesSnap = await getDocs(
    query(collection(db, 'hunts', session.huntId, 'clues'), orderBy('order'))
  )
  const totalClues = allCluesSnap.size
  const nextClueDoc = allCluesSnap.docs.find(d => d.data().order === clue.order + 1)

  const batch = writeBatch(db)

  batch.update(scRef, { arrivedAt: serverTimestamp(), pointsEarned })
  batch.update(sessionRef, {
    score: increment(pointsEarned),
    streak: streak,
  })

  if (nextClueDoc) {
    const nextScRef = doc(db, 'sessions', sessionId, 'sessionClues', nextClueDoc.id)
    batch.set(nextScRef, {
      clueId: nextClueDoc.id,
      unlockedAt: serverTimestamp(),
      arrivedAt: null,
      pointsEarned: 0,
    })
  } else {
    batch.update(sessionRef, { completedAt: serverTimestamp() })
  }

  await batch.commit()

  const nextClue = nextClueDoc
    ? { id: nextClueDoc.id, ...nextClueDoc.data(), totalClues }
    : null

  return NextResponse.json({
    arrived: true,
    pointsEarned,
    timeBonus,
    streakBonus,
    perfectBonus,
    hintPenalty,
    streak,
    funFact: clue.funFact ?? null,
    huntComplete: !nextClueDoc,
    nextClue,
  })
}