import 'server-only'
import { createHash } from 'crypto'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import {
  type ActiveClueView, type ArrivedStopView, type CompletedClueView, type Clue,
  type Difficulty, type HintsUnlocked, type Lang, type LatLngRadius, type Navigation,
  type StopBreakdown, type Txt, type TriviaResult,
  normalizePuzzleAnswer, emptyBreakdown, breakdownTotal,
  ZONE_RADIUS_M, ZONE_MAX_OFFSET_FRACTION, ONSITE_MAX_ATTEMPTS, MIN_ARRIVAL_RADIUS_M,
} from '@/types'
import type { SessionDoc } from '@/lib/sessionServer'

/**
 * The ONLY place that turns server-side clue documents into what the game
 * client may see (GAME_DESIGN.md "What the client receives"). Never ship a raw
 * clue doc: it holds puzzle answers, the trivia key, on-site answers, hint
 * texts and the exact coordinates.
 */

/** Clue doc as stored (id added by the reader). */
export type ClueDoc = Omit<Clue, 'totalClues'> & { [k: string]: unknown }

/** sessions/{id}/sessionClues/{clueId} */
export interface SessionClueDoc {
  clueId?: string
  unlockedAt?: unknown
  arrivedAt?: unknown
  pointsEarned?: number
  puzzleSolvedAt?: unknown
  pinRevealedAt?: unknown
  breakdown?: Partial<StopBreakdown>
  onSite?: { attempts?: number; correct?: boolean }
  trivia?: { pickedIndex?: number; correct?: boolean }
  [k: string]: unknown
}

const LANGS: Lang[] = ['en', 'nl', 'de', 'fr', 'it', 'es']

/** Build a Txt map from a base string and a per-language picker over clue.i18n. */
export function txt(
  base: string | null | undefined,
  i18n: Record<string, any> | undefined,
  pick: (tr: any) => unknown,
): Txt | null {
  if (typeof base !== 'string' || !base) return null
  const out: Txt = { en: base }
  for (const l of LANGS) {
    if (l === 'en') continue
    const v = i18n?.[l] ? pick(i18n[l]) : undefined
    if (typeof v === 'string' && v) out[l] = v
  }
  return out
}

export function answerHash(huntId: string, clueId: string, normalized: string): string {
  return createHash('sha256').update(`${huntId}:${clueId}:${normalized}`).digest('hex')
}

export function acceptedAnswers(answer: string | undefined | null): string[] {
  if (!answer) return []
  return Array.from(new Set(answer.split('|').map(normalizePuzzleAnswer).filter(Boolean)))
}

export function matchesAnswer(answer: string | undefined | null, submitted: string): boolean {
  const s = normalizePuzzleAnswer(submitted)
  return s.length > 0 && acceptedAnswers(answer).includes(s)
}

/**
 * Deterministic search zone: a ZONE_RADIUS_M circle whose centre is offset
 * from the target by ≤ 60 % of the radius, in a direction seeded by clueId —
 * so it contains the target and never moves on reload.
 */
export function zoneFor(clueId: string, lat: number, lng: number): LatLngRadius {
  const h = createHash('sha256').update(`zone:${clueId}`).digest()
  const angle = (h.readUInt32BE(0) / 0xffffffff) * 2 * Math.PI
  // 25–100 % of the max offset, so the target is never dead centre.
  const frac = 0.25 + 0.75 * (h.readUInt32BE(4) / 0xffffffff)
  const offsetM = ZONE_RADIUS_M * ZONE_MAX_OFFSET_FRACTION * frac
  const dLat = (offsetM * Math.cos(angle)) / 111_320
  const dLng = (offsetM * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180) || 1)
  const round = (v: number) => Math.round(v * 1e6) / 1e6
  return { lat: round(lat + dLat), lng: round(lng + dLng), radiusM: ZONE_RADIUS_M }
}

export function normalizeDifficulty(v: unknown): Difficulty {
  return v === 'easy' || v === 'hard' ? v : 'medium'
}

/**
 * Navigation help per difficulty (GAME_DESIGN.md table):
 *   easy   — compass always; pin after solving
 *   medium — zone + warmth; compass after solving
 *   hard   — zone + warmth; warmth only after solving (target sent for offline arrival)
 * A revealed pin (hint tier 3) unlocks compass + pin on any difficulty.
 */
export function navState(difficulty: Difficulty, solved: boolean, pinRevealed: boolean): {
  navigation: Navigation; sendTarget: boolean; showPin: boolean
} {
  if (pinRevealed) return { navigation: 'compass', sendTarget: true, showPin: true }
  if (difficulty === 'easy') return { navigation: 'compass', sendTarget: true, showPin: solved }
  if (difficulty === 'medium') {
    return solved
      ? { navigation: 'compass', sendTarget: true, showPin: false }
      : { navigation: 'warmth', sendTarget: false, showPin: false }
  }
  return { navigation: 'warmth', sendTarget: solved, showPin: false }
}

