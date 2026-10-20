import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, getAuthUser } from '@/lib/apiAuth'
import { toMillis } from '@/lib/sessionServer'

export const dynamic = 'force-dynamic'

const MAX_SESSIONS = 200

/**
 * GET /api/user-progress — Authorization: Bearer <ID token> (optional: no
 * token → `{}`). `?userId=` is ignored.
 * → { [huntId]: { sessionId, cluesCompleted, totalClues, status, score } }
 * Per hunt: the best COMPLETED session, else the most recent in-progress one.
 */
export const GET = handle(async (req) => {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({})
  const db = adminDb()

  const sessionsSnap = await db.collection('sessions')
    .where('userId', '==', user.uid)
    .limit(MAX_SESSIONS)
    .get()

  type Entry = {
    sessionId: string
    cluesCompleted: number
    totalClues: number
    status: 'in_progress' | 'completed'
    score: number
    sortKey: number
  }
  const result: Record<string, Entry> = {}

  const docs = sessionsSnap.docs.filter(d => {
    const s = d.data()
    return typeof s.huntId === 'string' && s.abandoned !== true && !s.abandonedAt
  })
  const clueSnaps = await Promise.all(docs.map(d => d.ref.collection('sessionClues').get()))

  docs.forEach((sDoc, i) => {
    const s = sDoc.data()
    const cluesSnap = clueSnaps[i]
    const isCompleted = !!s.completedAt
    const score = typeof s.score === 'number' ? s.score : 0
    const entry: Entry = {
      sessionId: sDoc.id,
      cluesCompleted: cluesSnap.docs.filter(c => c.data().arrivedAt).length,
      totalClues: cluesSnap.size,
      status: isCompleted ? 'completed' : 'in_progress',
      score,
      // Completed sessions outrank in-progress ones; in-progress by recency.
      sortKey: isCompleted ? 1e15 + score : toMillis(s.startedAt),
    }
    const existing = result[s.huntId]
    if (!existing || entry.sortKey > existing.sortKey) result[s.huntId] = entry
  })

  const out: Record<string, Omit<Entry, 'sortKey'>> = {}
  for (const k in result) {
    const { sortKey: _sortKey, ...rest } = result[k]
    out[k] = rest
  }
  return NextResponse.json(out)
})
