/**
 * Hint tiers (see docs/GAME_DESIGN.md):
 *   1 — free neighbourhood clue (hint1)
 *   2 — street-level clue (hint2, optional photo)
 *   3 — reveal the pin: exact location + compass, on any difficulty
 *   'puzzle' — nudges the puzzle (puzzle.hint)
 */
export type HintTier = 1 | 2 | 3 | 'puzzle'
export type Difficulty = 'easy' | 'medium' | 'hard'

export const CITY_UNLOCK_PRICE_EUROS = 5

export interface CountryI18n {
  name?: string
  description?: string
  tagline?: string
}

export interface Country {
  id: string             // ISO 3166-1 alpha-2 lowercase: 'nl', 'it', 'es'
  name: string
  flag: string           // emoji flag
  description: string
  tagline?: string
  cityCount: number
  huntCount: number
  order: number
  active: boolean
  comingSoon?: boolean   // shown but not navigable
  imageUrl?: string
  i18n?: Partial<Record<Lang, CountryI18n>>
}

export function localizeCountry(c: Country, lang: Lang): Country {
  const tr = lang !== 'en' ? c.i18n?.[lang] : undefined
  if (!tr) return c
  return {
    ...c,
    name:        tr.name        ?? c.name,
    description: tr.description ?? c.description,
    tagline:     tr.tagline     ?? c.tagline,
  }
}

export interface CityI18n {
  name?: string
  country?: string
  description?: string
}

export interface City {
  id: string
  countryId?: string     // back-pointer to country (defaults to 'nl' for legacy data)
  name: string
  country: string
  description: string
  coverEmoji?: string
  imageUrl?: string
  priceEuros: number
  huntCount: number
  order: number
  active: boolean
  i18n?: Partial<Record<Lang, CityI18n>>
}

export interface HuntI18n {
  title?: string
  description?: string
}

export type TourType = 'hunt' | 'tour'
export type TourCategory = 'general' | 'nightlife' | 'food' | 'shopping' | 'culture' | 'family'

export interface Hunt {
  id: string
  cityId: string
  order: number
  title: string
  description: string
  city: string
  difficulty: Difficulty
  clueCount: number
  durationMin: number
  distanceKm: number
  active: boolean
  i18n?: Partial<Record<Lang, HuntI18n>>
  // Tour vs hunt: tours are self-guided itineraries (food, nightlife, shopping)
  // with no riddles/hints/scoring. Defaults to 'hunt' if absent.
  tourType?: TourType
  tourCategory?: TourCategory
  /** When present, this hunt is a Cluedo-style deduction case: each stop
   *  reveals evidence that eliminates suspects/weapons/places, and the finale
   *  asks the player to accuse. The solution lives in huntSecrets/{huntId}
   *  (server-only, see /api/accuse). */
  mystery?: MysterySpec
}

export function isTour(h: Pick<Hunt, 'tourType'>): boolean {
  return h.tourType === 'tour'
}

/**
 * Free-access rule: exactly one freebie per city — the first *hunt*
 * (order 0). Walking tours are always behind the city paywall, even if
 * they happen to carry order 0 (several do, e.g. the Milan / Rome
 * aperitivo & Trastevere crawls), so we explicitly exclude tours here.
 */
export function isHuntFree(h: Pick<Hunt, 'order' | 'tourType'>): boolean {
  return h.order === 0 && h.tourType !== 'tour'
}

export function localizeCity(c: City, lang: Lang): City {
  const tr = lang !== 'en' ? c.i18n?.[lang] : undefined
  if (!tr) return c
  return {
    ...c,
    name:        tr.name        ?? c.name,
    country:     tr.country     ?? c.country,
    description: tr.description ?? c.description,
  }
}

export interface Trivia {
  question: string
  options: string[]
  correctIndex: number
  explain: string
}

/**
 * A logic / cryptography puzzle attached to a clue. Lives separately from
 * the trivia (which is a quick 4-option quiz). Puzzles are typed open-input
 * — server-side `normalize()` strips case, whitespace, and punctuation
 * before matching.
 *
 * Multiple accepted answers can be supplied with `|` separators:
 *   answer: 'TWENTY|20|twenty'
 */
/**
 * Puzzle kinds:
 *   cipher / anagram / reverse — language-neutral letter manipulations
 *   logic / sequence / wordplay — prose riddles with a textual or numeric answer
 *   observe — "stand here and count/look at X" — answer comes from on-site observation
 */
