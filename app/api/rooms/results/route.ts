import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser, id, HttpError } from '@/lib/apiAuth'
import { roomRef, millis } from '@/lib/roomsServer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rooms/results?roomId=…
 * Auth: registered user who is a player in the room.
 *
 * Players are identified by `key` (join order) + `isYou`; other players'
 * uids and sessionIds are never returned. The caller's own session id is
 * returned as `mySessionId`. Stop names are revealed only once the caller
 * has finished (or the race is over) so results can't spoil the route.
 */
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser(req, { registered: true })
  const roomId = id(req.nextUrl.searchParams.get('roomId'), 'roomId')
  const db = adminDb()
  const rRef = roomRef(roomId)

  const [roomSnap, playersSnap, privateSnap] = await Promise.all([
    rRef.get(),
    rRef.collection('players').orderBy('joinedAt').get(),
    rRef.collection('private').get(),
  ])
  if (!roomSnap.exists) throw new HttpError(404, 'not_found')
  const me = playersSnap.docs.find(d => d.id === user.uid)
  if (!me) throw new HttpError(403, 'not_a_player')

  const room = roomSnap.data()!
  const huntId = String(room.huntId)
  const reveal = room.state === 'finished' || me.data().finishedAt != null

  // uid → sessionId (server-only mapping written at race start).
  const sessionOf = new Map<string, string>()
  privateSnap.docs.forEach(d => {
    const sid = d.data().sessionId
    if (typeof sid === 'string') sessionOf.set(d.id, sid)
  })
  // Legacy rooms (pre-mapping): one query by roomId instead of a full scan.
  if (sessionOf.size === 0 && room.state !== 'lobby') {
    const legacy = await db.collection('sessions').where('roomId', '==', roomId).get()
    legacy.docs.forEach(d => {
      const uid = d.data().userId
      if (typeof uid === 'string' && !sessionOf.has(uid)) sessionOf.set(uid, d.id)
    })
  }

  const cluesSnap = await db.collection('hunts').doc(huntId).collection('clues').orderBy('order').get()
  const clues = cluesSnap.docs.map((d, i) => {
    const c = d.data()
    return {
      id: d.id,
      order: typeof c.order === 'number' ? c.order : i,
      locationName: reveal ? (c.locationName ?? null) : null,
      theme: typeof c.theme === 'string' ? c.theme : null,
      icon: c.icon ?? '📍',
      i18n: reveal && c.i18n ? pickLocationI18n(c.i18n) : null,
    }
  })
  const clueMap = new Map(clues.map(c => [c.id, c]))

  const startedAt = millis(room.startedAt)

  const results = await Promise.all(playersSnap.docs.map(async (playerDoc, joinIndex) => {
    const p = playerDoc.data()
    const sessionId = sessionOf.get(playerDoc.id) ?? null

    let clueTimes: {
      clueId: string; locationName: string | null; icon: string; order: number
      arrivedAt: number | null; pointsEarned: number
    }[] = []
    if (sessionId) {
      const scSnap = await db.collection('sessions').doc(sessionId).collection('sessionClues').get()
      clueTimes = scSnap.docs.map(scDoc => {
        const sc = scDoc.data()
        const info = clueMap.get(scDoc.id)
        return {
          clueId: scDoc.id,
          locationName: info?.locationName ?? null,
          icon: info?.icon ?? '📍',
          order: info?.order ?? 0,
          arrivedAt: millis(sc.arrivedAt),
          pointsEarned: sc.pointsEarned ?? 0,
        }
      }).sort((a, b) => a.order - b.order)
    }

    const finishedAt = millis(p.finishedAt)
    return {
      key: `p${joinIndex}`,
      isYou: playerDoc.id === user.uid,
      displayName: p.displayName || 'Player',
      photoURL: p.photoURL ?? null,
      isHost: !!p.isHost,
      abandoned: !!p.abandoned,
      score: p.score ?? 0,
      cluesDone: p.cluesDone ?? 0,
      finishedAt,
      totalTime: startedAt && finishedAt ? finishedAt - startedAt : null,
      clueTimes,
    }
  }))

  // Finished players first by time, then by progress, then score.
  results.sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt
    if (a.finishedAt) return -1
    if (b.finishedAt) return 1
    if (b.cluesDone !== a.cluesDone) return b.cluesDone - a.cluesDone
    return b.score - a.score
  })

  return NextResponse.json({
    roomId,
    code: room.code,
    huntId,
    huntTitle: room.huntTitle,
    state: room.state,
    startedAt,
    finishedAt: millis(room.finishedAt),
    mySessionId: sessionOf.get(user.uid) ?? null,
    clues,
    results,
  })
})

/** Only the localized location names — never riddles/answers from i18n. */
function pickLocationI18n(i18n: Record<string, any>): Record<string, { locationName?: string }> {
  const out: Record<string, { locationName?: string }> = {}
  for (const [lang, v] of Object.entries(i18n ?? {})) {
    if (v && typeof v.locationName === 'string') out[lang] = { locationName: v.locationName }
  }
  return out
}
