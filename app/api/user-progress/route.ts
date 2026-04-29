import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

// Returns { [huntId]: { sessionId, cluesCompleted, totalClues, status, score } }.
// For each hunt, prefers the best COMPLETED session; otherwise the most recent
// in-progress one. The home page uses this to show Resume / Completed badges.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({})

  try {
    const sessionsSnap = await getDocs(
      query(collection(db, 'sessions'), where('userId', '==', userId))
    )

    type Entry = {
      sessionId: string
      cluesCompleted: number
      totalClues: number
      status: 'in_progress' | 'completed'
      score: number
      sortKey: number
    }
    const result: Record<string, Entry> = {}

    for (const sDoc of sessionsSnap.docs) {
      const s = sDoc.data()
      const cluesSnap = await getDocs(collection(db, 'sessions', sDoc.id, 'sessionClues'))
      const total = cluesSnap.size
      const done = cluesSnap.docs.filter(c => c.data().arrivedAt).length
      const isCompleted = !!s.completedAt
      const startedAt = s.startedAt?.toMillis?.() ?? 0
      const score = s.score ?? 0

      const entry: Entry = {
        sessionId: sDoc.id,
        cluesCompleted: done,
        totalClues: total,
        status: isCompleted ? 'completed' : 'in_progress',
        score,
        // completed entries score-based, in-progress recency-based.
        // Bias completed sessions higher than in-progress so they win when both exist.
        sortKey: isCompleted ? 1_000_000_000 + score : startedAt,
      }

      const existing = result[s.huntId]
      if (!existing || entry.sortKey > existing.sortKey) {
        result[s.huntId] = entry
      }
    }

    // Strip internal sort key
    const out: Record<string, Omit<Entry, 'sortKey'>> = {}
    for (const k in result) {
      const { sortKey, ...rest } = result[k]
      out[k] = rest
    }
    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
