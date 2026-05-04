import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { generateUniqueCode, ROOM_TTL_HOURS, MAX_PLAYERS } from '@/lib/rooms'
import { isCityUnlocked } from '@/lib/cityUnlock'
import {
  collection, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { huntId, userId, displayName, photoURL } = await req.json()

  if (!userId) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  if (!huntId) return NextResponse.json({ error: 'hunt_required' }, { status: 400 })

  const huntSnap = await getDoc(doc(db, 'hunts', huntId))
  if (!huntSnap.exists()) return NextResponse.json({ error: 'hunt_not_found' }, { status: 404 })
  const hunt = huntSnap.data() as { cityId?: string; title?: string; order?: number }

  // Host needs to own the hunt: free first hunt, or city unlocked.
  const isFree = (hunt.order ?? 0) === 0
  if (!isFree) {
    const unlocked = hunt.cityId ? await isCityUnlocked(userId, hunt.cityId) : false
    if (!unlocked) {
      return NextResponse.json({ error: 'city_locked', cityId: hunt.cityId ?? null }, { status: 402 })
    }
  }

  const code = await generateUniqueCode()
  const now = Date.now()
  const expiresAt = now + ROOM_TTL_HOURS * 60 * 60 * 1000

  const roomRef = doc(collection(db, 'rooms'))
  await setDoc(roomRef, {
    code,
    hostUserId: userId,
    huntId,
    huntTitle: hunt.title || 'Hunt',
    cityId: hunt.cityId ?? null,
    state: 'lobby',
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
    expiresAt,
    playerCount: 1,
    maxPlayers: MAX_PLAYERS,
  })

  await setDoc(doc(db, 'rooms', roomRef.id, 'players', userId), {
    userId,
    displayName: displayName || 'Player',
    photoURL: photoURL || null,
    joinedAt: serverTimestamp(),
    isHost: true,
    sessionId: null,
    score: 0,
    cluesDone: 0,
    finishedAt: null,
  })

  return NextResponse.json({ roomId: roomRef.id, code })
}
