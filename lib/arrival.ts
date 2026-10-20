import 'server-only'
import type {
  DocumentReference, DocumentSnapshot, Firestore, Transaction,
} from 'firebase-admin/firestore'
import { FieldValue, Timestamp } from '@/lib/firebaseAdmin'
import { haversineM } from '@/lib/geo'
import { type SessionDoc } from '@/lib/sessionServer'
import {
  type ClueDoc, type SessionClueDoc, readBreakdown, toArrivedStopView, loadActiveClueView,
  sessionDifficulty,
} from '@/lib/clueView'
import { SCORE, breakdownTotal, type StopBreakdown, type ArrivalResponse } from '@/types'

/** Fastest plausible travel between two stops (m/s) — ~29 km/h. */
export const MAX_SPEED_MPS = 8
/** Queued (offline) replays may carry an `at` up to this old. */
export const MAX_REPLAY_AGE_MS = 2 * 60 * 60 * 1000

/**
 * Validate a client-supplied arrival time (`at`, ms epoch) for queued
 * offline replays: within the last 2 h and not in the future. Anything
 * else falls back to "now".
 */
export function resolveAt(at: unknown, now = Date.now()): number {
  if (typeof at !== 'number' || !Number.isFinite(at)) return now
  if (at > now + 60_000 || at < now - MAX_REPLAY_AGE_MS) return now
  return Math.min(at, now)
}

/** Total hint penalty (positive number) for the hint tiers bought on a stop. Tier 1 is free. */
export function hintPenaltyFor(hintTiers: Iterable<string | number>): number {
  const tiers = new Set(Array.from(hintTiers, String))
  return (tiers.has('2') ? SCORE.hint2Penalty : 0) +
    (tiers.has('puzzle') ? SCORE.puzzleHintPenalty : 0) +
    (tiers.has('3') ? SCORE.pinRevealPenalty : 0)
}

/**
 * Pure arrival scoring (GAME_DESIGN.md "Scoring"): takes the stop's existing
 * breakdown (puzzle/trivia points already earned) and returns a new one with
 * arrival, clean-stop, hint penalty, race-first and on-site points applied.
 * Walking tours are never scored.
 */
export function arrivalBreakdown(prev: StopBreakdown, o: {
  isTour: boolean
  hintTiers: Iterable<string | number>
  /** This player claimed the stop first in a multiplayer race. */
  raceFirst: boolean
  onSiteCorrect?: boolean
}): StopBreakdown {
  const breakdown = { ...prev }
  if (o.isTour) return breakdown
  const penalty = hintPenaltyFor(o.hintTiers)
  breakdown.arrival = SCORE.arrival
  // Tier-1 (free) hints never cancel the clean-stop bonus.
  breakdown.clean = penalty === 0 ? SCORE.cleanStop : 0
  breakdown.hintPenalty = penalty ? -penalty : 0 // avoid storing -0
  if (o.raceFirst) breakdown.raceFirst = SCORE.raceFirst
  if (o.onSiteCorrect) breakdown.onSite = SCORE.onSite
  return breakdown
}

export function roomIdOf(session: SessionDoc): string | null {
  return typeof session.roomId === 'string' && session.roomId ? session.roomId : null
}

export function roomPlayerRef(db: Firestore, roomId: string, uid: string): DocumentReference {
  return db.collection('rooms').doc(roomId).collection('players').doc(uid)
}

/** Read the room player doc (multiplayer mirror) inside a transaction. */
export async function readRoomPlayer(
  tx: Transaction, db: Firestore, session: SessionDoc, uid: string,
): Promise<DocumentSnapshot | null> {
  const roomId = roomIdOf(session)
  if (!roomId) return null
  return tx.get(roomPlayerRef(db, roomId, uid))
}

/**
 * Add points for one stop event (puzzle, on-site, quiz) inside a transaction
 * whose reads are already done. Updates the stop's breakdown + pointsEarned,
 * the session score and the room scoreboard mirror. Returns the new total.
 */
