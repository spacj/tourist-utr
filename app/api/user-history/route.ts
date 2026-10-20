import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, requireUser } from '@/lib/apiAuth'
import { toMillis } from '@/lib/sessionServer'

export const dynamic = 'force-dynamic'

const MAX_SESSIONS = 200

/**
 * GET /api/user-history — Authorization: Bearer <ID token>.
 * The caller's own sessions, newest first. (`?userId=` is ignored.)
 */
export const GET = handle(async (req) => {
  const user = await requireUser(req)
  const db = adminDb()

  const sessionsSnap = await db.collection('sessions')
    .where('userId', '==', user.uid)
    .limit(MAX_SESSIONS)
    .get()

  const huntCache = new Map<string, Promise<FirebaseFirestore.DocumentData | null>>()
  const loadHunt = (huntId: string) => {
    if (!huntCache.has(huntId)) {
      huntCache.set(huntId, db.collection('hunts').doc(huntId).get().then(s => (s.exists ? s.data()! : null)))
    }
    return huntCache.get(huntId)!
  }

  const sessions = await Promise.all(
    sessionsSnap.docs.map(async (sDoc) => {
      const s = sDoc.data()
      const [hunt, cluesSnap] = await Promise.all([
        typeof s.huntId === 'string' && s.huntId ? loadHunt(s.huntId) : Promise.resolve(null),
        sDoc.ref.collection('sessionClues').get(),
      ])
      const arrived = cluesSnap.docs.filter(c => c.data().arrivedAt).length

      let multiplayer: { roomCode: string; playerCount: number; rank: number; totalPlayers: number } | null = null
      if (typeof s.roomId === 'string' && s.roomId) {
        const roomRef = db.collection('rooms').doc(s.roomId)
        const [roomSnap, playersSnap] = await Promise.all([roomRef.get(), roomRef.collection('players').get()])
        if (roomSnap.exists) {
          const players = playersSnap.docs.map((d) => {
            const p = d.data()
            return {
              userId: (p.userId as string | undefined) ?? d.id,
              finishedAt: toMillis(p.finishedAt) || null,
              cluesDone: p.cluesDone ?? 0,
              score: p.score ?? 0,
            }
          })
          players.sort((a, b) => {
            if (a.finishedAt && b.finishedAt) return a.finishedAt - b.finishedAt
            if (a.finishedAt) return -1
            if (b.finishedAt) return 1
            if (b.cluesDone !== a.cluesDone) return b.cluesDone - a.cluesDone
            return b.score - a.score
          })
          const myIdx = players.findIndex((p) => p.userId === user.uid)
          multiplayer = {
            roomCode: roomSnap.data()?.code ?? '',
            playerCount: players.length,
            rank: myIdx >= 0 ? myIdx + 1 : 0,
            totalPlayers: players.length,
          }
        }
      }

      return {
        id: sDoc.id,
        huntId: s.huntId,
        huntTitle: hunt?.title ?? 'Unknown',
        huntI18n: hunt?.i18n ?? null,
        score: s.score ?? 0,
        totalClues: cluesSnap.size,
        cluesCompleted: arrived,
        completedAt: toMillis(s.completedAt) || null,
        startedAt: toMillis(s.startedAt),
        multiplayer,
      }
    }),
  )

  sessions.sort((a, b) => b.startedAt - a.startedAt)
  return NextResponse.json(sessions)
})