/**
 * Puzzle kinds (GAME_DESIGN.md): cipher, anagram, wordplay, reverse, logic,
 * numbers, rebus. `sequence` and `observe` are legacy kinds still rendered.
 */
export type PuzzleType =
  | 'cipher' | 'anagram' | 'wordplay' | 'reverse' | 'logic' | 'numbers' | 'rebus'
  | 'sequence' | 'observe'

export interface PuzzleI18n {
  prompt?: string
  answer?: string
  hint?: string
  explain?: string
}

/** Server-side puzzle record (hunts/{id}/clues/{id}.puzzle). Never sent to the client as-is. */
export interface Puzzle {
  type: PuzzleType
  prompt: string
  /** `|`-separated accepted answers (incl. translations); compared after normalizePuzzleAnswer. */
  answer: string
  hint?: string
  explain?: string
  i18n?: Partial<Record<Lang, PuzzleI18n>>
}

/** On-site question: answerable only by standing at the place. */
export interface OnSiteQuestion {
  question: string
  /** `|`-separated accepted answers. */
  answer: string
  explain?: string
  /** Only shown to players when someone verified it on location. */
  fieldChecked: boolean
}

export interface ClueI18n {
  theme?: string
  riddle?: string
  locationName?: string
  hint1?: string
  hint2?: string
  funFact?: string
  trivia?: Partial<Pick<Trivia, 'question' | 'options' | 'explain'>>
  puzzle?: { prompt?: string; hint?: string; explain?: string }
  onSite?: { question?: string; explain?: string }
}

/**
 * Server-side clue document (hunts/{huntId}/clues/{clueId}). Contains answers
 * and coordinates — the game client never receives this shape; it gets an
 * ActiveClueView / CompletedClueView (lib/clueView.ts). Walking tours (no
 * secrets, no scoring) still render a subset of it.
 */
export interface Clue {
  id: string
  order: number
  totalClues: number
  icon?: string
  theme?: string
  riddle: string
  locationName: string
  lat: number
  lng: number
  radiusM: number
  hint1: string
  hint2: string
  hint2PhotoUrl?: string | null
  funFact: string
  trivia?: Trivia
  puzzle?: Puzzle
  onSite?: OnSiteQuestion
  /** Mystery hunts only: evidence revealed on arrival, eliminating candidates. */
  evidence?: ClueEvidence
  i18n?: Partial<Record<Lang, ClueI18n>>
}

// ── Cluedo-style mystery hunts ──────────────────────────────────────
// A mystery hunt is a normal hunt (clues + GPS) with a deduction layer:
// each stop's `evidence` rules out suspects / weapons / places; once every
// stop is found, the player accuses (who + what + where) on the finale.

export type MysteryAxis = 'suspects' | 'weapons' | 'places'

export interface MysteryCandidate {
  id: string
  name: string
  icon: string
  i18n?: Partial<Record<Lang, { name?: string }>>
}

export interface MysteryEliminations {
  suspects?: string[]
  weapons?: string[]
  places?: string[]
}

export interface ClueEvidence {
  /** Narrative evidence shown on arrival ("The scarf was soaked through…"). */
  text: string
  /** Candidate ids this evidence rules out. */
  eliminates?: MysteryEliminations
  i18n?: Partial<Record<Lang, { text?: string }>>
}

export interface MysterySpec {
  victim: string
  /** Case briefing, shown at the start. */
  intro: string
  /** Finale copy. */
  accuseTitle: string
  solvedText: string
  failedText: string
  suspects: MysteryCandidate[]
  weapons: MysteryCandidate[]
  places: MysteryCandidate[]
  /**
   * @deprecated Legacy location of the answer. The solution now lives in
   * huntSecrets/{huntId}.mysterySolution (server-only) and is never sent to
   * the client; /api/accuse falls back to this field for old data.
   */
  solution?: { suspect: string; weapon: string; place: string }
  i18n?: Partial<Record<Lang, {
    victim?: string; intro?: string; accuseTitle?: string; solvedText?: string; failedText?: string
  }>>
}

export function isMystery(h: Pick<Hunt, 'mystery'>): boolean {
  return !!h.mystery
}

export function localizeCandidate(c: MysteryCandidate, lang: Lang): MysteryCandidate {
  const name = (lang !== 'en' && c.i18n?.[lang]?.name) || c.name
  return { ...c, name }
}