export function applyStopPoints(tx: Transaction, o: {
  sessionRef: DocumentReference
  sessionData: SessionDoc
  scRef: DocumentReference
  scData: SessionClueDoc
  field: keyof StopBreakdown
  points: number
  player: DocumentSnapshot | null
  extra?: Record<string, unknown>
}): { totalScore: number; breakdown: StopBreakdown } {
  const breakdown = readBreakdown(o.scData)
  breakdown[o.field] = (breakdown[o.field] ?? 0) + o.points
  tx.update(o.scRef, {
    breakdown,
    pointsEarned: breakdownTotal(breakdown),
    ...(o.extra ?? {}),
  })
  if (o.points !== 0) {
    tx.update(o.sessionRef, { score: FieldValue.increment(o.points) })
    if (o.player?.exists) tx.update(o.player.ref, { score: FieldValue.increment(o.points) })
  }
  return { totalScore: (Number(o.sessionData.score) || 0) + o.points, breakdown }
}

export type ArrivalOutcome =
  | { kind: 'already' }
  | { kind: 'not_active' }
  | { kind: 'implausible' }
  | {
      kind: 'arrived'
      breakdown: StopBreakdown
      pointsEarned: number
      totalScore: number
      nextClueId: string | null
      huntComplete: boolean
    }

/**
 * The single arrival transaction (GPS arrival, admin debug arrival and the
 * "I'm here" on-site check-in all go through here): idempotent, teleport-
 * checked, scores the stop, unlocks the next one and mirrors the room
 * scoreboard — all or nothing.
 */
export async function performArrival(o: {
  db: Firestore
  uid: string
  sessionId: string
  sessionRef: DocumentReference
  session: SessionDoc
  clueId: string
  clue: ClueDoc
  /** Arrival time (ms) — `resolveAt(body.at)` for queued offline replays. */
  atMs: number
  /** Check-in path: the on-site answer was correct — record + award it in the same transaction. */
  onSiteCorrect?: boolean
  /** Check-in path: on-site attempts used so far, including this one. */
  onSiteAttempts?: number
  /** Skip the teleport check (admin debug arrival). */
  skipSpeedCheck?: boolean
}): Promise<ArrivalOutcome> {
  const { db, uid, sessionId, sessionRef, session, clueId, clue, atMs } = o
  const huntRef = db.collection('hunts').doc(session.huntId)
  const scRef = sessionRef.collection('sessionClues').doc(clueId)
  const isTour = session.tourType === 'tour'
  const roomId = roomIdOf(session)

  // Next stop — static content, read outside the transaction.
  const allClues = await huntRef.collection('clues').orderBy('order').get()
  const idx = allClues.docs.findIndex(d => d.id === clueId)
  const nextDoc = idx >= 0 ? allClues.docs[idx + 1] : undefined

  return db.runTransaction<ArrivalOutcome>(async (tx) => {
    const [fresh, sc, hintsSnap, claimSnap, player] = await Promise.all([
      tx.get(sessionRef),
      tx.get(scRef),
      tx.get(sessionRef.collection('hintUnlocks').where('clueId', '==', clueId)),
      roomId && !isTour
        ? tx.get(db.collection('rooms').doc(roomId).collection('clueClaims').doc(clueId))
        : Promise.resolve(null),
      readRoomPlayer(tx, db, session, uid),
    ])
    if (!sc.exists) return { kind: 'not_active' }
    const scData = sc.data() as SessionClueDoc
    if (scData.arrivedAt) return { kind: 'already' }
    const s = (fresh.data() ?? {}) as SessionDoc

    if (!isTour && !o.skipSpeedCheck && s.lastArrival && typeof s.lastArrival.atMs === 'number') {
      const legM = haversineM(s.lastArrival.lat, s.lastArrival.lng, clue.lat, clue.lng)
      if ((atMs - s.lastArrival.atMs) / 1000 < legM / MAX_SPEED_MPS) return { kind: 'implausible' }
    }

    const raceFirst = !isTour && !!claimSnap && !claimSnap.exists
    if (raceFirst && claimSnap) {
      tx.create(claimSnap.ref, { userId: uid, sessionId, claimedAt: FieldValue.serverTimestamp() })
    }
    const breakdown = arrivalBreakdown(readBreakdown(scData), {
      isTour,
      hintTiers: hintsSnap.docs.map(d => String(d.data().tier)),
      raceFirst,
      onSiteCorrect: o.onSiteCorrect,
    })
    const before = breakdownTotal(readBreakdown(scData))
    const pointsEarned = breakdownTotal(breakdown)
    const delta = pointsEarned - before
    const totalScore = (Number(s.score) || 0) + delta
    const arrivedAt = Timestamp.fromMillis(atMs)

    tx.update(scRef, {
      arrivedAt,
      breakdown,
      pointsEarned,
      ...(o.onSiteAttempts !== undefined
        ? { onSite: { attempts: o.onSiteAttempts, correct: o.onSiteCorrect === true } }
        : {}),
    })
    tx.update(sessionRef, {
      ...(delta !== 0 ? { score: FieldValue.increment(delta) } : {}),
      lastArrival: { clueId, lat: clue.lat, lng: clue.lng, atMs },
      ...(nextDoc ? {} : { completedAt: arrivedAt }),
    })
    if (nextDoc) {
      tx.set(sessionRef.collection('sessionClues').doc(nextDoc.id), {
        clueId: nextDoc.id,
        unlockedAt: arrivedAt,
        arrivedAt: null,
        pointsEarned: 0,
      })
    }
    if (player?.exists) {
      tx.update(player.ref, {
        ...(delta !== 0 ? { score: FieldValue.increment(delta) } : {}),
        cluesDone: FieldValue.increment(1),
        currentClueId: nextDoc ? nextDoc.id : null,
        ...(nextDoc ? {} : { finishedAt: FieldValue.serverTimestamp() }),
      })
      if (!nextDoc) {
        tx.set(db.collection('userActiveRooms').doc(uid), {
          state: 'finished',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
      }
    }

    return {
      kind: 'arrived',
      breakdown, pointsEarned, totalScore,
      nextClueId: nextDoc?.id ?? null,
      huntComplete: !nextDoc,
    }
  })
}

/** Last racer finished → close out the room (best-effort; the scoreboard is already correct). */
export async function closeRoomIfDone(db: Firestore, roomId: string | null): Promise<void> {
  if (!roomId) return
  try {
    const roomRef = db.collection('rooms').doc(roomId)
    const playersSnap = await roomRef.collection('players').get()
    if (playersSnap.docs.every(d => d.data().finishedAt != null)) {
      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(roomRef)
        if (fresh.exists && fresh.data()?.state === 'racing') {
          tx.update(roomRef, { state: 'finished', finishedAt: FieldValue.serverTimestamp() })
        }
      })
    }
  } catch (e) {
    console.error('[arrival] room close-out failed', e)
  }
}

