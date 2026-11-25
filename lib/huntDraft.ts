import { HttpError } from '@/lib/httpError'
import { anagramLetters, encode, isScheme, letterBag, plain } from '@/lib/cipher'
import { CREATOR_HUNT_PRICE_EUROS, type Difficulty, type Lang, type TourCategory, type TourType } from '@/types'

/**
 * Creator hunt drafts — pure model, validation and publishing (tested in
 * tests/huntDraft.test.ts). Firestore access lives in lib/drafts.ts.
 *
 * A draft (huntDrafts/{id}, server-only) holds the hunt in the creator's
 * language with its stops inline. On approval it is translated into the
 * other five languages and published into hunts/{id} + hunts/{id}/clues in
 * exactly the shape scripts/seed-lib/build.mjs writes, so the game engine
 * plays it unchanged.
 */

export const ALL_LANGS: Lang[] = ['en', 'nl', 'de', 'fr', 'it', 'es']

export const CREATOR_PUZZLE_TYPES = ['cipher', 'anagram', 'reverse', 'wordplay', 'logic', 'numbers', 'rebus'] as const
export type CreatorPuzzleType = (typeof CREATOR_PUZZLE_TYPES)[number]
/** Puzzles whose answer is a fixed encoded word (same in every language). */
export const CODED_PUZZLES: readonly CreatorPuzzleType[] = ['cipher', 'anagram', 'reverse']
export const TOUR_CATEGORIES: TourCategory[] = ['general', 'nightlife', 'food', 'shopping', 'culture', 'family']

export const LIMITS = {
  title: [3, 80],
  description: [20, 600],
  stopsHunt: [5, 25],
  stopsTour: [3, 25],
  durationMin: [15, 480],
  distanceKm: [0.3, 30],
  radiusM: [40, 200],
  maxCityDistanceM: 15_000,
  short: 80,     // theme, locationName, trivia option
  medium: 300,   // hints, question, puzzle prompt/hint
  long: 800,     // riddle, fun fact, explanations
} as const

export interface DraftTrivia { question: string; options: string[]; correctIndex: number; explain: string }
export interface DraftPuzzle {
  type: CreatorPuzzleType
  /** cipher: atbash | a1z26 | caesar:N. reverse puzzles use 'reverse'. */
  scheme?: string
  prompt: string
  /** Accepted answers; the first is the canonical one (encoded in ciphers). */
  answers: string[]
  hint: string
  explain: string
}

export interface DraftStop {
  id: string
  icon: string
  theme: string
  riddle: string
  locationName: string
  lat: number | null
  lng: number | null
  radiusM: number
  hint1: string
  hint2: string
  funFact: string
  trivia: DraftTrivia | null
  puzzle: DraftPuzzle | null
}

/** The editable part of a draft (what the studio PATCHes). */
export interface DraftContent {
  sourceLang: Lang
  title: string
  description: string
  cityId: string | null
  /** A city we don't list yet; an admin creates it on approval. */
  cityRequest: string | null
  tourType: TourType
  tourCategory: TourCategory
  difficulty: Difficulty
  durationMin: number
  distanceKm: number
  coverImageUrl: string | null
  stops: DraftStop[]
}

/**
 * Translated texts of one stop. A translated puzzle prompt must keep any
 * code (cipher, anagram letters) verbatim — checked by validateTranslations.
 * `answer` is the answer word in that language for word puzzles (wordplay,
 * logic, numbers, rebus); it is added to the accepted answers.
 */
export interface StopTranslation {
  theme: string
  riddle: string
  locationName: string
  hint1: string
  hint2: string
  funFact: string
  trivia?: { question: string; options: string[]; explain: string }
  puzzle?: { prompt: string; hint: string; explain: string; answer?: string }
}
export interface LangTranslation {
  title: string
  description: string
  stops: Record<string, StopTranslation>
}
/** Every language except the draft's sourceLang. */
export type DraftTranslations = Partial<Record<Lang, LangTranslation>>

export const emptyStop = (id: string): DraftStop => ({
  id, icon: '📍', theme: '', riddle: '', locationName: '', lat: null, lng: null, radiusM: 50,
  hint1: '', hint2: '', funFact: '', trivia: null, puzzle: null,
})

