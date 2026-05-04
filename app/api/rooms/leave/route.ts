import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { roomId, userId } = await req.json()
  if (!roomId || !userId) return NextResponse.json({ error: 'missing' }, { status: 400 })

  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) return NextResponse.json({ ok: true })

  const room = roomSnap.data()
  if (room.state !== 'lobby') {
    // Once racing, leaving doesn't remove the player record so the scoreboard stays coherent.
    return NextResponse.json({ ok: true, racing: true })
  }

  await deleteDoc(doc(db, 'rooms', roomId, 'players', userId))
  await updateDoc(roomRef, { playerCount: increment(-1) })
  return NextResponse.json({ ok: true })
}