/**
 * Full arrival payload (ArrivalResponse) for a clue that is now arrived —
 * used right after performArrival and for idempotent repeats.
 */
export async function arrivalPayload(o: {
  db: Firestore
  sessionRef: DocumentReference
  session: SessionDoc
  clueId: string
  clue: ClueDoc
  alreadyConfirmed?: boolean
}): Promise<ArrivalResponse> {
  const { db, sessionRef, session, clueId, clue } = o
  const huntRef = db.collection('hunts').doc(session.huntId)
  const [allClues, scSnap, freshSession, difficulty] = await Promise.all([
    huntRef.collection('clues').orderBy('order').get(),
    sessionRef.collection('sessionClues').doc(clueId).get(),
    sessionRef.get(),
    sessionDifficulty(db, session),
  ])
  const totalClues = allClues.size
  const idx = allClues.docs.findIndex(d => d.id === clueId)
  const nextDoc = idx >= 0 ? allClues.docs[idx + 1] : undefined
  const sc = scSnap.exists ? (scSnap.data() as SessionClueDoc) : null
  const stop = toArrivedStopView({ clueId, clue, sc, totalClues })
  const nextClue = nextDoc
    ? await loadActiveClueView({
        db, sessionRef, huntId: session.huntId, clueId: nextDoc.id, difficulty, totalClues,
        clue: nextDoc.data() as ClueDoc,
      })
    : null
  return {
    arrived: true,
    ...(o.alreadyConfirmed ? { alreadyConfirmed: true } : {}),
    breakdown: stop.breakdown,
    pointsEarned: breakdownTotal(stop.breakdown),
    totalScore: Number(freshSession.data()?.score) || 0,
    huntComplete: !nextDoc,
    stop,
    nextClue,
  }
}