export const emptyContent = (sourceLang: Lang = 'en'): DraftContent => ({
  sourceLang, title: '', description: '', cityId: null, cityRequest: null,
  tourType: 'hunt', tourCategory: 'general', difficulty: 'medium',
  durationMin: 90, distanceKm: 3, coverImageUrl: null, stops: [],
})

// ── Sanitising (structure only; completeness is validateDraft's job) ─────

const STOP_ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

function text(v: unknown, max: number): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string') throw new HttpError(400, 'invalid_text')
  const s = v.replace(/\r\n/g, '\n').trim()
  if (s.length > max) throw new HttpError(400, 'text_too_long', { max })
  return s
}
function numIn(v: unknown, min: number, max: number, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new HttpError(400, `invalid_${field}`)
  return v
}
function coord(v: unknown, lim: number, field: string): number | null {
  if (v === null || v === undefined || v === '') return null
  return Math.round(numIn(v, -lim, lim, field) * 1e6) / 1e6
}
function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}
function httpsUrl(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string' || v.length > 1000 || !/^https:\/\/[^\s]+$/.test(v)) throw new HttpError(400, 'invalid_coverImageUrl')
  return v
}

function sanitizeStop(raw: unknown): DraftStop {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'invalid_stop')
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !STOP_ID_RE.test(r.id)) throw new HttpError(400, 'invalid_stop_id')
  const icon = text(r.icon, 16) || '📍'

  let trivia: DraftTrivia | null = null
  if (r.trivia && typeof r.trivia === 'object') {
    const t = r.trivia as Record<string, unknown>
    const options = Array.isArray(t.options) ? t.options.slice(0, 4).map(o => text(o, LIMITS.short)) : []
    while (options.length < 4) options.push('')
    trivia = {
      question: text(t.question, LIMITS.medium),
      options,
      correctIndex: typeof t.correctIndex === 'number' && [0, 1, 2, 3].includes(t.correctIndex) ? t.correctIndex : 0,
      explain: text(t.explain, LIMITS.long),
    }
  }

  let puzzle: DraftPuzzle | null = null
  if (r.puzzle && typeof r.puzzle === 'object') {
    const p = r.puzzle as Record<string, unknown>
    const type = pick(p.type, CREATOR_PUZZLE_TYPES, 'wordplay')
    const answers = Array.isArray(p.answers)
      ? p.answers.slice(0, 10).map(a => text(a, LIMITS.short)).filter(Boolean)
      : []
    puzzle = {
      type,
      ...(type === 'cipher' && isScheme(p.scheme) ? { scheme: p.scheme as string } : {}),
      ...(type === 'reverse' ? { scheme: 'reverse' } : {}),
      prompt: text(p.prompt, LIMITS.medium),
      answers,
      hint: text(p.hint, LIMITS.medium),
      explain: text(p.explain, LIMITS.long),
    }
  }

  return {
    id: r.id,
    icon,
    theme: text(r.theme, LIMITS.short),
    riddle: text(r.riddle, LIMITS.long),
    locationName: text(r.locationName, LIMITS.short),
    lat: coord(r.lat, 90, 'lat'),
    lng: coord(r.lng, 180, 'lng'),
    radiusM: Math.round(numIn(r.radiusM ?? 50, LIMITS.radiusM[0], LIMITS.radiusM[1], 'radiusM')),
    hint1: text(r.hint1, LIMITS.medium),
    hint2: text(r.hint2, LIMITS.medium),
    funFact: text(r.funFact, LIMITS.long),
    trivia,
    puzzle,
  }
}

