import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { findRoomByCode, isRoomExpired, MAX_PLAYERS, normalizeCode } from '@/lib/rooms'
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, increment,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { code, userId, displayName, photoURL } = await req.json()

  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })

  const norm = normalizeCode(code || '')
  if (!norm) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

  const found = await findRoomByCode(norm)
  if (!found) return NextResponse.json({ error: 'invalid_code' }, { status: 404 })
  if (isRoomExpired(found.data)) return NextResponse.json({ error: 'invalid_code' }, { status: 410 })

  const { id: roomId, data: room } = found

  // Already a member? Idempotent return.
  const existingPlayer = await getDoc(doc(db, 'rooms', roomId, 'players', userId))
  if (existingPlayer.exists()) {
    return NextResponse.json({ roomId, code: room.code, rejoined: true })
  }

  if (room.state !== 'lobby') {
    return NextResponse.json({ error: 'race_started' }, { status: 409 })
  }

  const playersSnap = await getDocs(collection(db, 'rooms', roomId, 'players'))
  if (playersSnap.size >= (room.maxPlayers || MAX_PLAYERS)) {
    return NextResponse.json({ error: 'room_full' }, { status: 409 })
  }

  await setDoc(doc(db, 'rooms', roomId, 'players', userId), {
    userId,
    displayName: displayName || 'Player',
    photoURL: photoURL || null,
    joinedAt: serverTimestamp(),
    isHost: false,
    sessionId: null,
    score: 0,
    cluesDone: 0,
    finishedAt: null,
  })

  await updateDoc(doc(db, 'rooms', roomId), {
    playerCount: increment(1),
  })

  return NextResponse.json({ roomId, code: room.code, rejoined: false })
}
