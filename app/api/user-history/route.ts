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

        return {
          id: sDoc.id,
          huntId: s.huntId,
          huntTitle: hunt?.title ?? 'Unknown',
          score: s.score,
          totalClues: cluesSnap.size,
          cluesCompleted: arrived,
          completedAt: s.completedAt,
          startedAt: s.startedAt?.toMillis?.() ?? 0,
        }
      })
    )

    sessions.sort((a, b) => b.startedAt - a.startedAt)
    return NextResponse.json(sessions)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