export function localizeEvidenceText(e: ClueEvidence | undefined, lang: Lang): string | undefined {
  if (!e) return undefined
  return (lang !== 'en' && e.i18n?.[lang]?.text) || e.text
}

export function localizeMystery(m: MysterySpec, lang: Lang): MysterySpec {
  const tr = lang !== 'en' ? m.i18n?.[lang] : undefined
  return {
    ...m,
    victim:      tr?.victim      ?? m.victim,
    intro:       tr?.intro       ?? m.intro,
    accuseTitle: tr?.accuseTitle ?? m.accuseTitle,
    solvedText:  tr?.solvedText  ?? m.solvedText,
    failedText:  tr?.failedText  ?? m.failedText,
    suspects: m.suspects.map(c => localizeCandidate(c, lang)),
    weapons:  m.weapons.map(c => localizeCandidate(c, lang)),
    places:   m.places.map(c => localizeCandidate(c, lang)),
  }
}

/** Union of everything ruled out by the evidence of the given (arrived) clues. */
export function accumulateEliminations(clues: { evidence?: ClueEvidence }[]): MysteryEliminations {
  const out: Required<MysteryEliminations> = { suspects: [], weapons: [], places: [] }
  for (const c of clues) {
    const e = c.evidence?.eliminates
    if (!e) continue
    for (const axis of ['suspects', 'weapons', 'places'] as MysteryAxis[]) {
      for (const id of e[axis] ?? []) if (!out[axis].includes(id)) out[axis].push(id)
    }
  }
  return out
}

export function localizeHunt(h: Hunt, lang: Lang): Hunt {
  const tr = lang !== 'en' ? h.i18n?.[lang] : undefined
  if (!tr) return h
  return {
    ...h,
    title:       tr.title       ?? h.title,
    description: tr.description ?? h.description,
  }
}

/** Localize a tour stop (walking tours only — games use the server views). */
export function localizeClue(c: Clue, lang: Lang): Clue {
  const tr = lang !== 'en' ? c.i18n?.[lang] : undefined
  if (!tr) return c
  return {
    ...c,
    theme:        tr.theme        ?? c.theme,
    riddle:       tr.riddle       ?? c.riddle,
    locationName: tr.locationName ?? c.locationName,
    hint1:        tr.hint1        ?? c.hint1,
    hint2:        tr.hint2        ?? c.hint2,
    funFact:      tr.funFact      ?? c.funFact,
  }
}

/** Server-side answer normalization — used by /api/verify-puzzle and the seed. */
export function normalizePuzzleAnswer(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')                        // strip whitespace + punctuation
}

// ════════════════════════════════════════════════════════════════
// Game views — what the hunt client receives (GAME_DESIGN.md "What the
// client receives"). Built server-side by lib/clueView.ts. Text fields are
// `Txt` maps: { en, nl?, de?, … } — pick one with pickTxt(txt, lang).
// ════════════════════════════════════════════════════════════════

export type Txt = Partial<Record<Lang, string>> & { en: string }

export function pickTxt(txt: Txt | null | undefined, lang: Lang): string {
  if (!txt) return ''
  return txt[lang] || txt.en || ''
}

export type Navigation = 'compass' | 'warmth'
export type Warmth = 'cold' | 'warm' | 'hot' | 'burning'

export interface LatLngRadius { lat: number; lng: number; radiusM: number }

export interface HintContent {
  text: Txt | null
  photoUrl?: string | null
}

export type HintsUnlocked = Partial<Record<'1' | '2' | 'puzzle', HintContent>> & { '3'?: true }

export interface ActiveClueView {
  id: string
  order: number
  totalClues: number
  icon: string | null
  difficulty: Difficulty
  theme: Txt | null
  /** The story/clue text — only once the puzzle is solved (or when there is no puzzle). */
  riddle: Txt | null
  puzzle: {
    type: PuzzleType
    prompt: Txt
    /** sha256(`${huntId}:${clueId}:${normalizePuzzleAnswer(answer)}`), lowercase hex. */
    answerHashes: string[]
    hasHint: boolean
    /** Only once solved. */
    explain: Txt | null
  } | null
  puzzleSolved: boolean
  /** Search zone: a circle containing the target, centre offset from it. */
  zone: LatLngRadius
  navigation: Navigation
  /** Exact target — sent once the compass is unlocked (and after solving on hard, for offline arrival). */
  target: LatLngRadius | null
  /** Whether the map may show the exact pin. */
  showPin: boolean
  pinRevealed: boolean
  /** Stop has a verified on-site question ("I'm here" check-in available). */
  hasOnSite: boolean
  hasTrivia: boolean
  hintsUnlocked: HintsUnlocked
}

