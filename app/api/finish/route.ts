import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { SCORE, xpForHunt, levelFromXp, type PlayerProfile, type SessionVariant } from '@/types'

/**
 * POST /api/finish — body: { sessionId }
 *
 * Called once when a hunt is completed. Computes XP, awards achievements,
 * and rolls everything into the player's progression doc (users/{uid}) plus a
 * per-hunt record (users/{uid}/records/{huntId}) and a daily streak. Idempotent
 * via a sessions/{id}/finish/result marker (mirrors /api/accuse), so the
 * complete screen can call it on mount without farming XP on refresh.
 *
 * All progression is computed server-side from session data — the client never
 * writes xp/level/achievements. (The deeper anti-cheat fix — Firestore rules +
 * Admin SDK — is tracked separately.)
 */
function toMillis(v: any): number {
  return typeof v === 'number' ? v : (v?.toMillis?.() ?? 0)
}
function dayUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json().catch(() => ({} as any))
  if (!sessionId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  const sessionRef = doc(db, 'sessions', sessionId)
  const sSnap = await getDoc(sessionRef)
  if (!sSnap.exists()) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  const session = sSnap.data() as any
  const uid: string | undefined = session.userId || undefined
  if (!uid) return NextResponse.json({ skipped: 'anonymous' })
  if (!session.completedAt) return NextResponse.json({ skipped: 'incomplete' })

  // Idempotency — return the locked-in result on re-call.
  const markerRef = doc(db, 'sessions', sessionId, 'finish', 'result')
  const existing = await getDoc(markerRef)
  if (existing.exists()) {
    const d = existing.data() as any
    return NextResponse.json({ xpGained: 0, level: d.level, title: d.title, leveledUp: false, newlyUnlocked: [], alreadyFinished: true })
  }

  // ── Gather session detail ──
  const scSnap = await getDocs(collection(db, 'sessions', sessionId, 'sessionClues'))
  const hintsSnap = await getDocs(collection(db, 'sessions', sessionId, 'hintUnlocks'))
  const hintClueIds = new Set(hintsSnap.docs.map(d => (d.data() as any).clueId))
  const arrived = scSnap.docs.filter(d => (d.data() as any).arrivedAt)
  const cluesArrived = arrived.length

  const huntSnap = await getDoc(doc(db, 'hunts', session.huntId))
  const totalClues = huntSnap.exists() ? ((huntSnap.data() as any).clueCount ?? cluesArrived) : cluesArrived
  const variant: SessionVariant =
    session.variant === 'speedrun' || session.variant === 'nohints' ? session.variant : 'normal'

  const recordRef = doc(db, 'users', uid, 'records', session.huntId)
  const recordSnap = await getDoc(recordRef)
  const firstCompletion = !recordSnap.exists()

  const score: number = session.score ?? 0
  const xpGained = xpForHunt({ score, cluesArrived, firstCompletion, variant })

  // Total time from start to last arrival (for speedrun records).
  const startedAt = toMillis(session.startedAt)
  const arrivedTimes = arrived.map(d => toMillis((d.data() as any).arrivedAt))
  const lastArrived = arrivedTimes.length ? Math.max(...arrivedTimes) : 0
  const timeMs = startedAt && lastArrived ? lastArrived - startedAt : 0

  // ── Achievements derivable from session data ──
  const earned: string[] = ['explorer']
  const usedAnyHint = hintsSnap.size > 0
  if (totalClues > 0 && cluesArrived >= totalClues && !usedAnyHint) earned.push('perfect_hunt')
  if (arrived.some(d => !hintClueIds.has(d.id))) earned.push('no_hints')
  if (arrived.some(d => {
    const u = toMillis((d.data() as any).unlockedAt), a = toMillis((d.data() as any).arrivedAt)
    return u && a && (a - u) < 180_000
  })) earned.push('speed_demon')
  if ((session.streak ?? 0) >= 3) earned.push('streak_3')
  const fullClueThreshold = SCORE.base + SCORE.timeBonus + SCORE.perfectClueBonus
  if (arrived.some(d => ((d.data() as any).pointsEarned ?? 0) >= fullClueThreshold)) earned.push('full_score')

  // ── Update progression doc ──
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  const prof = (userSnap.exists() ? userSnap.data() : {}) as Partial<PlayerProfile>
  const prevXp = prof.xp ?? 0
  const prevLevel = levelFromXp(prevXp).level
  const prevAch = prof.achievements ?? {}
  const now = Date.now()
  const newlyUnlocked = earned.filter(id => !(id in prevAch))
  const achievements: Record<string, number> = { ...prevAch }
  for (const id of newlyUnlocked) achievements[id] = now

  const newXp = prevXp + xpGained
  const lvl = levelFromXp(newXp)
  const leveledUp = lvl.level > prevLevel

  // Daily streak.
  const today = dayUTC(now)
  const yesterday = dayUTC(now - 86_400_000)
  const prevStreak = prof.streak ?? { count: 0, lastDate: '' }
  let streakCount = prevStreak.count || 0
  if (prevStreak.lastDate !== today) {
    streakCount = prevStreak.lastDate === yesterday ? streakCount + 1 : 1
  }

  await setDoc(userRef, {
    xp: newXp,
    level: lvl.level,
    huntsCompleted: (prof.huntsCompleted ?? 0) + (firstCompletion ? 1 : 0),
    totalScore: (prof.totalScore ?? 0) + score,
    achievements,
    streak: { count: streakCount, lastDate: today },
    updatedAt: serverTimestamp(),
  }, { merge: true })

  const prevBestScore = recordSnap.exists() ? ((recordSnap.data() as any).bestScore ?? 0) : 0
  const prevBestTime = recordSnap.exists() ? ((recordSnap.data() as any).bestTimeMs ?? 0) : 0
  await setDoc(recordRef, {
    huntId: session.huntId,
    bestScore: Math.max(prevBestScore, score),
    bestTimeMs: timeMs && (!prevBestTime || timeMs < prevBestTime) ? timeMs : prevBestTime,
    variants: { [variant]: true },
    lastPlayedAt: serverTimestamp(),
  }, { merge: true })

  const result = { xpGained, level: lvl.level, title: lvl.title, leveledUp, newlyUnlocked }
  await setDoc(markerRef, { ...result, at: serverTimestamp() })
  return NextResponse.json(result)
}
