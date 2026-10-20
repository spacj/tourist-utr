import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, oneOf, rateLimit, HttpError } from '@/lib/apiAuth'
import { loadOwnedSession, isAbandoned } from '@/lib/sessionServer'
import {
  type ClueDoc, hintsUnlockedFor, sessionDifficulty, loadActiveClueView, targetOf,
} from '@/lib/clueView'
import { HINT_COSTS, type HintTier } from '@/types'

const TIERS = [1, 2, 3, 'puzzle'] as const

/**
 * POST /api/hints/unlock — Authorization: Bearer <ID token>
 * Body: { sessionId, clueId, tier: 1 | 2 | 3 | 'puzzle' }
 *
 * Charges HINT_COSTS[tier] credits once per (clue, tier). Re-unlocking is free.
 * → { ok, alreadyUnlocked, credits, creditsRemaining, tier,
 *     content: HintContent | null,          // tiers 1, 2, 'puzzle'
 *     target?: { lat, lng, radiusM },        // tier 3: pin revealed
 *     clue: ActiveClueView }                 // refreshed view (navigation, hintsUnlocked…)
 * 402 { error: 'insufficient_credits', credits, required }
 * 409 { error: 'clue_not_active' } — only the current, not-yet-found stop
 *
 * Score penalties (tier 2 / puzzle −10, tier 3 −25) are applied at arrival.
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  rateLimit(`hints:${user.uid}`, 30, 60_000)
  const body = await readJson(req)
  const sessionId = id(body.sessionId, 'sessionId')
  const clueId = id(body.clueId, 'clueId')
  const tier = oneOf(body.tier, 'tier', TIERS) as HintTier
  const cost = HINT_COSTS[tier]

  const db = adminDb()
  const { ref: sessionRef, data: session } = await loadOwnedSession(sessionId, user)
  if (isAbandoned(session)) throw new HttpError(409, 'session_abandoned')
  if (session.tourType === 'tour') throw new HttpError(400, 'no_hints_on_tours')

  const huntRef = db.collection('hunts').doc(session.huntId)
  const clueSnap = await huntRef.collection('clues').doc(clueId).get()
  if (!clueSnap.exists) throw new HttpError(404, 'clue_not_found')
  const clue = clueSnap.data() as ClueDoc
  if (tier === 'puzzle' && !clue.puzzle?.hint) throw new HttpError(400, 'no_puzzle_hint')
  if (tier === 2 && !clue.hint2) throw new HttpError(400, 'no_hint')
  if (tier === 1 && !clue.hint1) throw new HttpError(400, 'no_hint')

  const unlockRef = sessionRef.collection('hintUnlocks').doc(`${clueId}_${tier}`)
  const scRef = sessionRef.collection('sessionClues').doc(clueId)

  type R =
    | { kind: 'ok'; credits: number; alreadyUnlocked: boolean }
    | { kind: 'insufficient'; credits: number }
    | { kind: 'not_active' }
  const r: R = await db.runTransaction(async (tx) => {
    const [unlock, sc, fresh] = await Promise.all([tx.get(unlockRef), tx.get(scRef), tx.get(sessionRef)])
    const credits = Number(fresh.data()?.credits ?? 0)
    if (unlock.exists) return { kind: 'ok', credits, alreadyUnlocked: true } as const
    if (!sc.exists || sc.data()?.arrivedAt) return { kind: 'not_active' } as const
    if (credits < cost) return { kind: 'insufficient', credits } as const
    tx.create(unlockRef, { clueId, tier, creditCost: cost, unlockedAt: FieldValue.serverTimestamp() })
    if (cost > 0) tx.update(sessionRef, { credits: FieldValue.increment(-cost) })
    if (tier === 3) tx.update(scRef, { pinRevealedAt: FieldValue.serverTimestamp() })
    return { kind: 'ok', credits: credits - cost, alreadyUnlocked: false } as const
  })

  if (r.kind === 'not_active') throw new HttpError(409, 'clue_not_active')
  if (r.kind === 'insufficient') {
    return NextResponse.json(
      { error: 'insufficient_credits', credits: r.credits, required: cost },
      { status: 402 },
    )
  }

  const totalClues = (await huntRef.collection('clues').count().get()).data().count
  const view = await loadActiveClueView({
    db, sessionRef, huntId: session.huntId, clueId,
    difficulty: await sessionDifficulty(db, session), totalClues, clue,
  })
  const key = String(tier) as '1' | '2' | 'puzzle'
  const content = tier === 3 ? null : (hintsUnlockedFor(clue, [key])[key] ?? null)

  return NextResponse.json({
    ok: true,
    alreadyUnlocked: r.alreadyUnlocked,
    credits: r.credits,
    creditsRemaining: r.credits,
    tier,
    content,
    ...(tier === 3 ? { target: targetOf(clue) } : {}),
    clue: view,
  })
})