export interface StopBreakdown {
  puzzle: number
  arrival: number
  onSite: number
  trivia: number
  clean: number
  /** Zero or negative. */
  hintPenalty: number
  raceFirst: number
}

export function emptyBreakdown(): StopBreakdown {
  return { puzzle: 0, arrival: 0, onSite: 0, trivia: 0, clean: 0, hintPenalty: 0, raceFirst: 0 }
}

export function breakdownTotal(b: Partial<StopBreakdown> | null | undefined): number {
  if (!b) return 0
  return (b.puzzle ?? 0) + (b.arrival ?? 0) + (b.onSite ?? 0) + (b.trivia ?? 0) +
    (b.clean ?? 0) + (b.hintPenalty ?? 0) + (b.raceFirst ?? 0)
}

export interface TriviaView { question: Txt; options: Txt[] }
export interface TriviaResult {
  correct: boolean
  pickedIndex: number
  correctIndex: number
  explain: Txt | null
}

/** The stop the player just reached — drives the on-site → quiz → story flow. */
export interface ArrivedStopView {
  id: string
  order: number
  totalClues: number
  icon: string | null
  locationName: Txt
  lat: number
  lng: number
  /** Withheld until the quiz is answered (so it can't give the answer away). */
  funFact: Txt | null
  evidence: ClueEvidence | null
  onSite: { question: Txt; attemptsLeft: number; done: boolean; correct: boolean } | null
  trivia: TriviaView | null
  triviaResult: TriviaResult | null
  breakdown: StopBreakdown
  /** True when this was confirmed offline and the server hasn't seen it yet. */
  offline?: boolean
}

export interface CompletedClueView {
  id: string
  order: number
  icon: string | null
  theme: Txt | null
  riddle: Txt | null
  locationName: Txt
  lat: number
  lng: number
  funFact: Txt | null
  trivia: { question: Txt; options: Txt[]; correctIndex: number; explain: Txt | null } | null
  evidence: ClueEvidence | null
  breakdown: StopBreakdown
  points: number
}

/** POST /api/verify-location (and /api/onsite check-in) when arrived. */
export interface ArrivalResponse {
  arrived: true
  alreadyConfirmed?: boolean
  breakdown: StopBreakdown
  pointsEarned: number
  totalScore: number
  huntComplete: boolean
  stop: ArrivedStopView
  nextClue: ActiveClueView | null
}

export interface NotArrivedResponse {
  arrived: false
  warmth: Warmth
  distanceM?: number
  bearing?: number
  totalScore?: number
}

export type VerifyResponse = ArrivalResponse | NotArrivedResponse

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
}

export interface LeaderboardEntry {
  rank: number
  displayName: string
  score: number
  completedAt: number
  isYou?: boolean
}

export interface CreditPackage {
  id: string
  credits: number
  priceCents: number
  label: string
  badge?: string
}

// ════════════════════════════════════════════════════════════════
// Spots — community maps of useful street places. Two kinds share one
// data shape, one Firestore collection, and one UI engine, but each has
// its own category tags and its own section:
//   • bench    → good places to sit          (/benches)
//   • fountain → public water fountains       (/fountains)
// Admins drop a pin at their GPS position, tag it, and write a note;
// each spot gets its own SEO page.
// ════════════════════════════════════════════════════════════════

export type SpotKind = 'bench' | 'fountain'

export interface SpotCategory {
  id: string
  /** Human label, shown on chips + the spot card. */
  label: string
  /** Emoji rendered inside the map marker badge. */
  icon: string
  /** Marker + chip accent colour. */
  color: string
  /** Search-friendly phrase woven into page titles. */
  seoPhrase: string
}
/** @deprecated kept for back-compat; use SpotCategory. */
export type BenchCategory = SpotCategory

