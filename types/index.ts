/**
 * Hint tiers:
 *   1, 2, 3 — progressive GPS-direction hints (free / cheap / expensive)
 *   'puzzle' — reveals the per-puzzle author hint (decoding instructions, etc.)
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
  badge?: string
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
  rating?: number
  badge?: string
  active: boolean
  i18n?: Partial<Record<Lang, HuntI18n>>
  // Tour vs hunt: tours are self-guided itineraries (food, nightlife, shopping)
  // with no riddles/hints/scoring. Defaults to 'hunt' if absent.
  tourType?: TourType
  tourCategory?: TourCategory
}

export function isTour(h: Pick<Hunt, 'tourType'>): boolean {
  return h.tourType === 'tour'
}

export function isHuntFree(h: Pick<Hunt, 'order'>): boolean {
  return h.order === 0
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
export type PuzzleType = 'cipher' | 'anagram' | 'logic' | 'sequence' | 'wordplay' | 'reverse' | 'observe'

export interface PuzzleI18n {
  prompt?: string
  answer?: string
  hint?: string
  explain?: string
}

export interface Puzzle {
  type: PuzzleType
  prompt: string
  /** Server compares normalize(input) to normalize of each `|`-split alternative. */
  answer: string
  /** Optional progressive hint the user can reveal at no cost. */
  hint?: string
  /** Explanation shown after the player solves (or gives up). */
  explain?: string
  /** Bonus points awarded for the first correct solve. Defaults to SCORE.puzzleBonus. */
  bonus?: number
  i18n?: Partial<Record<Lang, PuzzleI18n>>
}

export interface ClueI18n {
  theme?: string
  riddle?: string
  locationName?: string
  hint1?: string
  hint2?: string
  hint3?: string
  funFact?: string
  trivia?: Trivia
  puzzle?: Puzzle
}

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
  hint3: string
  funFact: string
  trivia?: Trivia
  /** Optional logic / cipher / wordplay puzzle awarded a separate bonus. */
  puzzle?: Puzzle
  i18n?: Partial<Record<Lang, ClueI18n>>
}

export function localizeHunt(h: Hunt, lang: Lang): Hunt {
  const tr = lang !== 'en' ? h.i18n?.[lang] : undefined
  if (!tr) return h
  return {
    ...h,
    title:       tr.title       ?? h.title,
    description: tr.description ?? h.description,
    badge:       tr.badge       ?? h.badge,
  }
}

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
    hint3:        tr.hint3        ?? c.hint3,
    funFact:      tr.funFact      ?? c.funFact,
    trivia:       tr.trivia       ?? c.trivia,
    puzzle: c.puzzle ? {
      ...c.puzzle,
      prompt:  tr.puzzle?.prompt  ?? c.puzzle.prompt,
      hint:    tr.puzzle?.hint    ?? c.puzzle.hint,
      explain: tr.puzzle?.explain ?? c.puzzle.explain,
      // answer kept in source language for matching; server normalize() handles case/diacritics
      answer: c.puzzle.answer,
    } : undefined,
  }
}

/** Server-side answer normalization — used by /api/verify-puzzle and the seed. */
export function normalizePuzzleAnswer(s: string): string {
  return s
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')                        // strip whitespace + punctuation
}

export interface VerifyResponse {
  arrived: boolean
  distanceM?: number
  bearing?: number
  dynamicHint3?: string
  pointsEarned?: number
  timeBonus?: number
  streakBonus?: number
  perfectBonus?: number
  hintPenalty?: number
  raceFirstBonus?: number
  streak?: number
  funFact?: string
  trivia?: Trivia | null
  nextClue?: Clue | null
  huntComplete?: boolean
}

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

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'small',  credits: 5,  priceCents: 99,  label: '5 extra hints' },
  { id: 'medium', credits: 15, priceCents: 249, label: '15 extra hints', badge: 'Popular' },
  { id: 'large',  credits: 40, priceCents: 499, label: '40 extra hints', badge: 'Best value' },
]

// Rebalanced: tier 1 is free (generous first hint), tier 2 & 3 cost more.
// 'puzzle' unlocks the author's instructions for a clue's puzzle.
export const HINT_COSTS: Record<HintTier, number> = { 1: 0, 2: 2, 3: 4, puzzle: 3 }

export const SCORE = {
  base: 100,
  timeBonus: 20,
  timeBonusWindowMs: 10 * 60 * 1000,
  streakBonus: 15,
  perfectClueBonus: 50,
  triviaBonus: 25,
  /** Awarded for solving the logic / cipher puzzle attached to a clue. */
  puzzleBonus: 30,
  hint1Penalty: 0,
  hint2Penalty: 10,
  hint3Penalty: 25,
}

export const STARTING_CREDITS = 12

export const PROXIMITY = {
  cold:    { min: 500, label: 'Cold',           color: '#3b82f6' },
  cool:    { min: 200, label: 'Getting warmer', color: '#eab308' },
  warm:    { min: 50,  label: 'Warm!',          color: '#f97316' },
  hot:     { min: 15,  label: 'Hot!',           color: '#ef4444' },
  burning: { min: 0,   label: 'On fire!',       color: '#dc2626' },
} as const

export function getProximityZone(distanceM: number | null) {
  if (distanceM === null) return null
  if (distanceM >= 500) return PROXIMITY.cold
  if (distanceM >= 200) return PROXIMITY.cool
  if (distanceM >= 50)  return PROXIMITY.warm
  if (distanceM >= 15)  return PROXIMITY.hot
  return PROXIMITY.burning
}

export type ProximityZoneKey = 'cold' | 'cool' | 'warm' | 'hot' | 'burning'
export function getProximityKey(distanceM: number | null): ProximityZoneKey | null {
  if (distanceM === null) return null
  if (distanceM >= 500) return 'cold'
  if (distanceM >= 200) return 'cool'
  if (distanceM >= 50)  return 'warm'
  if (distanceM >= 15)  return 'hot'
  return 'burning'
}

export const ACHIEVEMENTS_DEF = [
  { id: 'explorer',     title: 'Explorer',        description: 'Complete your first hunt',             icon: '🧭' },
  { id: 'speed_demon',  title: 'Speed Demon',     description: 'Find a location in under 3 minutes',   icon: '⚡' },
  { id: 'no_hints',     title: 'Sharp Mind',      description: 'Complete a clue without any hints',    icon: '🧠' },
  { id: 'perfect_hunt', title: 'Flawless',        description: 'Complete a hunt using zero hints',     icon: '💎' },
  { id: 'streak_3',     title: 'On a Roll',       description: 'Get a 3-clue streak',                  icon: '🔥' },
  { id: 'full_score',   title: 'Perfectionist',   description: 'Earn max points on a single clue',     icon: '⭐' },
  { id: 'trivia_ace',   title: 'Trivia Ace',      description: 'Answer 5 trivia questions correctly',  icon: '🎓' },
  { id: 'social',       title: 'Ambassador',      description: 'Share your hunt results',              icon: '📣' },
] as const

// ── i18n ──────────────────────────────────────────────────────────────
export type Lang = 'en' | 'nl' | 'de' | 'fr' | 'it' | 'es'
export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
]