/** Validate a studio PATCH body into DraftContent (throws HttpError 400). */
export function sanitizeDraftContent(body: Record<string, unknown>): DraftContent {
  const stopsRaw = Array.isArray(body.stops) ? body.stops : []
  if (stopsRaw.length > LIMITS.stopsHunt[1]) throw new HttpError(400, 'too_many_stops')
  const stops = stopsRaw.map(sanitizeStop)
  if (new Set(stops.map(s => s.id)).size !== stops.length) throw new HttpError(400, 'duplicate_stop_id')
  const cityId = body.cityId == null || body.cityId === '' ? null : String(body.cityId)
  if (cityId && !ID_RE.test(cityId)) throw new HttpError(400, 'invalid_cityId')
  return {
    sourceLang: pick(body.sourceLang, ALL_LANGS, 'en'),
    title: text(body.title, LIMITS.title[1]),
    description: text(body.description, LIMITS.description[1]),
    cityId,
    cityRequest: cityId ? null : (text(body.cityRequest, 80) || null),
    tourType: body.tourType === 'tour' ? 'tour' : 'hunt',
    tourCategory: pick(body.tourCategory, TOUR_CATEGORIES, 'general'),
    difficulty: pick(body.difficulty, ['easy', 'medium', 'hard'] as const, 'medium'),
    durationMin: Math.round(numIn(body.durationMin, LIMITS.durationMin[0], LIMITS.durationMin[1], 'durationMin')),
    distanceKm: Math.round(numIn(body.distanceKm, LIMITS.distanceKm[0], LIMITS.distanceKm[1], 'distanceKm') * 10) / 10,
    coverImageUrl: httpsUrl(body.coverImageUrl),
    stops,
  }
}

// ── Validation for submit / publish ──────────────────────────────────────

export interface DraftProblem {
  /** 'hunt' or the stop number (1-based) the problem is on. */
  where: 'hunt' | number
  /** Machine key for the UI (translated there); `detail` is extra context. */
  code: string
  detail?: string
}

const R = 6371000
const rad = (x: number) => (x * Math.PI) / 180
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const filled = (s: string | undefined | null) => typeof s === 'string' && s.trim().length > 0
const squash = (s: string) => plain(s).replace(/ /g, '')

/** Puzzle problems that don't depend on language (also checked per translation). */
export function puzzleProblem(p: DraftPuzzle, prompt: string): string | null {
  const canonical = p.answers[0] ?? ''
  if (p.type === 'cipher' || p.type === 'reverse') {
    const scheme = p.type === 'reverse' ? 'reverse' : p.scheme
    if (!scheme || !isScheme(scheme)) return 'puzzle_scheme_missing'
    if (!squash(canonical)) return 'puzzle_answer_not_letters'
    if (!prompt.replace(/\s+/g, ' ').includes(encode(scheme, canonical))) return 'puzzle_code_not_in_prompt'
  }
  if (p.type === 'anagram') {
    const letters = anagramLetters(prompt)
    if (letterBag(letters) !== letterBag(canonical)) return 'puzzle_anagram_mismatch'
    if (squash(letters) === squash(canonical)) return 'puzzle_anagram_in_order'
  }
  return null
}

export function validateDraft(
  d: DraftContent,
  city: { lat?: number; lng?: number } | null,
): DraftProblem[] {
  const out: DraftProblem[] = []
  const hunt = (code: string, detail?: string) => out.push({ where: 'hunt', code, ...(detail ? { detail } : {}) })
  const isTour = d.tourType === 'tour'

  if (d.title.length < LIMITS.title[0]) hunt('title_missing')
  if (d.description.length < LIMITS.description[0]) hunt('description_too_short')
  if (!d.cityId && !d.cityRequest) hunt('city_missing')
  const [minStops] = isTour ? LIMITS.stopsTour : LIMITS.stopsHunt
  if (d.stops.length < minStops) hunt('too_few_stops', String(minStops))

  d.stops.forEach((s, i) => {
    const n = i + 1
    const stop = (code: string, detail?: string) => out.push({ where: n, code, ...(detail ? { detail } : {}) })
    if (s.lat === null || s.lng === null) stop('location_missing')
    else if (city && typeof city.lat === 'number' && typeof city.lng === 'number'
      && distanceM(s.lat, s.lng, city.lat, city.lng) > LIMITS.maxCityDistanceM) stop('location_far_from_city')
    if (s.lat !== null && s.lng !== null && i > 0) {
      const prev = d.stops[i - 1]
      if (prev.lat !== null && prev.lng !== null && distanceM(s.lat, s.lng, prev.lat, prev.lng) < 20) stop('location_same_as_previous')
    }
    for (const k of ['theme', 'riddle', 'locationName', 'funFact'] as const) if (!filled(s[k])) stop(`${k}_missing`)
    if (!isTour && (!filled(s.hint1) || !filled(s.hint2))) stop('hints_missing')

    if (s.trivia) {
      const t = s.trivia
      if (!filled(t.question) || !filled(t.explain)) stop('trivia_incomplete')
      if (t.options.length !== 4 || t.options.some(o => !filled(o))) stop('trivia_needs_4_options')
      else if (new Set(t.options.map(o => o.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''))).size !== 4) stop('trivia_options_not_distinct')
    }

    if (s.puzzle) {
      const p = s.puzzle
      if (!filled(p.prompt) || !filled(p.hint) || !filled(p.explain)) stop('puzzle_incomplete')
      if (!p.answers.length) stop('puzzle_answer_missing')
      else {
        const problem = puzzleProblem(p, p.prompt)
        if (problem) stop(problem)
      }
    } else if (!isTour) {
      stop('puzzle_missing')
    }
  })
  return out
}

