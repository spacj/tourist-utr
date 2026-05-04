import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const roomId = req.nextUrl.searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'room_required' }, { status: 400 })

  const roomSnap = await getDoc(doc(db, 'rooms', roomId))
  if (!roomSnap.exists()) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const room = roomSnap.data()
  const huntId = room.huntId

  // Load all clues for this hunt.
  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', huntId, 'clues'), orderBy('order'))
  )
  const clues = cluesSnap.docs.map(d => ({
    id: d.id,
    order: d.data().order,
    locationName: d.data().locationName,
    icon: d.data().icon ?? '📍',
    i18n: d.data().i18n ?? null,
  }))

  // Load all players.
  const playersSnap = await getDocs(
    query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt'))
  )

  const startedAt = room.startedAt?.toMillis?.() ?? null

  const results = await Promise.all(
    playersSnap.docs.map(async (playerDoc) => {
      const p = playerDoc.data()
      const userId = p.userId

      // Find this player's session.
      let sessionId = p.sessionId ?? null
      if (!sessionId) {
        // Fallback: search sessions for this user + room.
        const sessionsSnap = await getDocs(
          query(
            collection(db, 'sessions'),
            orderBy('startedAt'),
          )
        )
        const match = sessionsSnap.docs.find(
          d => d.data().userId === userId && d.data().roomId === roomId
        )
        if (match) sessionId = match.id
      }

      let clueTimes: { clueId: string; locationName: string; icon: string; order: number; arrivedAt: number | null; pointsEarned: number }[] = []

      if (sessionId) {
        const scSnap = await getDocs(
          query(collection(db, 'sessions', sessionId, 'sessionClues'), orderBy('clueId'))
        )
        const clueMap = new Map(clues.map(c => [c.id, c]))
        clueTimes = scSnap.docs.map(scDoc => {
          const sc = scDoc.data()
          const clueInfo = clueMap.get(scDoc.id)
          return {
            clueId: scDoc.id,
            locationName: clueInfo?.locationName ?? scDoc.id,
            icon: clueInfo?.icon ?? '📍',
            order: clueInfo?.order ?? 0,
            arrivedAt: sc.arrivedAt?.toMillis?.() ?? null,
            pointsEarned: sc.pointsEarned ?? 0,
          }
        })
        clueTimes.sort((a, b) => a.order - b.order)
      }

      const finishedAt = p.finishedAt?.toMillis?.() ?? null
      const totalTime = startedAt && finishedAt ? finishedAt - startedAt : null

      return {
        userId,
        displayName: p.displayName || 'Player',
        photoURL: p.photoURL ?? null,
        isHost: !!p.isHost,
        sessionId,
        score: p.score ?? 0,
        cluesDone: p.cluesDone ?? 0,
        finishedAt,
        totalTime,
        clueTimes,
      }
    })
  )

  // Sort: finished players first by time, then by score.
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
    finishedAt: room.finishedAt?.toMillis?.() ?? null,
    clues,
    results,
  })
}
