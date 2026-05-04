import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, query, orderBy, limit, writeBatch,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { roomId, userId } = await req.json()

  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  if (!roomId) return NextResponse.json({ error: 'room_required' }, { status: 400 })

  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) return NextResponse.json({ error: 'room_not_found' }, { status: 404 })
  const room = roomSnap.data()

  if (room.hostUserId !== userId) {
    return NextResponse.json({ error: 'not_host' }, { status: 403 })
  }
  if (room.state !== 'lobby') {
    return NextResponse.json({ error: 'already_started' }, { status: 409 })
  }

  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', room.huntId, 'clues'), orderBy('order'), limit(1))
  )
  if (cluesSnap.empty) return NextResponse.json({ error: 'no_clues' }, { status: 404 })
  const firstClue = cluesSnap.docs[0]

  const huntSnap = await getDoc(doc(db, 'hunts', room.huntId))
  const huntCity = huntSnap.exists() ? (huntSnap.data().city || null) : null

  const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'))

  const batch = writeBatch(db)

  for (const playerDoc of playersSnap.docs) {
    const player = playerDoc.data()
    const sessionRef = doc(collection(db, 'sessions'))
    batch.set(sessionRef, {
      huntId: room.huntId,
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

  batch.update(roomRef, {
    state: 'racing',
    startedAt: serverTimestamp(),
  })

  await batch.commit()

  // Fetch the host's session id back so the client can navigate immediately.
  const hostPlayerSnap = await getDoc(doc(db, 'rooms', roomId, 'players', userId))
  const hostSessionId = hostPlayerSnap.exists() ? hostPlayerSnap.data().sessionId : null

  return NextResponse.json({ ok: true, hostSessionId })
}