export const BENCH_CATEGORIES: SpotCategory[] = [
  { id: 'panorama', label: 'Panorama',        icon: '🌄', color: '#0d9488', seoPhrase: 'a bench with a panoramic view' },
  { id: 'sunset',   label: 'Sunset view',     icon: '🌅', color: '#dc2626', seoPhrase: 'a bench to watch the sunset' },
  { id: 'water',    label: 'By the water',    icon: '🌊', color: '#0891b2', seoPhrase: 'a bench by the water' },
  { id: 'kids',     label: 'Good with kids',  icon: '🧒', color: '#f59e0b', seoPhrase: 'a kid-friendly bench' },
  { id: 'dogs',     label: 'Dog-friendly',    icon: '🐕', color: '#a855f7', seoPhrase: 'a dog-friendly bench' },
  { id: 'smoke',    label: 'Good for a smoke', icon: '🚬', color: '#6b7280', seoPhrase: 'a quiet bench for a smoke' },
  { id: 'quiet',    label: 'Quiet & calm',    icon: '🤫', color: '#6366f1', seoPhrase: 'a quiet, calm bench' },
  { id: 'shade',    label: 'Shaded',          icon: '🌳', color: '#16a34a', seoPhrase: 'a shaded bench' },
]

export const FOUNTAIN_CATEGORIES: SpotCategory[] = [
  { id: 'drinking',   label: 'Drinking water', icon: '🚰', color: '#0891b2', seoPhrase: 'a public drinking fountain' },
  { id: 'refill',     label: 'Bottle refill',  icon: '🧴', color: '#0d9488', seoPhrase: 'a bottle-refill fountain' },
  { id: 'decorative', label: 'Decorative',     icon: '⛲', color: '#6366f1', seoPhrase: 'a decorative fountain' },
  { id: 'dogbowl',    label: 'Dog bowl',       icon: '🐕', color: '#a855f7', seoPhrase: 'a fountain with a dog bowl' },
  { id: 'kids',       label: 'Kids & play',    icon: '💦', color: '#f59e0b', seoPhrase: 'a fountain kids can play in' },
]

export interface SpotKindConfig {
  kind: SpotKind
  /** Route base + slug used in URLs: 'benches' | 'fountains'. */
  urlBase: string
  categories: SpotCategory[]
  defaultCategory: string
  /** Marker/section icon + accent. */
  icon: string
  accent: string
  copy: {
    eyebrow: string        // "Benches"
    sectionTitle: string   // "Good places to sit"
    addCta: string         // "Add a bench"
    addTitle: string       // "Add a bench"
    addSub: string
    typeLabel: string      // "Type of spot" / "Type of fountain"
    emptyTitle: string     // "No benches yet"
    emptyBody: string
    nounSingular: string   // "bench"
    nounPlural: string     // "benches"
    listTitle: string      // SEO h1 + index title
  }
}

export const SPOT_KINDS: Record<SpotKind, SpotKindConfig> = {
  bench: {
    kind: 'bench', urlBase: 'benches', categories: BENCH_CATEGORIES, defaultCategory: 'quiet',
    icon: '🪑', accent: '#0d9488',
    copy: {
      eyebrow: 'Benches', sectionTitle: 'Good places to sit',
      addCta: 'Add a bench', addTitle: 'Add a bench',
      addSub: 'Drops a pin at your current location. Stand on the spot for the most accurate position.',
      typeLabel: 'Type of spot', emptyTitle: 'No benches yet',
      emptyBody: "This map is just getting started. Check back soon — or if you're an editor, drop the first pin.",
      nounSingular: 'bench', nounPlural: 'benches', listTitle: 'Best benches to sit',
    },
  },
  fountain: {
    kind: 'fountain', urlBase: 'fountains', categories: FOUNTAIN_CATEGORIES, defaultCategory: 'drinking',
    icon: '⛲', accent: '#0891b2',
    copy: {
      eyebrow: 'Fountains', sectionTitle: 'Public fountains',
      addCta: 'Add a fountain', addTitle: 'Add a fountain',
      addSub: 'Drops a pin at your current location. Stand by the fountain for the most accurate position.',
      typeLabel: 'Type of fountain', emptyTitle: 'No fountains yet',
      emptyBody: "This map is just getting started. Check back soon — or if you're an editor, drop the first pin.",
      nounSingular: 'fountain', nounPlural: 'fountains', listTitle: 'Public drinking fountains',
    },
  },
}

export function spotKindFromUrlBase(urlBase: string): SpotKind {
  return urlBase === 'fountains' ? 'fountain' : 'bench'
}

