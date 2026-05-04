import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  try {
    const sessionsSnap = await getDocs(
      query(collection(db, 'sessions'), where('userId', '==', userId))
    )

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (sDoc) => {
        const s = sDoc.data()
        const huntSnap = await getDoc(doc(db, 'hunts', s.huntId))
        const hunt = huntSnap.exists() ? huntSnap.data() : null
        const cluesSnap = await getDocs(collection(db, 'sessions', sDoc.id, 'sessionClues'))
        const arrived = cluesSnap.docs.filter(c => c.data().arrivedAt).length

        let multiplayer: { roomCode: string; playerCount: number; rank: number; totalPlayers: number } | null = null
        if (s.roomId) {
          const roomSnap = await getDoc(doc(db, 'rooms', s.roomId))
          if (roomSnap.exists()) {
            const room = roomSnap.data()
            const playersSnap = await getDocs(collection(db, 'rooms', s.roomId, 'players'))
            const players = playersSnap.docs.map((d) => {
              const p = d.data()
              return {
                userId: p.userId,
                finishedAt: p.finishedAt?.toMillis?.() ?? null,
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
            const myIdx = players.findIndex((p) => p.userId === userId)
            multiplayer = {
              roomCode: room.code ?? '',
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
          score: s.score,
          totalClues: cluesSnap.size,
          cluesCompleted: arrived,
          completedAt: s.completedAt,
          startedAt: s.startedAt?.toMillis?.() ?? 0,
          multiplayer,
        }
      })
    )

    sessions.sort((a, b) => b.startedAt - a.startedAt)
    return NextResponse.json(sessions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