export function targetOf(clue: ClueDoc): LatLngRadius {
  return { lat: clue.lat, lng: clue.lng, radiusM: Math.max(Number(clue.radiusM) || 0, MIN_ARRIVAL_RADIUS_M) }
}

/** Unlocked hint tiers for a clue → their content (the server is the source of hint text). */
export function hintsUnlockedFor(clue: ClueDoc, tiers: Iterable<string | number>): HintsUnlocked {
  const out: HintsUnlocked = {}
  for (const t of Array.from(tiers)) {
    const k = String(t)
    if (k === '1') out['1'] = { text: txt(clue.hint1, clue.i18n, tr => tr?.hint1) }
    else if (k === '2') {
      out['2'] = { text: txt(clue.hint2, clue.i18n, tr => tr?.hint2), photoUrl: clue.hint2PhotoUrl ?? null }
    } else if (k === '3') out['3'] = true
    else if (k === 'puzzle') out.puzzle = { text: puzzleTxt(clue, 'hint') }
  }
  return out
}

/** Puzzle text field with translations from puzzle.i18n or clue.i18n[lang].puzzle. */
function puzzleTxt(clue: ClueDoc, field: 'prompt' | 'hint' | 'explain'): Txt | null {
  const base = clue.puzzle?.[field]
  if (typeof base !== 'string' || !base) return null
  const t: Txt = { en: base }
  for (const l of LANGS) {
    if (l === 'en') continue
    const v = (clue.puzzle?.i18n as any)?.[l]?.[field] ?? (clue.i18n as any)?.[l]?.puzzle?.[field]
    if (typeof v === 'string' && v) t[l] = v
  }
  return t
}

export function hasVerifiedOnSite(clue: ClueDoc): boolean {
  return !!clue.onSite && clue.onSite.fieldChecked === true && !!clue.onSite.question && !!clue.onSite.answer
}

export function hasTrivia(clue: ClueDoc): boolean {
  const t = clue.trivia
  return !!t && !!t.question && Array.isArray(t.options) && t.options.length >= 2 &&
    typeof t.correctIndex === 'number'
}

export function toActiveClueView(opts: {
  huntId: string
  clueId: string
  clue: ClueDoc
  sc: SessionClueDoc | null | undefined
  difficulty: Difficulty
  totalClues: number
  unlockedTiers: Iterable<string | number>
}): ActiveClueView {
  const { huntId, clueId, clue, sc, difficulty, totalClues } = opts
  const tiers = Array.from(opts.unlockedTiers).map(String)
  const hasPuzzle = !!clue.puzzle?.prompt && !!clue.puzzle?.answer
  const solved = hasPuzzle && !!sc?.puzzleSolvedAt
  const pinRevealed = !!sc?.pinRevealedAt || tiers.includes('3')
  const nav = navState(difficulty, solved, pinRevealed)
  const showRiddle = !hasPuzzle || solved

  return {
    id: clueId,
    order: clue.order,
    totalClues,
    icon: typeof clue.icon === 'string' ? clue.icon : null,
    difficulty,
    theme: txt(clue.theme, clue.i18n, tr => tr?.theme),
    riddle: showRiddle ? txt(clue.riddle, clue.i18n, tr => tr?.riddle) : null,
    puzzle: hasPuzzle ? {
      type: clue.puzzle!.type,
      prompt: puzzleTxt(clue, 'prompt')!,
      answerHashes: acceptedAnswers(clue.puzzle!.answer).map(a => answerHash(huntId, clueId, a)),
      hasHint: !!clue.puzzle!.hint,
      explain: solved ? puzzleTxt(clue, 'explain') : null,
    } : null,
    puzzleSolved: solved,
    zone: zoneFor(clueId, clue.lat, clue.lng),
    navigation: nav.navigation,
    target: nav.sendTarget ? targetOf(clue) : null,
    showPin: nav.showPin,
    pinRevealed,
    hasOnSite: hasVerifiedOnSite(clue),
    hasTrivia: hasTrivia(clue),
    hintsUnlocked: hintsUnlockedFor(clue, tiers),
  }
}

function triviaView(clue: ClueDoc) {
  const t = clue.trivia!
  return {
    question: txt(t.question, clue.i18n, tr => tr?.trivia?.question)!,
    options: t.options.map((o, i) => txt(o, clue.i18n, tr => tr?.trivia?.options?.[i]) ?? { en: String(o) }),
  }
}

export function triviaExplain(clue: ClueDoc): Txt | null {
  return txt(clue.trivia?.explain, clue.i18n, tr => tr?.trivia?.explain)
}

export function funFactTxt(clue: ClueDoc): Txt | null {
  return txt(clue.funFact, clue.i18n, tr => tr?.funFact)
}

export function onSiteExplain(clue: ClueDoc): Txt | null {
  return txt(clue.onSite?.explain, clue.i18n, tr => tr?.onSite?.explain)
}

export function readBreakdown(sc: SessionClueDoc | null | undefined): StopBreakdown {
  return { ...emptyBreakdown(), ...(sc?.breakdown ?? {}) }
}

