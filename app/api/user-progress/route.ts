import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// Returns { [huntId]: { sessionId, cluesCompleted, totalClues } } for the user's
// in-progress sessions only. Used by the home page to show a "Resume" state.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({})

  try {
    const sessionsSnap = await getDocs(
      query(collection(db, 'sessions'), where('userId', '==', userId))
    )

    const inProgress = sessionsSnap.docs.filter(d => !d.data().completedAt)
    const result: Record<string, { sessionId: string; cluesCompleted: number; totalClues: number }> = {}

    for (const sDoc of inProgress) {
      const s = sDoc.data()
      const cluesSnap = await getDocs(collection(db, 'sessions', sDoc.id, 'sessionClues'))
      const total = cluesSnap.size
      const done = cluesSnap.docs.filter(c => c.data().arrivedAt).length
      // If multiple in-progress for same hunt, keep the most recent
      const existing = result[s.huntId]
      const startedAt = s.startedAt?.toMillis?.() ?? 0
      if (!existing || startedAt > (existing as any).startedAt) {
        result[s.huntId] = {
          sessionId: sDoc.id,
          cluesCompleted: done,
          totalClues: total,
          // @ts-expect-error attach sort key (dropped on client)
          startedAt,
        }
      }
    }

    // Strip internal sort key before returning
    for (const k in result) delete (result[k] as any).startedAt
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