/** Problems in a set of translations (missing texts, a cipher code lost). */
export function validateTranslations(d: DraftContent, tr: DraftTranslations): DraftProblem[] {
  const out: DraftProblem[] = []
  for (const lang of ALL_LANGS) {
    if (lang === d.sourceLang) continue
    const t = tr[lang]
    if (!t || !filled(t.title) || !filled(t.description)) { out.push({ where: 'hunt', code: 'translation_missing', detail: lang }); continue }
    d.stops.forEach((s, i) => {
      const st = t.stops?.[s.id]
      const bad = (code: string) => out.push({ where: i + 1, code, detail: lang })
      if (!st || !filled(st.riddle) || !filled(st.locationName) || !filled(st.funFact) || !filled(st.theme)) return bad('translation_missing')
      if (s.trivia && (!st.trivia || st.trivia.options?.length !== 4 || !filled(st.trivia.question))) bad('translation_trivia')
      if (s.puzzle) {
        if (!st.puzzle || !filled(st.puzzle.prompt) || !filled(st.puzzle.hint) || !filled(st.puzzle.explain)) bad('translation_puzzle')
        else if (puzzleProblem(s.puzzle, st.puzzle.prompt)) bad('translation_puzzle_code')
      }
    })
  }
  return out
}

// ── Publishing ───────────────────────────────────────────────────────────

const normAnswer = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Unique (by normalised form) '|'-joined answers; the first stays first. */
export function joinAnswers(list: string[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const a = String(raw ?? '').trim()
    const k = normAnswer(a)
    if (!a || !k || seen.has(k)) continue
    seen.add(k)
    out.push(a)
  }
  return out.join('|')
}

const stripParen = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim()
const parenContent = (s: string) => [...s.matchAll(/\(([^)]*)\)/g)].map(m => m[1].trim())

export interface PublishContext {
  huntId: string
  ownerUid: string
  creatorName: string
  creatorSlug: string
  cityName: string
  /** Listed in the catalogue (the creator can take payments). */
  active: boolean
  version: number
  order: number
}

export interface PublishedHunt {
  hunt: Record<string, unknown>
  clues: Array<Record<string, unknown> & { id: string }>
}

/** The source texts of a stop, shaped like a translation. */
function sourceStopTexts(s: DraftStop): StopTranslation {
  return {
    theme: s.theme, riddle: s.riddle, locationName: s.locationName,
    hint1: s.hint1, hint2: s.hint2, funFact: s.funFact,
    ...(s.trivia ? { trivia: { question: s.trivia.question, options: s.trivia.options, explain: s.trivia.explain } } : {}),
    ...(s.puzzle ? { puzzle: { prompt: s.puzzle.prompt, hint: s.puzzle.hint, explain: s.puzzle.explain } } : {}),
  }
}

/**
 * Build hunts/{id} and its clue docs from a draft plus its translations,
 * in the seeder's shape: English at the top level, the other five languages
 * under `i18n`. Throws if a language is missing (validate first).
 */
