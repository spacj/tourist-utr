import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned, toMillis } from '@/lib/sessionServer'
import { SCORE, xpForHunt, levelFromXp, type PlayerProfile, type SessionVariant } from '@/types'

/**
 * POST /api/finish — Authorization: Bearer <ID token>; body: { sessionId }
 *
 * Rolls a completed hunt into the player's progression (users/{uid}, the
 * per-hunt record and the daily streak). The sessions/{id}/finish/result
 * marker is created in the SAME transaction as the XP award, so concurrent or
 * repeated calls can never award twice.
 */
function dayUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export const POST = handle(async (req) => {
  const user = await requireUser(req)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const uid = user.uid

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) return NextResponse.json({ skipped: 'abandoned' })
  if (!session.completedAt) return NextResponse.json({ skipped: 'incomplete' })
  if (session.tourType === 'tour') return NextResponse.json({ skipped: 'tour' })

  const markerRef = sessionRef.collection('finish').doc('result')
  const huntSnap = await db.collection('hunts').doc(session.huntId).get()
  const userRef = db.collection('users').doc(uid)
  const recordRef = userRef.collection('records').doc(session.huntId)

  const out = await db.runTransaction(async (tx) => {
    const [marker, fresh, scSnap, hintsSnap, userSnap, recordSnap] = await Promise.all([
      tx.get(markerRef),
      tx.get(sessionRef),
      tx.get(sessionRef.collection('sessionClues')),
      tx.get(sessionRef.collection('hintUnlocks')),
      tx.get(userRef),
      tx.get(recordRef),
    ])
    if (marker.exists) {
      const d = marker.data() as { level?: number; title?: string }
      return {
        xpGained: 0, level: d.level, title: d.title, leveledUp: false, newlyUnlocked: [] as string[],
        alreadyFinished: true,
      }
    }
    const s = fresh.data() ?? {}
    if (s.abandoned === true || s.abandonedAt) return { skipped: 'abandoned' as const }

    const arrived = scSnap.docs.filter(d => d.data().arrivedAt)
    const cluesArrived = arrived.length
    const totalClues = huntSnap.exists ? (huntSnap.data()?.clueCount ?? cluesArrived) : cluesArrived
    const variant: SessionVariant =
      s.variant === 'speedrun' || s.variant === 'nohints' ? s.variant : 'normal'

    const firstCompletion = !recordSnap.exists
    const score: number = s.score ?? 0
    const xpGained = xpForHunt({ score, cluesArrived, firstCompletion, variant })

    const startedAt = toMillis(s.startedAt)
    const arrivedTimes = arrived.map(d => toMillis(d.data().arrivedAt))
    const lastArrived = arrivedTimes.length ? Math.max(...arrivedTimes) : 0
    const timeMs = startedAt && lastArrived ? lastArrived - startedAt : 0

    // ── Achievements derivable from session data ──
    const earned: string[] = ['explorer']
    // Free tier-1 hints don't count as "using hints".
    const paidHints = hintsSnap.docs.filter(d => String(d.data().tier) !== '1')
    const paidHintClueIds = new Set(paidHints.map(d => d.data().clueId))
    if (totalClues > 0 && cluesArrived >= totalClues && paidHints.length === 0) earned.push('perfect_hunt')
    if (arrived.some(d => !paidHintClueIds.has(d.id))) earned.push('no_hints')
    if (arrived.some(d => {
      const u = toMillis(d.data().unlockedAt), a = toMillis(d.data().arrivedAt)
      return u && a && (a - u) < 180_000
    })) earned.push('speed_demon')
    // Three clean stops (no paid hints) in a row.
    let run = 0, bestRun = 0
    for (const d of [...arrived].sort((a, b) => toMillis(a.data().arrivedAt) - toMillis(b.data().arrivedAt))) {
      run = (d.data().breakdown?.clean ?? 0) > 0 ? run + 1 : 0
      bestRun = Math.max(bestRun, run)
    }
    if (bestRun >= 3) earned.push('streak_3')
    // Perfect stop: puzzle + arrival + quiz + clean stop (on-site isn't on every stop).
    const fullClueThreshold = SCORE.puzzle + SCORE.arrival + SCORE.trivia + SCORE.cleanStop
    if (arrived.some(d => (d.data().pointsEarned ?? 0) >= fullClueThreshold)) earned.push('full_score')
    const triviaRight = scSnap.docs.filter(d => d.data().trivia?.correct === true).length
    if (triviaRight >= 5) earned.push('trivia_ace')

    const prof = (userSnap.exists ? userSnap.data() : {}) as Partial<PlayerProfile>
    const prevXp = prof.xp ?? 0
    const prevLevel = levelFromXp(prevXp).level
    const prevAch = prof.achievements ?? {}
    const now = Date.now()
    const newlyUnlocked = earned.filter(a => !(a in prevAch))
    const achievements: Record<string, number> = { ...prevAch }
    for (const a of newlyUnlocked) achievements[a] = now

    const newXp = prevXp + xpGained
    const lvl = levelFromXp(newXp)
    const leveledUp = lvl.level > prevLevel

    const today = dayUTC(now)
    const yesterday = dayUTC(now - 86_400_000)
    const prevStreak = prof.streak ?? { count: 0, lastDate: '' }
    let streakCount = prevStreak.count || 0
    if (prevStreak.lastDate !== today) {
      streakCount = prevStreak.lastDate === yesterday ? streakCount + 1 : 1
    }

    tx.set(userRef, {
      xp: newXp,
      level: lvl.level,
      huntsCompleted: (prof.huntsCompleted ?? 0) + (firstCompletion ? 1 : 0),
      totalScore: (prof.totalScore ?? 0) + score,
      achievements,
      streak: { count: streakCount, lastDate: today },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    const prevBestScore = recordSnap.exists ? (recordSnap.data()?.bestScore ?? 0) : 0
    const prevBestTime = recordSnap.exists ? (recordSnap.data()?.bestTimeMs ?? 0) : 0
    tx.set(recordRef, {
      huntId: session.huntId,
      bestScore: Math.max(prevBestScore, score),
      bestTimeMs: timeMs && (!prevBestTime || timeMs < prevBestTime) ? timeMs : prevBestTime,
      variants: { [variant]: true },
      lastPlayedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    const result = { xpGained, level: lvl.level, title: lvl.title, leveledUp, newlyUnlocked }
    tx.create(markerRef, { ...result, at: FieldValue.serverTimestamp() })
    return result
  })

  return NextResponse.json(out)
})