export function categoriesForKind(kind: SpotKind): SpotCategory[] {
  return SPOT_KINDS[kind].categories
}

/** Spot record — one shape for both kinds. Stored in the `benches` collection. */
export interface Bench {
  id: string
  /** URL slug used at /{urlBase}/{slug}. */
  slug: string
  /** Which section this belongs to. Legacy docs without it default to 'bench'. */
  kind: SpotKind
  title: string
  description: string
  /** One or more category ids (from this spot's kind). First entry drives the
   *  map marker icon. A spot can carry several tags at once. */
  categories: string[]
  lat: number
  lng: number
  /** Reverse-geocoded street line ("Domplein 9"), emitted as schema.org streetAddress. */
  address?: string
  /** Postal code from reverse geocoding. */
  postalCode?: string
  /** Optional free-text place/city for SEO + grouping (e.g. "Utrecht"). */
  city?: string
  /** ms epoch — when the spot was added. */
  createdAt: number
  /** ms epoch — when the spot was last edited (for sitemap freshness). */
  updatedAt?: number
  /** uid of the admin who added it. */
  createdBy?: string
}
/** Alias — both kinds use this shape. */
export type Spot = Bench

/** Resolve a stored doc's kind: explicit `kind`, else a legacy 'fountain'
 *  tag, else 'bench'. Lets old bench-only data migrate transparently. */
export function deriveSpotKind(raw: { kind?: unknown; categories?: unknown; category?: unknown }): SpotKind {
  if (raw.kind === 'fountain' || raw.kind === 'bench') return raw.kind
  const list = Array.isArray(raw.categories) ? raw.categories : (raw.category != null ? [raw.category] : [])
  return list.map(c => String(c)).includes('fountain') ? 'fountain' : 'bench'
}

/** Validate/dedupe a doc's category ids against its kind's category set,
 *  falling back to that kind's default. Handles the legacy single `category`. */
export function spotCategoryIds(raw: { categories?: unknown; category?: unknown }, kind: SpotKind): string[] {
  const cats = categoriesForKind(kind)
  const list = Array.isArray(raw.categories)
    ? raw.categories
    : (raw.category != null ? [raw.category] : [])
  const ids = list.map(c => String(c)).filter(id => cats.some(c => c.id === id))
  return ids.length ? Array.from(new Set(ids)) : [SPOT_KINDS[kind].defaultCategory]
}

/** @deprecated bench-only shim; use spotCategoryIds(raw, kind). */
export function benchCategoryIds(raw: { categories?: unknown; category?: unknown }): string[] {
  return spotCategoryIds(raw, 'bench')
}

/** Build a stable, readable slug from a title plus a short id suffix to
 *  guarantee uniqueness ("sunset-bench-on-the-dom-a1b2c3"). */
export function benchSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
  const suffix = id.slice(0, 6)
  return base ? `${base}-${suffix}` : suffix
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'small',  credits: 5,  priceCents: 99,  label: '5 extra hints' },
  { id: 'medium', credits: 15, priceCents: 249, label: '15 extra hints', badge: 'Popular' },
  { id: 'large',  credits: 40, priceCents: 499, label: '40 extra hints', badge: 'Best value' },
]

// Tier 1 is free; tier 3 reveals the pin. 'puzzle' nudges the puzzle.
export const HINT_COSTS: Record<HintTier, number> = { 1: 0, 2: 2, 3: 4, puzzle: 3 }

/** Scoring table (GAME_DESIGN.md "Scoring"). Server-computed only. */
export const SCORE = {
  puzzle: 100,
  arrival: 50,
  onSite: 50,
  trivia: 25,
  cleanStop: 25,
  hint2Penalty: 10,
  puzzleHintPenalty: 10,
  pinRevealPenalty: 25,
  raceFirst: 20,
} as const

export const STARTING_CREDITS = 12

/** Arrival is automatic within max(radiusM, 40) + min(accuracy, 30) metres. */
export const MIN_ARRIVAL_RADIUS_M = 40
export const MAX_ACCURACY_SLACK_M = 30
export function arrivalRadiusM(radiusM: number, accuracy: number | null | undefined): number {
  return Math.max(radiusM || 0, MIN_ARRIVAL_RADIUS_M) +
    Math.min(Math.max(accuracy ?? 0, 0), MAX_ACCURACY_SLACK_M)
}
/** Search zone radius and the max offset of its centre from the target (60 %). */
export const ZONE_RADIUS_M = 350
export const ZONE_MAX_OFFSET_FRACTION = 0.6
/** "I'm here" check-in: a correct on-site answer within this distance (or with no GPS) confirms arrival. */
export const CHECKIN_MAX_DISTANCE_M = 300
export const ONSITE_MAX_ATTEMPTS = 3