export function buildPublishedHunt(d: DraftContent, tr: DraftTranslations, ctx: PublishContext): PublishedHunt {
  const textsOf = (lang: Lang): { title: string; description: string; stop: (s: DraftStop) => StopTranslation } => {
    if (lang === d.sourceLang) return { title: d.title, description: d.description, stop: sourceStopTexts }
    const t = tr[lang]
    if (!t) throw new Error(`missing translation ${lang}`)
    return {
      title: t.title,
      description: t.description,
      stop: s => {
        const st = t.stops[s.id]
        if (!st) throw new Error(`missing translation ${lang} for stop ${s.id}`)
        return st
      },
    }
  }

  const en = textsOf('en')
  const others = ALL_LANGS.filter(l => l !== 'en')

  const hunt: Record<string, unknown> = {
    title: en.title,
    description: en.description,
    city: ctx.cityName,
    cityId: d.cityId,
    order: ctx.order,
    difficulty: d.difficulty,
    durationMin: d.durationMin,
    distanceKm: d.distanceKm,
    tourType: d.tourType,
    ...(d.tourType === 'tour' ? { tourCategory: d.tourCategory } : {}),
    // Every creator hunt sells at the same platform price.
    priceEuros: CREATOR_HUNT_PRICE_EUROS,
    ownerUid: ctx.ownerUid,
    creatorName: ctx.creatorName,
    creatorSlug: ctx.creatorSlug,
    sourceLang: d.sourceLang,
    ...(d.coverImageUrl ? { coverImageUrl: d.coverImageUrl } : {}),
    i18n: Object.fromEntries(others.map(l => {
      const t = textsOf(l)
      return [l, { title: t.title, description: t.description }]
    })),
    clueCount: d.stops.length,
    active: ctx.active,
    publishedVersion: ctx.version,
  }

  const clues = d.stops.map((s, i) => {
    const base = en.stop(s)
    const all = ALL_LANGS.map(l => [l, textsOf(l).stop(s)] as const)
    const clue: Record<string, unknown> & { id: string } = {
      id: s.id,
      order: i + 1,
      icon: s.icon,
      theme: base.theme,
      riddle: base.riddle,
      locationName: base.locationName,
      lat: s.lat,
      lng: s.lng,
      radiusM: s.radiusM,
      hint1: base.hint1,
      hint2: base.hint2,
      hint2PhotoUrl: null,
      funFact: base.funFact,
    }
    if (s.trivia) {
      clue.trivia = {
        question: base.trivia?.question ?? s.trivia.question,
        options: base.trivia?.options ?? s.trivia.options,
        correctIndex: s.trivia.correctIndex,
        explain: base.trivia?.explain ?? s.trivia.explain,
      }
    }
    if (s.puzzle) {
      // Every language's place name is also accepted, so a Dutch or Spanish
      // player can type the name in their language.
      const names = all.flatMap(([, t]) => [stripParen(t.locationName), ...parenContent(t.locationName)])
      // Word puzzles: the answer in every language counts. Coded puzzles
      // (cipher, anagram, reverse) keep the one encoded word.
      const translatedAnswers = CODED_PUZZLES.includes(s.puzzle.type)
        ? []
        : all.map(([, t]) => t.puzzle?.answer ?? '').filter(Boolean)
      clue.puzzle = {
        type: s.puzzle.type,
        ...(s.puzzle.scheme ? { scheme: s.puzzle.scheme } : {}),
        prompt: base.puzzle?.prompt ?? s.puzzle.prompt,
        answer: joinAnswers([...s.puzzle.answers, ...translatedAnswers, ...names]),
        hint: base.puzzle?.hint ?? s.puzzle.hint,
        explain: base.puzzle?.explain ?? s.puzzle.explain,
      }
    }
    clue.i18n = Object.fromEntries(others.map(l => {
      const t = textsOf(l).stop(s)
      const block: Record<string, unknown> = {
        theme: t.theme, riddle: t.riddle, locationName: t.locationName,
        hint1: t.hint1 ?? '', hint2: t.hint2 ?? '', funFact: t.funFact,
      }
      if (s.trivia && t.trivia) {
        block.trivia = { question: t.trivia.question, options: t.trivia.options, correctIndex: s.trivia.correctIndex, explain: t.trivia.explain }
      }
      if (s.puzzle && t.puzzle) block.puzzle = { prompt: t.puzzle.prompt, hint: t.puzzle.hint, explain: t.puzzle.explain }
      return [l, block]
    }))
    return clue
  })

  return { hunt, clues }
}
