import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { findRoomByCode, isRoomExpired, normalizeCode } from '@/lib/rooms'
import { collection, getDocs } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || ''
  const norm = normalizeCode(code)
  if (!norm) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

  const found = await findRoomByCode(norm)
  if (!found) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (isRoomExpired(found.data)) return NextResponse.json({ error: 'expired' }, { status: 410 })

  const playersSnap = await getDocs(collection(db, 'rooms', found.id, 'players'))
  const players = playersSnap.docs.map(d => {
    const p = d.data()
    return {
      userId: p.userId,
      displayName: p.displayName,
      photoURL: p.photoURL ?? null,
      isHost: !!p.isHost,
      score: p.score ?? 0,
      cluesDone: p.cluesDone ?? 0,
      finishedAt: p.finishedAt?.toMillis?.() ?? null,
    }
  })

  return NextResponse.json({
    roomId: found.id,
    code: found.data.code,
    huntId: found.data.huntId,
    huntTitle: found.data.huntTitle,
    cityId: found.data.cityId ?? null,
    state: found.data.state,
    hostUserId: found.data.hostUserId,
    startedAt: found.data.startedAt?.toMillis?.() ?? null,
    players,
  })
}