/** Warmth bands: cold >400 m, warm 150–400, hot 50–150, burning <50. */
export const WARMTH_BANDS: { key: Warmth; color: string }[] = [
  { key: 'cold',    color: '#2563eb' },
  { key: 'warm',    color: '#b45309' },
  { key: 'hot',     color: '#c2410c' },
  { key: 'burning', color: '#b91c1c' },
]
export function warmthFor(distanceM: number): Warmth {
  if (distanceM > 400) return 'cold'
  if (distanceM > 150) return 'warm'
  if (distanceM >= 50) return 'hot'
  return 'burning'
}
export function warmthColor(w: Warmth | null | undefined): string {
  return WARMTH_BANDS.find(b => b.key === w)?.color ?? '#C2410C'
}

export const ACHIEVEMENTS_DEF = [
  { id: 'explorer',     title: 'Explorer',        description: 'Complete your first hunt',             icon: '🧭' },
  { id: 'speed_demon',  title: 'Speed Demon',     description: 'Find a location in under 3 minutes',   icon: '⚡' },
  { id: 'no_hints',     title: 'Sharp Mind',      description: 'Complete a clue without any hints',    icon: '🧠' },
  { id: 'perfect_hunt', title: 'Flawless',        description: 'Complete a hunt using zero hints',     icon: '💎' },
  { id: 'streak_3',     title: 'On a Roll',       description: 'Three clean stops in a row',            icon: '🔥' },
  { id: 'full_score',   title: 'Perfectionist',   description: 'Earn max points on a single clue',     icon: '⭐' },
  { id: 'trivia_ace',   title: 'Trivia Ace',      description: 'Answer 5 trivia questions correctly',  icon: '🎓' },
  { id: 'social',       title: 'Ambassador',      description: 'Share your hunt results',              icon: '📣' },
] as const

// ── Player progression (persisted per user in users/{uid}) ──────────
export type AchievementId = typeof ACHIEVEMENTS_DEF[number]['id']
export type SessionVariant = 'normal' | 'speedrun' | 'nohints'

export interface PlayerProfile {
  displayName?: string
  photoURL?: string
  xp: number
  level: number
  huntsCompleted: number
  totalScore: number
  /** achievement id → earned timestamp (ms). */
  achievements: Record<string, number>
  /** Daily-play streak; lastDate is an ISO YYYY-MM-DD (UTC) string. */
  streak: { count: number; lastDate: string }
}

/** Explorer ranks, one per 500 XP, capped at the last title. */
export const LEVEL_TITLES = [
  'Wanderer', 'Rambler', 'Pathfinder', 'Trailblazer',
  'Explorer', 'Navigator', 'Detective', 'Grand Tourist',
]
export const XP_PER_LEVEL = 500

export function levelFromXp(xp: number): { level: number; title: string; intoLevel: number; toNext: number } {
  const idx = Math.min(Math.floor(Math.max(0, xp) / XP_PER_LEVEL), LEVEL_TITLES.length - 1)
  const intoLevel = Math.max(0, xp) - idx * XP_PER_LEVEL
  const atMax = idx >= LEVEL_TITLES.length - 1
  return { level: idx + 1, title: LEVEL_TITLES[idx], intoLevel, toNext: atMax ? 0 : XP_PER_LEVEL - intoLevel }
}

/** XP earned for finishing a hunt session. */
export function xpForHunt(opts: { score: number; cluesArrived: number; firstCompletion: boolean; variant?: SessionVariant }): number {
  let xp = Math.round((opts.score || 0) / 5) + opts.cluesArrived * 10
  if (opts.firstCompletion) xp += 100
  if (opts.variant === 'speedrun' || opts.variant === 'nohints') xp += 50
  return xp
}

// ── i18n ──────────────────────────────────────────────────────────────
import type { Lang } from '@/lib/i18n/types'
export type { Lang }
export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
]

export { T, t } from '@/lib/i18n'
