import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { clearUserActiveRoom, getUserActiveRoom } from '@/lib/userActiveRoom'
import { doc, getDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { roomId, userId } = await req.json()
  if (!roomId || !userId) return NextResponse.json({ error: 'missing' }, { status: 400 })

  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) {
    // Room is gone — clear the user's active-room pointer if it still points here.
    const active = await getUserActiveRoom(userId)
    if (active?.roomId === roomId) await clearUserActiveRoom(userId)
    return NextResponse.json({ ok: true })
  }

  const room = roomSnap.data()
  if (room.state !== 'lobby') {
    // During a race, leaving doesn't remove the player record so the scoreboard
    // stays coherent. Use /api/rooms/abandon to truly bow out.
    return NextResponse.json({ ok: true, racing: true })
  }

  await deleteDoc(doc(db, 'rooms', roomId, 'players', userId))
  await updateDoc(roomRef, { playerCount: increment(-1) })

  // Clear the user's active-room pointer if it points to this room.
  const active = await getUserActiveRoom(userId)
  if (active?.roomId === roomId) await clearUserActiveRoom(userId)

  return NextResponse.json({ ok: true })
}