export function triviaResultOf(clue: ClueDoc, sc: SessionClueDoc | null | undefined): TriviaResult | null {
  const r = sc?.trivia
  if (!r || typeof r.pickedIndex !== 'number' || !clue.trivia) return null
  return {
    correct: r.correct === true,
    pickedIndex: r.pickedIndex,
    correctIndex: clue.trivia.correctIndex,
    explain: triviaExplain(clue),
  }
}

/** The stop just reached: on-site question (if verified) → quiz → story. */
export function toArrivedStopView(opts: {
  clueId: string
  clue: ClueDoc
  sc: SessionClueDoc | null | undefined
  totalClues: number
}): ArrivedStopView {
  const { clueId, clue, sc, totalClues } = opts
  const quiz = hasTrivia(clue)
  const triviaResult = quiz ? triviaResultOf(clue, sc) : null
  const attempts = Number(sc?.onSite?.attempts ?? 0)
  const onSiteCorrect = sc?.onSite?.correct === true
  return {
    id: clueId,
    order: clue.order,
    totalClues,
    icon: typeof clue.icon === 'string' ? clue.icon : null,
    locationName: txt(clue.locationName, clue.i18n, tr => tr?.locationName) ?? { en: '' },
    lat: clue.lat,
    lng: clue.lng,
    // Fun fact only once the quiz is done (or when there's no quiz).
    funFact: !quiz || triviaResult ? funFactTxt(clue) : null,
    evidence: (clue.evidence as ArrivedStopView['evidence']) ?? null,
    onSite: hasVerifiedOnSite(clue) ? {
      question: txt(clue.onSite!.question, clue.i18n, tr => tr?.onSite?.question)!,
      attemptsLeft: Math.max(0, ONSITE_MAX_ATTEMPTS - attempts),
      done: onSiteCorrect || attempts >= ONSITE_MAX_ATTEMPTS,
      correct: onSiteCorrect,
    } : null,
    trivia: quiz ? triviaView(clue) : null,
    triviaResult,
    breakdown: readBreakdown(sc),
  }
}

export function toCompletedClueView(opts: {
  clueId: string
  clue: ClueDoc
  sc: SessionClueDoc | null | undefined
}): CompletedClueView {
  const { clueId, clue, sc } = opts
  const breakdown = readBreakdown(sc)
  const quiz = hasTrivia(clue)
  return {
    id: clueId,
    order: clue.order,
    icon: typeof clue.icon === 'string' ? clue.icon : null,
    theme: txt(clue.theme, clue.i18n, tr => tr?.theme),
    riddle: txt(clue.riddle, clue.i18n, tr => tr?.riddle),
    locationName: txt(clue.locationName, clue.i18n, tr => tr?.locationName) ?? { en: '' },
    lat: clue.lat,
    lng: clue.lng,
    funFact: funFactTxt(clue),
    trivia: quiz ? { ...triviaView(clue), correctIndex: clue.trivia!.correctIndex, explain: triviaExplain(clue) } : null,
    evidence: (clue.evidence as CompletedClueView['evidence']) ?? null,
    breakdown,
    points: typeof sc?.pointsEarned === 'number' ? sc.pointsEarned : breakdownTotal(breakdown),
  }
}

// ── Loaders ─────────────────────────────────────────────────────────────

/** Difficulty of the session's hunt (cached on the session by start-session). */
export async function sessionDifficulty(db: Firestore, session: SessionDoc): Promise<Difficulty> {
  if (typeof session.difficulty === 'string') return normalizeDifficulty(session.difficulty)
  const h = await db.collection('hunts').doc(session.huntId).get()
  return normalizeDifficulty(h.data()?.difficulty)
}

/** Hint tiers bought for one clue in this session. */
export async function unlockedTiersFor(sessionRef: DocumentReference, clueId: string): Promise<string[]> {
  const snap = await sessionRef.collection('hintUnlocks').where('clueId', '==', clueId).get()
  return snap.docs.map(d => String(d.data().tier))
}

/** Fresh ActiveClueView for a clue, reading its session state. */
export async function loadActiveClueView(opts: {
  db: Firestore
  sessionRef: DocumentReference
  huntId: string
  clueId: string
  difficulty: Difficulty
  totalClues: number
  clue?: ClueDoc
}): Promise<ActiveClueView | null> {
  const { db, sessionRef, huntId, clueId, difficulty, totalClues } = opts
  const [clueSnap, scSnap, tiers] = await Promise.all([
    opts.clue ? Promise.resolve(null) : db.collection('hunts').doc(huntId).collection('clues').doc(clueId).get(),
    sessionRef.collection('sessionClues').doc(clueId).get(),
    unlockedTiersFor(sessionRef, clueId),
  ])
  const clue = opts.clue ?? (clueSnap?.exists ? (clueSnap.data() as ClueDoc) : null)
  if (!clue) return null
  return toActiveClueView({
    huntId, clueId, clue, sc: scSnap.exists ? (scSnap.data() as SessionClueDoc) : null,
    difficulty, totalClues, unlockedTiers: tiers,
  })
}