type Dict = Record<string, Record<Lang, string>>
export const T: Dict = {
  title:             { en: 'TourHunts', nl: 'TourHunts', de: 'TourHunts', fr: 'TourHunts', it: 'TourHunts', es: 'TourHunts' },
  subtitle:          { en: 'Walk · Solve · Discover', nl: 'Wandel · Los op · Ontdek', de: 'Gehen · Lösen · Entdecken', fr: 'Marchez · Résolvez · Découvrez', it: 'Cammina · Risolvi · Scopri', es: 'Camina · Resuelve · Descubre' },
  tagline:           { en: 'GPS-guided scavenger hunts around the world.', nl: 'GPS-geleide speurtochten over de hele wereld.', de: 'GPS-geführte Schnitzeljagden rund um die Welt.', fr: 'Chasses au trésor par GPS partout dans le monde.', it: 'Cacce al tesoro guidate da GPS in tutto il mondo.', es: 'Búsquedas del tesoro guiadas por GPS en todo el mundo.' },
  priceTag:          { en: '€5 · lifetime access', nl: '€5 · onbeperkt spelen', de: '€5 · lebenslanger Zugang', fr: '€5 · accès à vie', it: '€5 · accesso a vita', es: '€5 · acceso de por vida' },
  ctaStart:          { en: 'Start the adventure', nl: 'Start het avontuur', de: 'Abenteuer beginnen', fr: 'Commencer l\'aventure', it: 'Inizia l\'avventura', es: 'Comenzar la aventura' },
  ctaResume:         { en: 'Resume', nl: 'Hervatten', de: 'Fortsetzen', fr: 'Reprendre', it: 'Riprendi', es: 'Reanudar' },
  featStops:         { en: 'Handpicked stops in every hunt', nl: 'Zorgvuldig gekozen locaties in elke tocht', de: 'Handverlesene Stopps in jeder Tour', fr: 'Étapes soigneusement choisies', it: 'Tappe selezionate con cura', es: 'Paradas seleccionadas con cuidado' },
  featStories:       { en: 'Stories & fun facts at every stop', nl: 'Verhalen en weetjes bij elke stop', de: 'Geschichten an jedem Stopp', fr: 'Histoires à chaque étape', it: 'Storie e curiosità a ogni tappa', es: 'Historias y curiosidades en cada parada' },
  featTrivia:        { en: 'Trivia for bonus points', nl: 'Trivia voor bonuspunten', de: 'Quiz für Bonuspunkte', fr: 'Quiz pour des points bonus', it: 'Quiz per punti bonus', es: 'Trivia para puntos extra' },
  featOffline:       { en: 'Works offline once started', nl: 'Werkt offline na de start', de: 'Offline spielbar', fr: 'Fonctionne hors ligne', it: 'Funziona offline', es: 'Funciona sin conexión' },
  featGps:           { en: 'GPS-guided, no check-in apps needed', nl: 'GPS-geleid, geen extra apps', de: 'GPS-geführt, keine Extra-App', fr: 'Guidé par GPS', it: 'Guidato da GPS', es: 'Guiado por GPS' },
  featReplay:        { en: 'Replay as often as you like', nl: 'Zo vaak herspelen als je wilt', de: 'Unbegrenzt wiederholen', fr: 'Rejouable à volonté', it: 'Rigiocabile a volontà', es: 'Vuelve a jugar cuando quieras' },
  featMulti:         { en: 'Real-time multiplayer races', nl: 'Real-time multiplayer races', de: 'Echtzeit-Multiplayer-Rennen', fr: 'Courses multijoueur en temps réel', it: 'Gare multiplayer in tempo reale', es: 'Carreras multijugador en tiempo real' },
  availableHunts:    { en: 'Available hunts', nl: 'Beschikbare tochten', de: 'Verfügbare Touren', fr: 'Parcours disponibles', it: 'Cacce disponibili', es: 'Búsquedas disponibles' },
  whatsIncluded:     { en: 'What\'s included', nl: 'Wat is inbegrepen', de: 'Im Preis enthalten', fr: 'Ce qui est inclus', it: 'Cosa è incluso', es: 'Qué incluye' },
  signInHint:        { en: 'Sign in with Google to save your progress', nl: 'Log in met Google om je voortgang op te slaan', de: 'Mit Google anmelden, um Fortschritt zu speichern', fr: 'Connectez-vous avec Google pour sauvegarder', it: 'Accedi con Google per salvare i progressi', es: 'Inicia sesión con Google para guardar tu progreso' },
  signIn:            { en: 'Sign in', nl: 'Inloggen', de: 'Anmelden', fr: 'Se connecter', it: 'Accedi', es: 'Iniciar sesión' },
  places:            { en: 'stops', nl: 'stops', de: 'Stopps', fr: 'étapes', it: 'tappe', es: 'paradas' },
  min:               { en: 'min', nl: 'min', de: 'Min', fr: 'min', it: 'min', es: 'min' },
  km:                { en: 'km', nl: 'km', de: 'km', fr: 'km', it: 'km', es: 'km' },
  yourClue:          { en: 'Your clue', nl: 'Jouw raadsel', de: 'Dein Rätsel', fr: 'Votre énigme', it: 'Il tuo indizio', es: 'Tu pista' },
  hints:             { en: 'Hints', nl: 'Hints', de: 'Hinweise', fr: 'Indices', it: 'Suggerimenti', es: 'Pistas' },
  readAloud:         { en: 'Read aloud', nl: 'Lees voor', de: 'Vorlesen', fr: 'Lire à voix haute', it: 'Leggi ad alta voce', es: 'Leer en voz alta' },
  stop:              { en: 'Stop', nl: 'Stop', de: 'Stopp', fr: 'Arrêt', it: 'Tappa', es: 'Parada' },
  of:                { en: 'of', nl: 'van', de: 'von', fr: 'sur', it: 'di', es: 'de' },
  skipTest:          { en: 'Skip to location (test)', nl: 'Ga naar locatie (test)', de: 'Zu Ort springen (test)', fr: 'Aller à la position (test)', it: 'Salta alla posizione (test)', es: 'Ir a la ubicación (prueba)' },
  youMadeIt:         { en: 'You made it!', nl: 'Je bent er!', de: 'Geschafft!', fr: 'Vous y êtes !', it: 'Ce l\'hai fatta!', es: '¡Lo lograste!' },
  didYouKnow:        { en: 'Did you know?', nl: 'Wist je dat?', de: 'Wusstest du?', fr: 'Le saviez-vous ?', it: 'Lo sapevi?', es: '¿Sabías que?' },
  quickQuiz:         { en: 'Quick quiz — +25 bonus', nl: 'Snelle quiz — +25 bonus', de: 'Kurzes Quiz — +25 Bonus', fr: 'Quiz rapide — +25 bonus', it: 'Quiz rapido — +25 bonus', es: 'Trivia rápida — +25 bonus' },
  correct:           { en: 'Correct! +25 points', nl: 'Goed! +25 punten', de: 'Richtig! +25 Punkte', fr: 'Correct ! +25 points', it: 'Esatto! +25 punti', es: '¡Correcto! +25 puntos' },
  puzzleTitle:       { en: 'Brain teaser — +30 bonus', nl: 'Hersenkraker — +30 bonus', de: 'Knobelei — +30 Bonus', fr: 'Casse-tête — +30 bonus', it: 'Rompicapo — +30 bonus', es: 'Acertijo — +30 bonus' },
  puzzleSubmit:      { en: 'Submit', nl: 'Verstuur', de: 'Senden', fr: 'Envoyer', it: 'Invia', es: 'Enviar' },
  puzzlePlaceholder: { en: 'Your answer…', nl: 'Jouw antwoord…', de: 'Deine Antwort…', fr: 'Votre réponse…', it: 'La tua risposta…', es: 'Tu respuesta…' },
  puzzleShowHint:    { en: 'Show hint', nl: 'Toon hint', de: 'Hinweis zeigen', fr: 'Voir l\'indice', it: 'Mostra suggerimento', es: 'Ver pista' },
  puzzleCorrect:     { en: 'Solved! +30 points', nl: 'Opgelost! +30 punten', de: 'Gelöst! +30 Punkte', fr: 'Résolu ! +30 points', it: 'Risolto! +30 punti', es: '¡Resuelto! +30 puntos' },
  puzzleTryAgain:    { en: 'Not quite — try again', nl: 'Niet helemaal — probeer opnieuw', de: 'Nicht ganz — versuch\'s nochmal', fr: 'Presque — réessayez', it: 'Quasi — riprova', es: 'Casi — inténtalo de nuevo' },
  historyTitle:      { en: 'Past stops', nl: 'Vorige stops', de: 'Frühere Stationen', fr: 'Étapes passées', it: 'Tappe precedenti', es: 'Paradas anteriores' },
  historySub:        { en: 'Re-read the stories and facts you\'ve unlocked.', nl: 'Lees de verhalen en feiten die je hebt vrijgespeeld terug.', de: 'Lies die Geschichten und Fakten, die du freigeschaltet hast, erneut.', fr: 'Relisez les histoires et anecdotes que vous avez débloquées.', it: 'Rileggi le storie e i fatti che hai sbloccato.', es: 'Vuelve a leer las historias y datos que has desbloqueado.' },
  historyEmpty:      { en: 'No past stops yet — solve your first clue to start your trail.', nl: 'Nog geen vorige stops — los je eerste raadsel op om je spoor te starten.', de: 'Noch keine früheren Stationen — löse deine erste Aufgabe, um deinen Pfad zu beginnen.', fr: 'Aucune étape pour l\'instant — résolvez votre première énigme pour commencer le parcours.', it: 'Nessuna tappa precedente — risolvi il primo enigma per iniziare il percorso.', es: 'Aún no hay paradas — resuelve tu primera pista para empezar tu ruta.' },
  history:           { en: 'History', nl: 'Geschiedenis', de: 'Verlauf', fr: 'Historique', it: 'Cronologia', es: 'Historial' },
  // Puzzle type labels — surfaced on the puzzle card header
  puzzleTypeCipher:  { en: 'Cipher',   nl: 'Geheimschrift', de: 'Geheimcode', fr: 'Chiffre',   it: 'Cifrato',     es: 'Cifrado' },
  puzzleTypeAnagram: { en: 'Anagram',  nl: 'Anagram',       de: 'Anagramm',   fr: 'Anagramme', it: 'Anagramma',   es: 'Anagrama' },
  puzzleTypeLogic:   { en: 'Logic',    nl: 'Logica',        de: 'Logik',      fr: 'Logique',   it: 'Logica',      es: 'Lógica' },
  puzzleTypeSequence:{ en: 'Sequence', nl: 'Reeks',         de: 'Reihe',      fr: 'Suite',     it: 'Sequenza',    es: 'Secuencia' },
  puzzleTypeWordplay:{ en: 'Wordplay', nl: 'Woordspel',     de: 'Wortspiel',  fr: 'Jeu de mots', it: 'Gioco di parole', es: 'Juego de palabras' },
  puzzleTypeReverse: { en: 'Reverse',  nl: 'Omgekeerd',     de: 'Umgekehrt',  fr: 'À l\'envers', it: 'Al contrario', es: 'Al revés' },
  puzzleTypeObserve: { en: 'Spot it',  nl: 'Spot het',      de: 'Finde es',   fr: 'Repère-le', it: 'Trovalo',     es: 'Encuéntralo' },
  // Offline puzzle status messages
  puzzleOfflineSolved: { en: 'Solved offline — score will sync when you reconnect.', nl: 'Offline opgelost — je score wordt gesynchroniseerd zodra je weer online bent.', de: 'Offline gelöst — dein Punktestand wird beim nächsten Verbinden synchronisiert.', fr: 'Résolu hors ligne — votre score sera synchronisé à la reconnexion.', it: 'Risolto offline — il punteggio si sincronizzerà alla riconnessione.', es: 'Resuelto sin conexión — la puntuación se sincronizará al reconectar.' },
  notQuite:          { en: 'Not quite', nl: 'Niet helemaal', de: 'Nicht ganz', fr: 'Presque', it: 'Quasi', es: 'Casi' },
  continue:          { en: 'Continue', nl: 'Doorgaan', de: 'Weiter', fr: 'Continuer', it: 'Continua', es: 'Continuar' },
  nextClue:          { en: 'Next clue →', nl: 'Volgend raadsel →', de: 'Nächstes Rätsel →', fr: 'Prochaine énigme →', it: 'Prossimo indizio →', es: 'Siguiente pista →' },
  seeFinal:          { en: 'See final score', nl: 'Bekijk eindscore', de: 'Endstand ansehen', fr: 'Voir le score final', it: 'Vedi punteggio finale', es: 'Ver puntuación final' },
  share:             { en: 'Share', nl: 'Delen', de: 'Teilen', fr: 'Partager', it: 'Condividi', es: 'Compartir' },
  baseScore:         { en: 'Base score', nl: 'Basisscore', de: 'Grundpunkte', fr: 'Score de base', it: 'Punteggio base', es: 'Puntuación base' },
  speedBonus:        { en: 'Speed bonus', nl: 'Snelheidsbonus', de: 'Geschwindigkeitsbonus', fr: 'Bonus vitesse', it: 'Bonus velocità', es: 'Bono de velocidad' },
  hintsUsed:         { en: 'Hints used', nl: 'Hints gebruikt', de: 'Hinweise genutzt', fr: 'Indices utilisés', it: 'Suggerimenti usati', es: 'Pistas usadas' },
  pointsEarned:      { en: 'Points earned', nl: 'Punten verdiend', de: 'Punkte erhalten', fr: 'Points gagnés', it: 'Punti guadagnati', es: 'Puntos ganados' },
  huntComplete:      { en: 'Hunt complete!', nl: 'Tocht voltooid!', de: 'Tour abgeschlossen!', fr: 'Tour terminé !', it: 'Caccia completata!', es: '¡Búsqueda completada!' },
  finalScore:        { en: 'Final score', nl: 'Eindscore', de: 'Endstand', fr: 'Score final', it: 'Punteggio finale', es: 'Puntuación final' },
  points:            { en: 'points', nl: 'punten', de: 'Punkte', fr: 'points', it: 'punti', es: 'puntos' },
  locations:         { en: 'Locations', nl: 'Locaties', de: 'Orte', fr: 'Lieux', it: 'Luoghi', es: 'Lugares' },
  creditsSpent:      { en: 'Credits spent', nl: 'Credits besteed', de: 'Credits ausgegeben', fr: 'Crédits dépensés', it: 'Crediti spesi', es: 'Créditos gastados' },
  playAgain:         { en: 'Play again', nl: 'Opnieuw spelen', de: 'Erneut spielen', fr: 'Rejouer', it: 'Gioca ancora', es: 'Jugar de nuevo' },
  viewProfile:       { en: 'View profile', nl: 'Bekijk profiel', de: 'Profil ansehen', fr: 'Voir le profil', it: 'Vedi profilo', es: 'Ver perfil' },
  neighbourhoodClue: { en: 'Neighbourhood clue', nl: 'Buurt-hint', de: 'Gegend-Hinweis', fr: 'Indice de quartier', it: 'Indizio di zona', es: 'Pista de barrio' },
  streetHint:        { en: 'Street-level hint', nl: 'Straathint', de: 'Straßen-Hinweis', fr: 'Indice de rue', it: 'Indizio stradale', es: 'Pista de calle' },
  showMap:           { en: 'Show on map', nl: 'Toon op kaart', de: 'Auf Karte zeigen', fr: 'Voir sur la carte', it: 'Mostra sulla mappa', es: 'Ver en el mapa' },
  unlocked:          { en: 'Unlocked', nl: 'Open', de: 'Entsperrt', fr: 'Débloqué', it: 'Sbloccato', es: 'Desbloqueado' },
  free:              { en: 'Free', nl: 'Gratis', de: 'Gratis', fr: 'Gratuit', it: 'Gratis', es: 'Gratis' },
  getReady:          { en: 'Get ready', nl: 'Maak je klaar', de: 'Bereit machen', fr: 'Préparez-vous', it: 'Preparati', es: 'Prepárate' },
  credits:           { en: 'credits', nl: 'credits', de: 'Credits', fr: 'crédits', it: 'crediti', es: 'créditos' },
  metres:            { en: 'metres', nl: 'meters', de: 'Meter', fr: 'mètres', it: 'metri', es: 'metros' },
  locating:          { en: 'locating', nl: 'zoeken', de: 'suchen', fr: 'recherche', it: 'localizzazione', es: 'localizando' },
  arrived:           { en: 'arrived!', nl: 'aangekomen!', de: 'angekommen!', fr: 'arrivé !', it: 'arrivato!', es: '¡llegaste!' },
  home:              { en: 'Home', nl: 'Home', de: 'Start', fr: 'Accueil', it: 'Home', es: 'Inicio' },
  expand:            { en: 'Expand', nl: 'Uitklappen', de: 'Erweitern', fr: 'Agrandir', it: 'Espandi', es: 'Expandir' },
  collapse:          { en: 'Collapse', nl: 'Inklappen', de: 'Einklappen', fr: 'Réduire', it: 'Comprimi', es: 'Contraer' },
  moreHints:         { en: 'Hints & details', nl: 'Hints & details', de: 'Hinweise & Details', fr: 'Indices & détails', it: 'Suggerimenti e dettagli', es: 'Pistas y detalles' },
  leaveHuntConfirm:  { en: 'Leave the hunt? Your progress is saved.', nl: 'Stoppen? Voortgang blijft bewaard.', de: 'Tour verlassen? Dein Fortschritt bleibt erhalten.', fr: 'Quitter ? Votre progression est enregistrée.', it: 'Uscire dalla caccia? I progressi sono salvati.', es: '¿Salir de la búsqueda? Tu progreso está guardado.' },

  // Difficulty
  diffEasy:          { en: 'Easy', nl: 'Makkelijk', de: 'Leicht', fr: 'Facile', it: 'Facile', es: 'Fácil' },
  diffMedium:        { en: 'Medium', nl: 'Gemiddeld', de: 'Mittel', fr: 'Moyen', it: 'Medio', es: 'Medio' },
  diffHard:          { en: 'Hard', nl: 'Moeilijk', de: 'Schwer', fr: 'Difficile', it: 'Difficile', es: 'Difícil' },

  // Empty / status
  noHuntsYet:        { en: 'No hunts available yet.', nl: 'Nog geen tochten beschikbaar.', de: 'Noch keine Touren verfügbar.', fr: 'Aucun parcours pour l\'instant.', it: 'Nessuna caccia disponibile.', es: 'Aún no hay búsquedas disponibles.' },
  ctaCompleted:      { en: 'Completed', nl: 'Voltooid', de: 'Abgeschlossen', fr: 'Terminé', it: 'Completata', es: 'Completada' },
  inProgress:        { en: 'In progress', nl: 'Bezig', de: 'Läuft', fr: 'En cours', it: 'In corso', es: 'En curso' },
  bestScore:         { en: 'Best', nl: 'Beste', de: 'Bestleistung', fr: 'Meilleur', it: 'Migliore', es: 'Mejor' },

  // Score breakdown
  noHintBonus:       { en: 'No-hint bonus', nl: 'Geen-hint-bonus', de: 'Kein-Hinweis-Bonus', fr: 'Bonus sans indice', it: 'Bonus senza suggerimenti', es: 'Bono sin pistas' },
  streakBonusLabel:  { en: 'Streak bonus', nl: 'Reeks-bonus', de: 'Serien-Bonus', fr: 'Bonus série', it: 'Bonus serie', es: 'Bono de racha' },

  // Profile page
  profileTitle:      { en: 'Your profile', nl: 'Jouw profiel', de: 'Dein Profil', fr: 'Votre profil', it: 'Il tuo profilo', es: 'Tu perfil' },
  profileSignInHint: { en: 'Sign in to track your progress across hunts.', nl: 'Log in om je voortgang bij te houden.', de: 'Melde dich an, um deinen Fortschritt zu verfolgen.', fr: 'Connectez-vous pour suivre votre progression.', it: 'Accedi per tracciare i tuoi progressi.', es: 'Inicia sesión para seguir tu progreso.' },
  signInGoogle:      { en: 'Sign in with Google', nl: 'Inloggen met Google', de: 'Mit Google anmelden', fr: 'Se connecter avec Google', it: 'Accedi con Google', es: 'Iniciar sesión con Google' },
  backToHunts:       { en: '← Back to hunts', nl: '← Terug naar tochten', de: '← Zurück zu Touren', fr: '← Retour aux parcours', it: '← Torna alle cacce', es: '← Volver a búsquedas' },
  huntsDone:         { en: 'Hunts done', nl: 'Tochten gedaan', de: 'Touren erledigt', fr: 'Parcours faits', it: 'Cacce fatte', es: 'Búsquedas hechas' },
  placesFound:       { en: 'Places found', nl: 'Plekken gevonden', de: 'Orte gefunden', fr: 'Lieux trouvés', it: 'Luoghi trovati', es: 'Lugares encontrados' },
  totalScore:        { en: 'Total score', nl: 'Totaalscore', de: 'Gesamtpunkte', fr: 'Score total', it: 'Punteggio totale', es: 'Puntuación total' },
  huntHistory:       { en: 'Hunt history', nl: 'Geschiedenis', de: 'Verlauf', fr: 'Historique', it: 'Cronologia', es: 'Historial' },
  noHuntsPlayed:     { en: 'No hunts played yet. Go explore!', nl: 'Nog niets gespeeld. Ga op pad!', de: 'Noch nichts gespielt. Geh los!', fr: 'Aucun parcours. À l\'aventure !', it: 'Nessuna caccia giocata. Esplora!', es: 'Aún sin búsquedas. ¡A explorar!' },
  playHunt:          { en: 'Play a hunt', nl: 'Speel een tocht', de: 'Tour starten', fr: 'Jouer un parcours', it: 'Gioca una caccia', es: 'Jugar una búsqueda' },
  signOut:           { en: 'Sign out', nl: 'Uitloggen', de: 'Abmelden', fr: 'Se déconnecter', it: 'Esci', es: 'Cerrar sesión' },

  // Achievements (complete page)
  achExplorer:       { en: 'Explorer', nl: 'Ontdekker', de: 'Entdecker', fr: 'Explorateur', it: 'Esploratore', es: 'Explorador' },
  achFlawless:       { en: 'Flawless', nl: 'Vlekkeloos', de: 'Makellos', fr: 'Sans faute', it: 'Impeccabile', es: 'Impecable' },
  achFinisher:       { en: 'Finisher', nl: 'Voltooid', de: 'Vollender', fr: 'Finisseur', it: 'Finitore', es: 'Finalizador' },
  ach1000:           { en: '1000+', nl: '1000+', de: '1000+', fr: '1000+', it: '1000+', es: '1000+' },

  // Cities + unlock
  chooseCity:        { en: 'Choose a city', nl: 'Kies een stad', de: 'Stadt wählen', fr: 'Choisissez une ville', it: 'Scegli una città', es: 'Elige una ciudad' },
  chooseCountry:     { en: 'Choose a country', nl: 'Kies een land', de: 'Land wählen', fr: 'Choisissez un pays', it: 'Scegli un paese', es: 'Elige un país' },
  countries:         { en: 'Countries', nl: 'Landen', de: 'Länder', fr: 'Pays', it: 'Paesi', es: 'Países' },
  citiesIn:          { en: 'Cities in {country}', nl: 'Steden in {country}', de: 'Städte in {country}', fr: 'Villes en {country}', it: 'Città in {country}', es: 'Ciudades en {country}' },
  comingSoon:        { en: 'Coming soon', nl: 'Binnenkort', de: 'Demnächst', fr: 'Bientôt', it: 'Prossimamente', es: 'Próximamente' },
  backToCountries:   { en: '← Back to countries', nl: '← Terug naar landen', de: '← Zurück zu Ländern', fr: '← Retour aux pays', it: '← Torna ai paesi', es: '← Volver a países' },
  cityWord:          { en: 'cities', nl: 'steden', de: 'Städte', fr: 'villes', it: 'città', es: 'ciudades' },
  noCitiesYet:       { en: 'No cities here yet — check back soon.', nl: 'Nog geen steden hier — kom snel terug.', de: 'Noch keine Städte hier — schau bald wieder vorbei.', fr: 'Pas encore de villes ici — revenez bientôt.', it: 'Ancora nessuna città — torna presto.', es: 'Aún sin ciudades — vuelve pronto.' },
  cities:            { en: 'Cities', nl: 'Steden', de: 'Städte', fr: 'Villes', it: 'Città', es: 'Ciudades' },
  hunts:             { en: 'hunts', nl: 'tochten', de: 'Touren', fr: 'parcours', it: 'cacce', es: 'búsquedas' },
  firstFree:         { en: 'First hunt free', nl: 'Eerste tocht gratis', de: 'Erste Tour gratis', fr: '1ʳᵉ aventure gratuite', it: 'Prima caccia gratis', es: 'Primera búsqueda gratis' },
  unlockCityCta:     { en: 'Unlock all of {city} — €5', nl: 'Ontgrendel heel {city} — €5', de: '{city} komplett freischalten — €5', fr: 'Débloquer tout {city} — 5 €', it: 'Sblocca tutta {city} — 5 €', es: 'Desbloquear todo {city} — 5 €' },
  locked:            { en: 'Locked', nl: 'Vergrendeld', de: 'Gesperrt', fr: 'Verrouillé', it: 'Bloccato', es: 'Bloqueado' },
  unlockToPlay:      { en: 'Unlock to play', nl: 'Ontgrendel om te spelen', de: 'Freischalten zum Spielen', fr: 'Débloquer pour jouer', it: 'Sblocca per giocare', es: 'Desbloquear para jugar' },
  freeHunt:          { en: 'Free', nl: 'Gratis', de: 'Gratis', fr: 'Gratuit', it: 'Gratis', es: 'Gratis' },
  cityUnlockedNote:  { en: 'You\'ve unlocked this city — all hunts are open.', nl: 'Je hebt deze stad ontgrendeld — alle tochten zijn open.', de: 'Du hast diese Stadt freigeschaltet — alle Touren sind offen.', fr: 'Vous avez débloqué cette ville — tous les parcours sont ouverts.', it: 'Hai sbloccato questa città — tutte le cacce sono aperte.', es: 'Has desbloqueado esta ciudad — todas las búsquedas están abiertas.' },
  unlockingCity:     { en: 'Opening payment…', nl: 'Betaling openen…', de: 'Zahlung öffnen…', fr: 'Paiement en cours…', it: 'Apertura pagamento…', es: 'Abriendo pago…' },
  unlockSuccess:     { en: 'City unlocked! 🎉', nl: 'Stad ontgrendeld! 🎉', de: 'Stadt freigeschaltet! 🎉', fr: 'Ville débloquée ! 🎉', it: 'Città sbloccata! 🎉', es: '¡Ciudad desbloqueada! 🎉' },
  signInToUnlock:    { en: 'Sign in to unlock this city', nl: 'Log in om deze stad te ontgrendelen', de: 'Anmelden, um die Stadt freizuschalten', fr: 'Connectez-vous pour débloquer cette ville', it: 'Accedi per sbloccare questa città', es: 'Inicia sesión para desbloquear esta ciudad' },

  // PWA install prompt
  pwaInstallTitle:   { en: 'Install for the best experience', nl: 'Installeer voor de beste ervaring', de: 'Installiere für das beste Erlebnis', fr: 'Installez pour la meilleure expérience', it: 'Installa per la migliore esperienza', es: 'Instala para la mejor experiencia' },
  pwaInstallBody:    { en: 'Add TourHunts to your home screen — opens fullscreen and works offline.', nl: 'Voeg TourHunts toe aan je beginscherm — opent volledig en werkt offline.', de: 'Füge TourHunts zum Startbildschirm hinzu — öffnet im Vollbild und funktioniert offline.', fr: 'Ajoutez TourHunts à votre écran d\'accueil — plein écran et hors-ligne.', it: 'Aggiungi TourHunts alla schermata Home — a schermo intero e offline.', es: 'Añade TourHunts a tu pantalla de inicio — pantalla completa y sin conexión.' },
  pwaInstallCta:     { en: 'Install', nl: 'Installeren', de: 'Installieren', fr: 'Installer', it: 'Installa', es: 'Instalar' },
  pwaInstallDismiss: { en: 'Not now', nl: 'Niet nu', de: 'Später', fr: 'Plus tard', it: 'Non ora', es: 'Ahora no' },
  pwaIosStep:        { en: 'Tap Share, then Add to Home Screen', nl: 'Tik op Delen, dan Op beginscherm', de: 'Tippe Teilen, dann Zum Home-Bildschirm', fr: 'Appuyez sur Partager, puis Sur l\'écran d\'accueil', it: 'Tocca Condividi, poi Aggiungi a Home', es: 'Toca Compartir, luego Añadir a Inicio' },

  // Multiplayer rooms
  playWithFriends:   { en: 'Play with friends', nl: 'Speel met vrienden', de: 'Mit Freunden spielen', fr: 'Jouer entre amis', it: 'Gioca con gli amici', es: 'Jugar con amigos' },
  createRoom:        { en: 'Create a room', nl: 'Kamer aanmaken', de: 'Raum erstellen', fr: 'Créer une salle', it: 'Crea una stanza', es: 'Crear sala' },
  joinRoom:          { en: 'Join a room', nl: 'Kamer joinen', de: 'Raum beitreten', fr: 'Rejoindre une salle', it: 'Unisciti a una stanza', es: 'Unirse a una sala' },
  roomCode:          { en: 'Room code', nl: 'Kamercode', de: 'Raumcode', fr: 'Code de salle', it: 'Codice stanza', es: 'Código de sala' },
  enterRoomCode:     { en: 'Enter room code', nl: 'Voer kamercode in', de: 'Raumcode eingeben', fr: 'Entrez le code', it: 'Inserisci codice', es: 'Ingresa el código' },
  shareRoomCode:     { en: 'Share this code with friends', nl: 'Deel deze code met vrienden', de: 'Teile den Code mit Freunden', fr: 'Partagez ce code', it: 'Condividi questo codice', es: 'Comparte este código' },
  copyCode:          { en: 'Copy code', nl: 'Code kopiëren', de: 'Code kopieren', fr: 'Copier le code', it: 'Copia codice', es: 'Copiar código' },
  copied:            { en: 'Copied!', nl: 'Gekopieerd!', de: 'Kopiert!', fr: 'Copié !', it: 'Copiato!', es: '¡Copiado!' },
  lobby:             { en: 'Lobby', nl: 'Lobby', de: 'Lobby', fr: 'Salon', it: 'Lobby', es: 'Sala de espera' },
  waitingForHost:    { en: 'Waiting for host to start…', nl: 'Wachten op host…', de: 'Warten auf den Host…', fr: 'En attente de l\'hôte…', it: 'In attesa dell\'host…', es: 'Esperando al anfitrión…' },
  startRace:         { en: 'Start race', nl: 'Start race', de: 'Rennen starten', fr: 'Démarrer la course', it: 'Avvia gara', es: 'Iniciar carrera' },
  players:           { en: 'Players', nl: 'Spelers', de: 'Spieler', fr: 'Joueurs', it: 'Giocatori', es: 'Jugadores' },
  host:              { en: 'Host', nl: 'Host', de: 'Host', fr: 'Hôte', it: 'Host', es: 'Anfitrión' },
  you:               { en: 'You', nl: 'Jij', de: 'Du', fr: 'Vous', it: 'Tu', es: 'Tú' },
  liveScoreboard:    { en: 'Live scoreboard', nl: 'Live scorebord', de: 'Live-Anzeigetafel', fr: 'Tableau en direct', it: 'Classifica live', es: 'Marcador en vivo' },
  raceStarted:       { en: 'Race started!', nl: 'Race gestart!', de: 'Rennen gestartet!', fr: 'Course lancée !', it: 'Gara iniziata!', es: '¡Carrera iniciada!' },
  raceFinished:      { en: 'Race finished', nl: 'Race afgelopen', de: 'Rennen beendet', fr: 'Course terminée', it: 'Gara finita', es: 'Carrera terminada' },
  firstToArrive:     { en: 'First to arrive +50 bonus', nl: 'Eerste aankomst +50 bonus', de: 'Als Erster +50 Bonus', fr: '1ᵉʳ arrivé : +50 bonus', it: 'Primo arrivato +50 bonus', es: '1° en llegar +50 bonus' },
  invalidRoomCode:   { en: 'Invalid or expired room code', nl: 'Ongeldige of verlopen code', de: 'Ungültiger oder abgelaufener Code', fr: 'Code invalide ou expiré', it: 'Codice non valido o scaduto', es: 'Código inválido o expirado' },
  roomFull:          { en: 'Room is full', nl: 'Kamer is vol', de: 'Raum ist voll', fr: 'Salle pleine', it: 'Stanza piena', es: 'Sala llena' },
  signInToPlayMp:    { en: 'Sign in to play with friends', nl: 'Log in om met vrienden te spelen', de: 'Melde dich an, um mit Freunden zu spielen', fr: 'Connectez-vous pour jouer entre amis', it: 'Accedi per giocare con amici', es: 'Inicia sesión para jugar con amigos' },
  leaveRoom:         { en: 'Leave room', nl: 'Kamer verlaten', de: 'Raum verlassen', fr: 'Quitter la salle', it: 'Lascia stanza', es: 'Salir de sala' },
  inRoomBadge:       { en: 'Multiplayer', nl: 'Multiplayer', de: 'Mehrspieler', fr: 'Multijoueur', it: 'Multigiocatore', es: 'Multijugador' },
  stopsCompleted:    { en: 'stops', nl: 'stops', de: 'Stopps', fr: 'étapes', it: 'tappe', es: 'paradas' },
  resumeRaceTitle:   { en: 'Resume your race', nl: 'Hervat je race', de: 'Rennen fortsetzen', fr: 'Reprendre la course', it: 'Riprendi la gara', es: 'Reanudar carrera' },
  rejoinLobbyTitle:  { en: 'Rejoin lobby', nl: 'Terug naar lobby', de: 'Lobby beitreten', fr: 'Rejoindre le salon', it: 'Torna alla lobby', es: 'Volver a la sala' },
  viewRaceResults:   { en: 'View race results', nl: 'Bekijk uitslag', de: 'Ergebnisse ansehen', fr: 'Voir les résultats', it: 'Vedi risultati', es: 'Ver resultados' },
  dismiss:           { en: 'Dismiss', nl: 'Sluiten', de: 'Schließen', fr: 'Ignorer', it: 'Chiudi', es: 'Descartar' },
  hostLeftBadge:     { en: 'Host left — race ended', nl: 'Host vertrokken — race beëindigd', de: 'Host weg — Rennen beendet', fr: 'Hôte parti — course terminée', it: 'Host uscito — gara finita', es: 'Anfitrión salió — carrera terminada' },
  raceResults:       { en: 'Race results', nl: 'Race-uitslag', de: 'Renn-Ergebnisse', fr: 'Résultats', it: 'Risultati gara', es: 'Resultados' },
  goToHunt:          { en: 'Go to hunt', nl: 'Naar de tocht', de: 'Zur Tour', fr: 'Aller à la chasse', it: 'Vai alla caccia', es: 'Ir a la búsqueda' },
  openLobby:         { en: 'Open lobby', nl: 'Open lobby', de: 'Lobby öffnen', fr: 'Ouvrir le salon', it: 'Apri lobby', es: 'Abrir sala' },
  alreadyInRoomConfirm: { en: 'You\'re already in room {code}. Leave that room and continue?', nl: 'Je zit al in kamer {code}. Verlaten en doorgaan?', de: 'Du bist bereits in Raum {code}. Verlassen und fortfahren?', fr: 'Vous êtes déjà dans la salle {code}. Quitter et continuer ?', it: 'Sei già nella stanza {code}. Lasciare e continuare?', es: 'Ya estás en la sala {code}. ¿Salir y continuar?' },
  abandonRace:       { en: 'Abandon race', nl: 'Race opgeven', de: 'Rennen aufgeben', fr: 'Abandonner la course', it: 'Abbandona gara', es: 'Abandonar carrera' },
  abandonConfirm:    { en: 'Forfeit this race? Your current score will be locked in and you\'ll appear as finished on the leaderboard.', nl: 'Race opgeven? Je huidige score wordt vastgelegd en je verschijnt als voltooid op het scorebord.', de: 'Rennen aufgeben? Dein aktueller Punktestand wird festgehalten und du erscheinst als fertig.', fr: 'Abandonner ? Votre score actuel sera enregistré et vous apparaîtrez comme terminé.', it: 'Abbandonare? Il tuo punteggio attuale verrà salvato e apparirai come terminato.', es: '¿Abandonar? Tu puntuación actual se guardará y aparecerás como terminado.' },

  // Tours (self-guided itineraries: food, nightlife, shopping, etc.)
  tours:             { en: 'Tours', nl: 'Tours', de: 'Touren', fr: 'Visites', it: 'Tour', es: 'Tours' },
  selfGuidedTours:   { en: 'Self-guided tours', nl: 'Self-guided tours', de: 'Selbstgeführte Touren', fr: 'Visites autoguidées', it: 'Tour autoguidati', es: 'Tours autoguiados' },
  tourLabel:         { en: 'Tour', nl: 'Tour', de: 'Tour', fr: 'Visite', it: 'Tour', es: 'Tour' },
  huntLabel:         { en: 'Hunt', nl: 'Tocht', de: 'Tour', fr: 'Chasse', it: 'Caccia', es: 'Búsqueda' },
  catNightlife:      { en: 'Nightlife', nl: 'Uitgaan', de: 'Nachtleben', fr: 'Vie nocturne', it: 'Vita notturna', es: 'Vida nocturna' },
  catFood:           { en: 'Food', nl: 'Eten', de: 'Essen', fr: 'Gastronomie', it: 'Cucina', es: 'Gastronomía' },
  catShopping:       { en: 'Shopping', nl: 'Shoppen', de: 'Shopping', fr: 'Shopping', it: 'Shopping', es: 'Compras' },
  catCulture:        { en: 'Culture', nl: 'Cultuur', de: 'Kultur', fr: 'Culture', it: 'Cultura', es: 'Cultura' },
  catFamily:         { en: 'Family', nl: 'Familie', de: 'Familie', fr: 'Famille', it: 'Famiglia', es: 'Familia' },
  startTour:         { en: 'Start tour', nl: 'Start tour', de: 'Tour starten', fr: 'Démarrer la visite', it: 'Inizia tour', es: 'Iniciar tour' },
  tourStops:         { en: 'Tour stops', nl: 'Tour stops', de: 'Tour-Stationen', fr: 'Étapes de la visite', it: 'Tappe del tour', es: 'Paradas del tour' },
  imHere:            { en: 'I\'m here', nl: 'Ik ben er', de: 'Ich bin da', fr: 'Je suis ici', it: 'Sono qui', es: 'Estoy aquí' },
  visited:           { en: 'Visited', nl: 'Bezocht', de: 'Besucht', fr: 'Visité', it: 'Visitato', es: 'Visitado' },
  openInMaps:        { en: 'Open in Maps', nl: 'Open in Maps', de: 'In Karten öffnen', fr: 'Ouvrir dans Plans', it: 'Apri in Mappe', es: 'Abrir en Mapas' },
  tourComplete:      { en: 'Tour complete!', nl: 'Tour voltooid!', de: 'Tour abgeschlossen!', fr: 'Visite terminée !', it: 'Tour completato!', es: '¡Tour completado!' },
  exitTour:          { en: 'Exit tour', nl: 'Tour verlaten', de: 'Tour verlassen', fr: 'Quitter la visite', it: 'Esci dal tour', es: 'Salir del tour' },
  nextStop:          { en: 'Next stop', nl: 'Volgende stop', de: 'Nächster Stopp', fr: 'Étape suivante', it: 'Prossima tappa', es: 'Siguiente parada' },
  prevStop:          { en: 'Previous', nl: 'Vorige', de: 'Vorherige', fr: 'Précédent', it: 'Precedente', es: 'Anterior' },

  // Homepage selling sections
  howItWorks:        { en: 'How it works', nl: 'Hoe het werkt', de: 'So funktioniert es', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona' },
  howStep1Title:     { en: 'Pick a country and city', nl: 'Kies een land en stad', de: 'Land und Stadt wählen', fr: 'Choisissez un pays et une ville', it: 'Scegli un paese e una città', es: 'Elige un país y una ciudad' },
  howStep1Desc:      { en: 'Browse our growing collection of countries and cities. Each city has multiple themed hunts — your first hunt in every city is always free.', nl: 'Blader door onze groeiende collectie landen en steden. Elke stad heeft meerdere thema-tochten — je eerste tocht in elke stad is altijd gratis.', de: 'Stöbere durch unsere wachsende Auswahl an Ländern und Städten. Jede Stadt bietet mehrere Themen-Touren — deine erste Tour in jeder Stadt ist immer gratis.', fr: 'Parcourez notre collection grandissante de pays et de villes. Chaque ville propose plusieurs chasses à thème — votre première chasse dans chaque ville est toujours gratuite.', it: 'Sfoglia la nostra raccolta in crescita di paesi e città. Ogni città offre diverse cacce a tema — la prima caccia in ogni città è sempre gratis.', es: 'Explora nuestra creciente colección de países y ciudades. Cada ciudad tiene varias búsquedas temáticas — tu primera búsqueda en cada ciudad siempre es gratis.' },
  howStep2Title:     { en: 'Follow the clues', nl: 'Volg de raadsels', de: 'Folge den Hinweisen', fr: 'Suivez les indices', it: 'Segui gli indizi', es: 'Sigue las pistas' },
  howStep2Desc:      { en: 'Walk through the city using GPS-guided riddles. Discover hidden stories, fun facts, and trivia at every stop.', nl: 'Wandel door de stad met GPS-geleide raadsels. Ontdek verborgen verhalen, weetjes en trivia bij elke stop.', de: 'Spaziere durch die Stadt mit GPS-geführten Rätseln. Entdecke verborgene Geschichten und Wissenswertes an jedem Stopp.', fr: 'Parcourez la ville avec des énigmes guidées par GPS. Découvrez des histoires cachées et des anecdotes à chaque étape.', it: 'Cammina per la città con indizi guidati dal GPS. Scopri storie nascoste e curiosità a ogni tappa.', es: 'Camina por la ciudad con acertijos guiados por GPS. Descubre historias ocultas y curiosidades en cada parada.' },
  howStep3Title:     { en: 'Score & compete', nl: 'Scoor & strijd', de: 'Punkten & antreten', fr: 'Marquez & affrontez', it: 'Punteggia & sfida', es: 'Puntúa & compite' },
  howStep3Desc:      { en: 'Earn points for speed, accuracy, and trivia. Challenge friends in real-time multiplayer races.', nl: 'Verdien punten voor snelheid, nauwkeurigheid en trivia. Daag vrienden uit in real-time multiplayer races.', de: 'Sammle Punkte für Geschwindigkeit, Genauigkeit und Quiz. Fordere Freunde in Echtzeit-Multiplayer-Rennen heraus.', fr: 'Gagnez des points pour la vitesse, la précision et le quiz. Affrontez vos amis en course multijoueur en temps réel.', it: 'Guadagna punti per velocità, precisione e quiz. Sfida gli amici in gare multiplayer in tempo reale.', es: 'Gana puntos por velocidad, precisión y trivia. Desafía a amigos en carreras multijugador en tiempo real.' },
  whyUtr:            { en: 'Why TourHunts', nl: 'Waarom TourHunts', de: 'Warum TourHunts', fr: 'Pourquoi TourHunts', it: 'Perché TourHunts', es: 'Por qué TourHunts' },
  whyOffline:        { en: 'Works offline', nl: 'Werkt offline', de: 'Offline verfügbar', fr: 'Fonctionne hors ligne', it: 'Funziona offline', es: 'Funciona sin conexión' },
  whyOfflineDesc:    { en: 'Once you start a hunt, all clues download to your phone. No data needed while exploring.', nl: 'Zodra je een tocht start, worden alle raadsels gedownload. Geen data nodig tijdens het verkennen.', de: 'Sobald du eine Tour startest, werden alle Hinweise heruntergeladen. Kein Internet während der Erkundung nötig.', fr: 'Une fois la chasse lancée, tous les indices sont téléchargés. Pas de données nécessaires.', it: 'Una volta iniziata la caccia, tutti gli indizi vengono scaricati. Nessun dato necessario.', es: 'Una vez iniciada la búsqueda, todas las pistas se descargan. Sin datos necesarios.' },
  whyNoApp:          { en: 'No app to install', nl: 'Geen app nodig', de: 'Keine App nötig', fr: 'Pas d\'app à installer', it: 'Nessuna app da installare', es: 'Sin app que instalar' },
  whyNoAppDesc:      { en: 'Everything runs in your browser. Add to home screen for a full-screen native-like experience.', nl: 'Alles draait in je browser. Voeg toe aan beginscherm voor een fullscreen ervaring.', de: 'Alles läuft im Browser. Zum Startbildschirm hinzufügen für ein natives Vollbild-Erlebnis.', fr: 'Tout fonctionne dans votre navigateur. Ajoutez à l\'écran d\'accueil pour une expérience plein écran.', it: 'Tutto gira nel browser. Aggiungi alla schermata Home per un\'esperienza nativa a schermo intero.', es: 'Todo funciona en tu navegador. Añade a la pantalla de inicio para una experiencia nativa.' },
  whyStories:        { en: 'Stories, not just pins', nl: 'Verhalen, geen pins', de: 'Geschichten, nicht nur Orte', fr: 'Des histoires, pas juste des lieux', it: 'Storie, non solo punti', es: 'Historias, no solo ubicaciones' },
  whyStoriesDesc:    { en: 'Every stop reveals a piece of local history, culture, or a quirky secret most tourists miss.', nl: 'Elke stop onthult een stukje lokale geschiedenis, cultuur of een geheim dat toeristen meestal missen.', de: 'Jeder Stopp enthüllt ein Stück Lokalgeschichte, Kultur oder ein Geheimnis, das die meisten Touristen verpassen.', fr: 'Chaque étape révèle un morceau d\'histoire locale, de culture ou un secret que la plupart des touristes manquent.', it: 'Ogni tappa rivela un pezzo di storia locale, cultura o un segreto che la maggior parte dei turisti perde.', es: 'Cada parada revela un trozo de historia local, cultura o un secreto que la mayoría de los turistas se pierde.' },
  whyPrice:          { en: 'One price, play forever', nl: 'Eén prijs, voor altijd spelen', de: 'Ein Preis, für immer spielen', fr: 'Un prix, jouez pour toujours', it: 'Un prezzo, gioca per sempre', es: 'Un precio, juega para siempre' },
  whyPriceDesc:      { en: '€5 unlocks a city forever. Replay hunts, beat your best score, share with friends — no subscriptions.', nl: '€5 ontgrendelt een stad voor altijd. Herspel tochten, versla je beste score, deel met vrienden — geen abonnementen.', de: '€5 schaltet eine Stadt für immer frei. Spiele Touren erneut, schlage deinen Rekord, teile mit Freunden — kein Abo.', fr: '5 € débloque une ville pour toujours. Rejouez, battez votre record, partagez — pas d\'abonnement.', it: '5 € sblocca una città per sempre. Rigioca, batti il tuo record, condividi — nessun abbonamento.', es: '5 € desbloquea una ciudad para siempre. Repite, supera tu récord, comparte — sin suscripciones.' },
  reviewsTitle:      { en: 'What explorers say', nl: 'Wat ontdekkers zeggen', de: 'Was Entdecker sagen', fr: 'Ce que disent les explorateurs', it: 'Cosa dicono gli esploratori', es: 'Lo que dicen los exploradores' },
  review1Name:       { en: 'Sarah & Tom', nl: 'Sarah & Tom', de: 'Sarah & Tom', fr: 'Sarah & Tom', it: 'Sarah & Tom', es: 'Sarah y Tom' },
  review1Text:       { en: 'We discovered neighbourhoods we never knew existed. The stories at every stop made the city feel completely new.', nl: 'We ontdekten wijken die we niet kenden. De verhalen bij elke stop maakten de stad volledig nieuw.', de: 'Wir haben Viertel entdeckt, die wir nie kannten. Die Geschichten an jedem Stopp ließen die Stadt ganz neu wirken.', fr: 'Nous avons découvert des quartiers que nous ne connaissions pas. Les histoires à chaque étape rendaient la ville totalement neuve.', it: 'Abbiamo scoperto quartieri che non conoscevamo. Le storie a ogni tappa hanno reso la città del tutto nuova.', es: 'Descubrimos barrios que no conocíamos. Las historias en cada parada hicieron que la ciudad se sintiera completamente nueva.' },
  review2Name:       { en: 'Familie de Vries', nl: 'Familie de Vries', de: 'Familie de Vries', fr: 'Famille de Vries', it: 'Famiglia de Vries', es: 'Familia de Vries' },
  review2Text:       { en: 'Perfect for a family Sunday. The kids loved the trivia and the compass arrow made it feel like a treasure hunt.', nl: 'Perfect voor een familiezondag. De kids hielden van de trivia en de kompaspijl voelde als een speurtocht.', de: 'Perfekt für einen Familien-Sonntag. Die Kids liebten das Quiz und der Kompasspfeil fühlte sich wie eine Schatzsuche an.', fr: 'Parfait pour un dimanche en famille. Les enfants ont adoré le quiz et la flèche du compas faisait penser à une chasse au trésor.', it: 'Perfetto per una domenica in famiglia. I bambini hanno adorato il quiz e la freccia bussola sembrava una caccia al tesoro.', es: 'Perfecto para un domingo en familia. A los niños les encantó la trivia y la brújula parecía una búsqueda del tesoro.' },
  review3Name:       { en: 'Marco, Milan', nl: 'Marco, Milaan', de: 'Marco, Mailand', fr: 'Marco, Milan', it: 'Marco, Milano', es: 'Marco, Milán' },
  review3Text:       { en: 'I\'ve lived in this city for 10 years and still learned things I\'d never noticed. Brilliant for locals too.', nl: 'Ik woon hier al 10 jaar en leerde nog dingen die me nooit waren opgevallen. Ook voor locals geweldig.', de: 'Ich lebe seit 10 Jahren hier und habe trotzdem Dinge gelernt, die mir nie aufgefallen waren. Auch für Einheimische brillant.', fr: 'J\'habite ici depuis 10 ans et j\'ai quand même appris des choses que je n\'avais jamais remarquées. Brillant aussi pour les locaux.', it: 'Vivo qui da 10 anni e ho comunque imparato cose che non avevo mai notato. Brillante anche per chi è del posto.', es: 'Vivo aquí hace 10 años y aún así aprendí cosas que nunca había notado. Brillante también para los locales.' },
  ctaTitle:          { en: 'Ready to explore?', nl: 'Klaar om te ontdekken?', de: 'Bereit zu entdecken?', fr: 'Prêt à explorer ?', it: 'Pronto a esplorare?', es: '¿Listo para explorar?' },
  ctaSubtitle:       { en: 'Your first hunt in every city is free. No credit card required — just sign in and start walking.', nl: 'Je eerste tocht in elke stad is gratis. Geen creditcard nodig — gewoon inloggen en lopen.', de: 'Deine erste Tour in jeder Stadt ist gratis. Keine Kreditkarte nötig — einfach anmelden und losgehen.', fr: 'Votre première chasse dans chaque ville est gratuite. Pas de carte bancaire — connectez-vous et partez.', it: 'La tua prima caccia in ogni città è gratis. Nessuna carta richiesta — accedi e inizia a camminare.', es: 'Tu primera búsqueda en cada ciudad es gratis. Sin tarjeta requerida — solo inicia sesión y camina.' },
  ctaButton:         { en: 'Start your first hunt — free', nl: 'Start je eerste tocht — gratis', de: 'Starte deine erste Tour — gratis', fr: 'Commencez votre première chasse — gratuite', it: 'Inizia la tua prima caccia — gratis', es: 'Comienza tu primera búsqueda — gratis' },
  footerTagline:     { en: 'GPS-powered walking hunts through the world\'s most beautiful cities.', nl: 'GPS-gestuurde wandeltochten door de mooiste steden ter wereld.', de: 'GPS-gestützte Walking-Touren durch die schönsten Städte der Welt.', fr: 'Chasses à pied guidées par GPS dans les plus belles villes du monde.', it: 'Cacce a piedi con GPS nelle città più belle del mondo.', es: 'Búsquedas a pie con GPS por las ciudades más bellas del mundo.' },
  footerLinks:       { en: 'Cities', nl: 'Steden', de: 'Städte', fr: 'Villes', it: 'Città', es: 'Ciudades' },
  footerAbout:       { en: 'About', nl: 'Over ons', de: 'Über uns', fr: 'À propos', it: 'Chi siamo', es: 'Acerca de' },
  footerContact:     { en: 'Contact', nl: 'Contact', de: 'Kontakt', fr: 'Contact', it: 'Contatti', es: 'Contacto' },
  footerPrivacy:     { en: 'Privacy', nl: 'Privacy', de: 'Datenschutz', fr: 'Confidentialité', it: 'Privacy', es: 'Privacidad' },
  footerTerms:       { en: 'Terms', nl: 'Voorwaarden', de: 'AGB', fr: 'Conditions', it: 'Termini', es: 'Términos' },
  footerCopy:        { en: '© 2026 TourHunts. All rights reserved.', nl: '© 2026 TourHunts. Alle rechten voorbehouden.', de: '© 2026 TourHunts. Alle Rechte vorbehalten.', fr: '© 2026 TourHunts. Tous droits réservés.', it: '© 2026 TourHunts. Tutti i diritti riservati.', es: '© 2026 TourHunts. Todos los derechos reservados.' },
  statCities:        { en: 'Cities', nl: 'Steden', de: 'Städte', fr: 'Villes', it: 'Città', es: 'Ciudades' },
  statHunts:         { en: 'Hunts', nl: 'Tochten', de: 'Touren', fr: 'Parcours', it: 'Cacce', es: 'Búsquedas' },
  statStops:         { en: 'Stops', nl: 'Stops', de: 'Stopps', fr: 'Étapes', it: 'Tappe', es: 'Paradas' },
  statRating:        { en: 'Avg. Rating', nl: 'Gem. Score', de: 'Ø Bewertung', fr: 'Note moy.', it: 'Valutaz. media', es: 'Nota media' },

  // Multiplayer enhanced
  mpLivePlayers:     { en: 'Live players', nl: 'Live spelers', de: 'Live-Spieler', fr: 'Joueurs en direct', it: 'Giocatori live', es: 'Jugadores en vivo' },
  mpAtLocation:      { en: 'At', nl: 'Bij', de: 'Bei', fr: 'À', it: 'A', es: 'En' },
  mpFinished:        { en: 'Finished!', nl: 'Klaar!', de: 'Fertig!', fr: 'Terminé !', it: 'Finito!', es: '¡Terminado!' },
  mpRaceTime:        { en: 'Race time', nl: 'Race-tijd', de: 'Rennzeit', fr: 'Temps de course', it: 'Tempo gara', es: 'Tiempo de carrera' },
  mpClueTimes:       { en: 'Stop times', nl: 'Stop-tijden', de: 'Stopp-Zeiten', fr: 'Temps par étape', it: 'Tempi tappa', es: 'Tiempos por parada' },
  mpFirstArrival:    { en: '1st to arrive', nl: '1e aankomst', de: '1. Ankunft', fr: '1ᵉʳ arrivé', it: '1° arrivato', es: '1° en llegar' },
  mpMedalGold:       { en: 'Gold', nl: 'Goud', de: 'Gold', fr: 'Or', it: 'Oro', es: 'Oro' },
  mpMedalSilver:     { en: 'Silver', nl: 'Zilver', de: 'Silber', fr: 'Argent', it: 'Argento', es: 'Plata' },
  mpMedalBronze:     { en: 'Bronze', nl: 'Brons', de: 'Bronze', fr: 'Bronze', it: 'Bronzo', es: 'Bronce' },
  mpDetailedResults: { en: 'Detailed results', nl: 'Gedetailleerde uitslag', de: 'Detaillierte Ergebnisse', fr: 'Résultats détaillés', it: 'Risultati dettagliati', es: 'Resultados detallados' },
  mpPlayerProgress:  { en: 'Progress', nl: 'Voortgang', de: 'Fortschritt', fr: 'Progrès', it: 'Progresso', es: 'Progreso' },
  mpCurrentClue:     { en: 'Current stop', nl: 'Huidige stop', de: 'Aktueller Stopp', fr: 'Étape actuelle', it: 'Tappa attuale', es: 'Parada actual' },
  mpNotStarted:      { en: 'Not started', nl: 'Niet gestart', de: 'Nicht gestartet', fr: 'Pas commencé', it: 'Non iniziato', es: 'No iniciado' },
  mpTotalTime:       { en: 'Total time', nl: 'Totale tijd', de: 'Gesamtzeit', fr: 'Temps total', it: 'Tempo totale', es: 'Tiempo total' },
  mpAvgPerStop:      { en: 'Avg per stop', nl: 'Gem. per stop', de: 'Ø pro Stopp', fr: 'Moy. par étape', it: 'Media a tappa', es: 'Prom. por parada' },
  mpBehindLeader:    { en: 'behind leader', nl: 'achter koploper', de: 'hinter dem Führenden', fr: 'derrière le leader', it: 'dietro il leader', es: 'detrás del líder' },

  // Profile history
  histMpRaces:     { en: 'Multiplayer races', nl: 'Multiplayer races', de: 'Multiplayer-Rennen', fr: 'Courses multijoueur', it: 'Gare multiplayer', es: 'Carreras multijugador' },

  // Sticky + extra CTAs
  stickyCtaPrimary:  { en: 'Start free hunt', nl: 'Start gratis tocht', de: 'Gratis Tour starten', fr: 'Commencer gratuitement', it: 'Inizia gratis', es: 'Empezar gratis' },
  stickyCtaSecondary:{ en: 'With friends', nl: 'Met vrienden', de: 'Mit Freunden', fr: 'Entre amis', it: 'Con amici', es: 'Con amigos' },
  exploreCities:     { en: 'Explore cities', nl: 'Verken steden', de: 'Städte entdecken', fr: 'Explorer les villes', it: 'Esplora le città', es: 'Explora ciudades' },
  midCtaTitle:       { en: 'Your next adventure starts here', nl: 'Je volgende avontuur begint hier', de: 'Dein nächstes Abenteuer beginnt hier', fr: 'Votre prochaine aventure commence ici', it: 'La tua prossima avventura inizia qui', es: 'Tu próxima aventura empieza aquí' },
  midCtaDesc:        { en: 'Pick a country below — first hunt in every city is on us.', nl: 'Kies hieronder een land — je eerste tocht in elke stad is gratis.', de: 'Wähle unten ein Land — deine erste Tour in jeder Stadt geht aufs Haus.', fr: 'Choisissez un pays ci-dessous — la première chasse de chaque ville est offerte.', it: 'Scegli un paese qui sotto — la prima caccia di ogni città è gratis.', es: 'Elige un país abajo — la primera búsqueda de cada ciudad es gratis.' },
  faqTitle:          { en: 'Common questions', nl: 'Veelgestelde vragen', de: 'Häufige Fragen', fr: 'Questions fréquentes', it: 'Domande frequenti', es: 'Preguntas frecuentes' },
  faqQ1:             { en: 'Do I need to install an app?', nl: 'Moet ik een app installeren?', de: 'Muss ich eine App installieren?', fr: 'Faut-il installer une application ?', it: 'Devo installare un\'app?', es: '¿Necesito instalar una app?' },
  faqA1:             { en: 'No. Everything runs in your browser. You can add it to your home screen for a fullscreen experience, but no app store install is needed.', nl: 'Nee. Alles draait in je browser. Voeg het toe aan je beginscherm voor een fullscreen ervaring, maar een app store-installatie is niet nodig.', de: 'Nein. Alles läuft im Browser. Du kannst es zum Startbildschirm hinzufügen, aber eine App-Installation ist nicht nötig.', fr: 'Non. Tout fonctionne dans votre navigateur. Vous pouvez l\'ajouter à l\'écran d\'accueil, mais aucune installation d\'app n\'est requise.', it: 'No. Tutto gira nel browser. Puoi aggiungerlo alla schermata Home, ma non serve installare alcuna app.', es: 'No. Todo funciona en tu navegador. Puedes añadirlo a la pantalla de inicio, pero no necesitas instalar ninguna app.' },
  faqQ2:             { en: 'How long does a hunt take?', nl: 'Hoe lang duurt een tocht?', de: 'Wie lange dauert eine Tour?', fr: 'Combien de temps dure une chasse ?', it: 'Quanto dura una caccia?', es: '¿Cuánto dura una búsqueda?' },
  faqA2:             { en: 'Most hunts take 90–180 minutes at a relaxed pace, covering 3–6 km. You can pause at any time and resume later — your progress is saved.', nl: 'De meeste tochten duren 90–180 minuten in een rustig tempo, over 3–6 km. Je kunt op elk moment pauzeren en later doorgaan — je voortgang wordt opgeslagen.', de: 'Die meisten Touren dauern 90–180 Minuten bei gemächlichem Tempo (3–6 km). Du kannst jederzeit pausieren — dein Fortschritt bleibt gespeichert.', fr: '90–180 minutes à un rythme tranquille, sur 3 à 6 km. Vous pouvez vous arrêter à tout moment, votre progression est sauvegardée.', it: 'Tra 90 e 180 minuti a passo tranquillo, 3–6 km. Puoi sospendere e riprendere quando vuoi — i progressi sono salvati.', es: 'Entre 90 y 180 minutos a paso tranquilo, 3–6 km. Puedes pausar y continuar cuando quieras — tu progreso se guarda.' },
  faqQ3:             { en: 'What if I get lost or stuck?', nl: 'Wat als ik verdwaal of vastzit?', de: 'Was, wenn ich mich verlaufe oder feststecke?', fr: 'Et si je me perds ou bloque ?', it: 'E se mi perdo o mi blocco?', es: '¿Y si me pierdo o me atasco?' },
  faqA3:             { en: 'Three tiers of hints unlock with credits — neighborhood, street-level, and a final compass-bearing nudge. You always have a way forward.', nl: 'Drie hint-niveaus worden ontgrendeld met credits — buurt, straat, en een laatste kompas-aanwijzing. Je komt altijd verder.', de: 'Drei Hinweis-Stufen via Credits — Gegend, Straße und eine finale Kompass-Richtung. Du kommst immer weiter.', fr: 'Trois niveaux d\'indices avec des crédits — quartier, rue, et une boussole finale. Vous avancez toujours.', it: 'Tre livelli di suggerimenti con crediti — zona, strada e una bussola finale. Procedi sempre.', es: 'Tres niveles de pistas con créditos — barrio, calle y una brújula final. Siempre puedes avanzar.' },
  faqQ4:             { en: 'Can I play with kids?', nl: 'Kan ik spelen met kinderen?', de: 'Kann ich mit Kindern spielen?', fr: 'Puis-je jouer avec des enfants ?', it: 'Posso giocare con i bambini?', es: '¿Puedo jugar con niños?' },
  faqA4:             { en: 'Yes — most riddles are family-friendly and the trivia adds great learning moments. Recommended ages 8+.', nl: 'Ja — de meeste raadsels zijn familievriendelijk en de trivia voegt mooie leermomenten toe. Aanbevolen vanaf 8 jaar.', de: 'Ja — die meisten Rätsel sind familienfreundlich, das Quiz bietet schöne Lernmomente. Empfohlen ab 8 Jahren.', fr: 'Oui — la plupart des énigmes sont familiales et le quiz apporte de beaux moments d\'apprentissage. Recommandé dès 8 ans.', it: 'Sì — la maggior parte degli enigmi è adatta alle famiglie e il quiz è educativo. Consigliato dagli 8 anni.', es: 'Sí — la mayoría de los acertijos son familiares y la trivia aporta aprendizaje. Recomendado desde 8 años.' },
  faqQ5:             { en: 'Does it work offline?', nl: 'Werkt het offline?', de: 'Funktioniert es offline?', fr: 'Cela fonctionne-t-il hors ligne ?', it: 'Funziona offline?', es: '¿Funciona sin conexión?' },
  faqA5:             { en: 'Once a hunt is started, all clues, hints, and stories are cached. GPS still works without data — just bring your charger.', nl: 'Zodra een tocht is gestart, worden alle raadsels en hints opgeslagen. GPS werkt ook zonder data — neem wel je oplader mee.', de: 'Sobald eine Tour gestartet ist, werden alle Hinweise gespeichert. GPS funktioniert auch ohne Daten — Ladegerät mitnehmen.', fr: 'Une fois la chasse lancée, tous les indices sont en cache. Le GPS fonctionne sans données — pensez à votre chargeur.', it: 'Una volta avviata la caccia, tutti gli indizi sono in cache. Il GPS funziona senza dati — porta il caricabatterie.', es: 'Una vez iniciada la búsqueda, todas las pistas se guardan. El GPS funciona sin datos — lleva tu cargador.' },
}

export function t(lang: Lang, key: string): string {
  const entry = T[key]
  if (!entry) return key
  return entry[lang] ?? entry.en ?? key
}
