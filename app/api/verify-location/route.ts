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

  const hintsSnap = await getDocs(
    query(collection(db, 'sessions', sessionId, 'hintUnlocks'), where('clueId', '==', clueId))
  )
  const hintPenalty = hintsSnap.docs.reduce((acc: number, d) => {
    const h = d.data()
    if (h.tier === 2) return acc + SCORE.hint2Penalty
    if (h.tier === 3) return acc + SCORE.hint3Penalty
    return acc
  }, 0)
  const elapsedMs = Date.now() - sc.unlockedAt.toMillis()
  const timeBonus = elapsedMs < SCORE.timeBonusWindowMs ? SCORE.timeBonus : 0
  const pointsEarned = Math.max(0, SCORE.base + timeBonus - hintPenalty)

  const allCluesSnap = await getDocs(
    query(collection(db, 'hunts', session.huntId, 'clues'), orderBy('order'))
  )
  const totalClues = allCluesSnap.size
  const nextClueDoc = allCluesSnap.docs.find(d => d.data().order === clue.order + 1)

  const batch = writeBatch(db)

  batch.update(scRef, { arrivedAt: serverTimestamp(), pointsEarned })
  batch.update(sessionRef, { score: increment(pointsEarned) })

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
    hintPenalty,
    huntComplete: !nextClueDoc,
    nextClue,
  })
}
