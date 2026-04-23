import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const huntId = req.nextUrl.searchParams.get('huntId')
  const userId = req.nextUrl.searchParams.get('userId')
  if (!huntId) return NextResponse.json({ error: 'Missing huntId' }, { status: 400 })

  try {
    const sessionsSnap = await getDocs(
      query(
        collection(db, 'sessions'),
        where('huntId', '==', huntId),
        where('completedAt', '!=', null),
      )
    )

    const entries = await Promise.all(
      sessionsSnap.docs.map(async (sDoc) => {
        const s = sDoc.data()
        let displayName = 'Anonymous'
        if (s.userId) {
          const userDoc = await getDoc(doc(db, 'users', s.userId)).catch(() => null)
          if (userDoc?.exists()) {
            displayName = userDoc.data().displayName ?? 'Anonymous'
          }
        }
        return {
          sessionId: sDoc.id,
          userId: s.userId ?? null,
          displayName,
          score: s.score ?? 0,
          completedAt: s.completedAt?.toMillis?.() ?? 0,
        }
      })
    )

    entries.sort((a, b) => b.score - a.score || a.completedAt - b.completedAt)

    const top10 = entries.slice(0, 10).map((e, i) => ({
      rank: i + 1,
      displayName: e.displayName,
      score: e.score,
      completedAt: e.completedAt,
      isYou: userId ? e.userId === userId : false,
    }))

    let yourRank = null
    if (userId) {
      const idx = entries.findIndex(e => e.userId === userId)
      if (idx >= 0) {
        yourRank = {
          rank: idx + 1,
          score: entries[idx].score,
          total: entries.length,
        }
      }
    }

    return NextResponse.json({ leaderboard: top10, yourRank, totalPlayers: entries.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}