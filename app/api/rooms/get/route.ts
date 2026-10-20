import { NextRequest, NextResponse } from 'next/server'
import { handle, requireUser, rateLimit, clientIp, HttpError } from '@/lib/apiAuth'
import { ROOM_CODE_LEN, normalizeCode } from '@/lib/rooms'
import { findRoomByCode, roomRef, millis } from '@/lib/roomsServer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/get?code=ABC123
 * Auth: any signed-in user (anonymous ok). Read-only, rate-limited.
 * No uids/sessionIds of other players are returned — `isYou` flags the caller.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req)
  rateLimit(`rooms-lookup:uid:${user.uid}`, 20, 60_000)
  rateLimit(`rooms-lookup:ip:${clientIp(req)}`, 60, 60_000)

  const code = normalizeCode(req.nextUrl.searchParams.get('code') || '')
  if (code.length !== ROOM_CODE_LEN) throw new HttpError(400, 'invalid_code')

  const found = await findRoomByCode(code)
  if (!found) throw new HttpError(404, 'not_found')
  const room = found.data

  const playersSnap = await roomRef(found.id).collection('players').orderBy('joinedAt').get()
  const players = playersSnap.docs.map(d => {
    const p = d.data()
    return {
      displayName: p.displayName || 'Player',
      photoURL: p.photoURL ?? null,
      isHost: !!p.isHost,
      isYou: d.id === user.uid,
      score: p.score ?? 0,
      cluesDone: p.cluesDone ?? 0,
      finishedAt: millis(p.finishedAt),
      abandoned: !!p.abandoned,
    }
  })

  return NextResponse.json({
    roomId: found.id,
    code: room.code,
    huntId: room.huntId,
    huntTitle: room.huntTitle,
    cityId: room.cityId ?? null,
    state: room.state,
    isHost: room.hostUserId === user.uid,
    isMember: players.some(p => p.isYou),
    playerCount: players.length,
    maxPlayers: room.maxPlayers ?? null,
    startedAt: millis(room.startedAt),
    expiresAt: room.expiresAt ?? null,
    players,
  })
})
