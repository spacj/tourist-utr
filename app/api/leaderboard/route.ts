import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { handle, getAuthUser, id, rateLimit, clientIp } from '@/lib/apiAuth'
import { toMillis } from '@/lib/sessionServer'

export const dynamic = 'force-dynamic'

const TOP_N = 10
/** Hard cap on sessions scanned per hunt. */
const MAX_SESSIONS = 2000

/**
 * GET /api/leaderboard?huntId=X — public. An optional `Authorization: Bearer`
 * token fills `isYou` / `yourRank`; `?userId=` is ignored.
 * One row per player (their best completed score). Ties are broken by total
 * time (completedAt − startedAt): faster ranks higher (GAME_DESIGN.md).
 */
export const GET = handle(async (req) => {
  rateLimit(`leaderboard:${clientIp(req)}`, 60, 60_000)
  const huntId = id(req.nextUrl.searchParams.get('huntId'), 'huntId')
  const me = await getAuthUser(req)
  const db = adminDb()

  const snap = await db.collection('sessions')
    .where('huntId', '==', huntId)
    .select('userId', 'score', 'startedAt', 'completedAt', 'abandoned', 'abandonedAt', 'tourType')
    .limit(MAX_SESSIONS)
    .get()

  // Best completed score per user (faster total time breaks ties).
  const best = new Map<string, { score: number; completedAt: number; durationMs: number }>()
  for (const d of snap.docs) {
    const s = d.data()
    if (!s.userId || !s.completedAt || s.abandoned === true || s.abandonedAt || s.tourType === 'tour') continue
    const score = typeof s.score === 'number' ? s.score : 0
    const completedAt = toMillis(s.completedAt)
    const startedAt = toMillis(s.startedAt)
    const durationMs = startedAt && completedAt >= startedAt ? completedAt - startedAt : Number.MAX_SAFE_INTEGER
    const prev = best.get(s.userId)
    if (!prev || score > prev.score || (score === prev.score && durationMs < prev.durationMs)) {
      best.set(s.userId, { score, completedAt, durationMs })
    }
  }

  const entries = Array.from(best, ([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || a.completedAt - b.completedAt)

  const top = entries.slice(0, TOP_N)
  const userSnaps = top.length
    ? await db.getAll(...top.map(e => db.collection('users').doc(e.userId)))
    : []

  const leaderboard = top.map((e, i) => {
    const u = userSnaps[i]?.exists ? userSnaps[i].data() : undefined
    return {
      rank: i + 1,
      displayName: (typeof u?.displayName === 'string' && u.displayName) || 'Anonymous',
      photoURL: (typeof u?.photoURL === 'string' && u.photoURL) || null,
      score: e.score,
      completedAt: e.completedAt,
      durationMs: e.durationMs === Number.MAX_SAFE_INTEGER ? null : e.durationMs,
      isYou: !!me && e.userId === me.uid,
    }
  })

  let yourRank: { rank: number; score: number; total: number } | null = null
  if (me) {
    const idx = entries.findIndex(e => e.userId === me.uid)
    if (idx >= 0) yourRank = { rank: idx + 1, score: entries[idx].score, total: entries.length }
  }

  return NextResponse.json({ leaderboard, yourRank, totalPlayers: entries.length })
})
