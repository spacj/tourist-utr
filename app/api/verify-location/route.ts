import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { SCORE } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

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

  const sessionRef = db.collection('sessions').doc(sessionId)
  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const session = sessionSnap.data()!

  const clueSnap = await db.collection('hunts').doc(session.huntId).collection('clues').doc(clueId).get()
  if (!clueSnap.exists) return NextResponse.json({ error: 'Clue not found' }, { status: 404 })
  const clue = clueSnap.data()!

  const scSnap = await sessionRef.collection('sessionClues').doc(clueId).get()
  if (!scSnap.exists) return NextResponse.json({ error: 'Clue not active' }, { status: 403 })
  const sc = scSnap.data()!

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

  // Compute score
  const hintsSnap = await sessionRef.collection('hintUnlocks')
    .where('clueId', '==', clueId).get()
  const hintPenalty = hintsSnap.docs.reduce((acc: number, doc) => {
    const h = doc.data()
    if (h.tier === 2) return acc + SCORE.hint2Penalty
    if (h.tier === 3) return acc + SCORE.hint3Penalty
    return acc
  }, 0)
  const elapsedMs = Date.now() - sc.unlockedAt.toMillis()
  const timeBonus = elapsedMs < SCORE.timeBonusWindowMs ? SCORE.timeBonus : 0
  const pointsEarned = Math.max(0, SCORE.base + timeBonus - hintPenalty)

  const allCluesSnap = await db.collection('hunts').doc(session.huntId)
    .collection('clues').orderBy('order').get()
  const totalClues = allCluesSnap.size
  const nextClueDoc = allCluesSnap.docs.find(d => d.data().order === clue.order + 1)

  const batch = db.batch()

  batch.update(sessionRef.collection('sessionClues').doc(clueId), {
    arrivedAt: FieldValue.serverTimestamp(),
    pointsEarned,
  })
  batch.update(sessionRef, { score: FieldValue.increment(pointsEarned) })

  if (nextClueDoc) {
    batch.set(sessionRef.collection('sessionClues').doc(nextClueDoc.id), {
      clueId: nextClueDoc.id,
      unlockedAt: FieldValue.serverTimestamp(),
      arrivedAt: null,
      pointsEarned: 0,
    })
  } else {
    batch.update(sessionRef, { completedAt: FieldValue.serverTimestamp() })
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
