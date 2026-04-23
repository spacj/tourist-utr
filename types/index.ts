export type HintTier = 1 | 2 | 3
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Hunt {
  id: string
  title: string
  description: string
  city: string
  difficulty: Difficulty
  clueCount: number
  durationMin: number
  distanceKm: number
  priceEuros?: number
  rating?: number
  badge?: string
  active: boolean
}

export interface Trivia {
  question: string
  options: string[]
  correctIndex: number
  explain: string
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

// Rebalanced: tier 1 is free (generous first hint), tier 2 & 3 cost more
export const HINT_COSTS: Record<HintTier, number> = { 1: 0, 2: 2, 3: 4 }

export const SCORE = {
  base: 100,
  timeBonus: 20,
  timeBonusWindowMs: 10 * 60 * 1000,
  streakBonus: 15,
  perfectClueBonus: 50,
  triviaBonus: 25,
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
export type Lang = 'en' | 'nl' | 'de' | 'fr'
export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
]

type Dict = Record<string, Record<Lang, string>>
export const T: Dict = {
  title:             { en: 'Utrecht',            nl: 'Utrecht',            de: 'Utrecht',             fr: 'Utrecht' },
  subtitle:          { en: 'Grand Tour',         nl: 'Grand Tour',         de: 'Grand Tour',          fr: 'Grand Tour' },
  tagline:           { en: 'The city, unlocked.', nl: 'De stad, ontgrendeld.', de: 'Die Stadt, entsperrt.', fr: 'La ville, déverrouillée.' },
  priceTag:          { en: '€5 · lifetime access', nl: '€5 · onbeperkt spelen', de: '€5 · lebenslanger Zugang', fr: '€5 · accès à vie' },
  ctaStart:          { en: 'Start the adventure', nl: 'Start het avontuur', de: 'Abenteuer beginnen',  fr: 'Commencer l\'aventure' },
  ctaResume:         { en: 'Resume',              nl: 'Hervatten',          de: 'Fortsetzen',          fr: 'Reprendre' },
  featStops:         { en: '8 handpicked stops', nl: '8 zorgvuldig gekozen locaties', de: '8 handverlesene Stopps', fr: '8 étapes choisies' },
  featStories:       { en: 'Stories & fun facts at every stop', nl: 'Verhalen en weetjes bij elke stop', de: 'Geschichten an jedem Stopp', fr: 'Histoires à chaque étape' },
  featTrivia:        { en: 'Trivia for bonus points', nl: 'Trivia voor bonuspunten', de: 'Quiz für Bonuspunkte', fr: 'Quiz pour des points bonus' },
  featOffline:       { en: 'Works offline once started', nl: 'Werkt offline na de start', de: 'Offline spielbar', fr: 'Fonctionne hors ligne' },
  featGps:           { en: 'GPS-guided, no check-in apps needed', nl: 'GPS-geleid, geen extra apps', de: 'GPS-geführt, keine Extra-App', fr: 'Guidé par GPS' },
  featReplay:        { en: 'Replay as often as you like', nl: 'Zo vaak herspelen als je wilt', de: 'Unbegrenzt wiederholen', fr: 'Rejouable à volonté' },
  availableHunts:    { en: 'Available hunts',    nl: 'Beschikbare tochten', de: 'Verfügbare Touren',   fr: 'Parcours disponibles' },
  whatsIncluded:     { en: 'What\'s included',    nl: 'Wat is inbegrepen',  de: 'Im Preis enthalten',   fr: 'Ce qui est inclus' },
  signInHint:        { en: 'Sign in with Google to save your progress', nl: 'Log in met Google om je voortgang op te slaan', de: 'Mit Google anmelden, um Fortschritt zu speichern', fr: 'Connectez-vous avec Google pour sauvegarder' },
  signIn:            { en: 'Sign in',             nl: 'Inloggen',           de: 'Anmelden',             fr: 'Se connecter' },
  places:            { en: 'stops',               nl: 'stops',              de: 'Stopps',               fr: 'étapes' },
  min:               { en: 'min',                 nl: 'min',                de: 'Min',                  fr: 'min' },
  km:                { en: 'km',                  nl: 'km',                 de: 'km',                   fr: 'km' },
  yourClue:          { en: 'Your clue',           nl: 'Jouw raadsel',       de: 'Dein Rätsel',          fr: 'Votre énigme' },
  hints:             { en: 'Hints',               nl: 'Hints',              de: 'Hinweise',             fr: 'Indices' },
  readAloud:         { en: 'Read aloud',          nl: 'Lees voor',          de: 'Vorlesen',             fr: 'Lire à voix haute' },
  stop:              { en: 'Stop',                nl: 'Stop',               de: 'Stopp',                fr: 'Arrêt' },
  of:                { en: 'of',                  nl: 'van',                de: 'von',                  fr: 'sur' },
  skipTest:          { en: 'Skip to location (test)', nl: 'Ga naar locatie (test)', de: 'Zu Ort springen (test)', fr: 'Aller à la position (test)' },
  youMadeIt:         { en: 'You made it!',        nl: 'Je bent er!',        de: 'Geschafft!',           fr: 'Vous y êtes !' },
  didYouKnow:        { en: 'Did you know?',       nl: 'Wist je dat?',       de: 'Wusstest du?',         fr: 'Le saviez-vous ?' },
  quickQuiz:         { en: 'Quick quiz — +25 bonus', nl: 'Snelle quiz — +25 bonus', de: 'Kurzes Quiz — +25 Bonus', fr: 'Quiz rapide — +25 bonus' },
  correct:           { en: 'Correct! +25 points', nl: 'Goed! +25 punten',   de: 'Richtig! +25 Punkte',  fr: 'Correct ! +25 points' },
  notQuite:          { en: 'Not quite',           nl: 'Niet helemaal',      de: 'Nicht ganz',           fr: 'Presque' },
  continue:          { en: 'Continue',            nl: 'Doorgaan',           de: 'Weiter',               fr: 'Continuer' },
  nextClue:          { en: 'Next clue →',        nl: 'Volgend raadsel →',  de: 'Nächstes Rätsel →',    fr: 'Prochaine énigme →' },
  seeFinal:          { en: 'See final score',    nl: 'Bekijk eindscore',   de: 'Endstand ansehen',     fr: 'Voir le score final' },
  share:             { en: 'Share',              nl: 'Delen',              de: 'Teilen',               fr: 'Partager' },
  baseScore:         { en: 'Base score',         nl: 'Basisscore',         de: 'Grundpunkte',          fr: 'Score de base' },
  speedBonus:        { en: 'Speed bonus',        nl: 'Snelheidsbonus',     de: 'Geschwindigkeitsbonus', fr: 'Bonus vitesse' },
  hintsUsed:         { en: 'Hints used',         nl: 'Hints gebruikt',     de: 'Hinweise genutzt',     fr: 'Indices utilisés' },
  pointsEarned:      { en: 'Points earned',      nl: 'Punten verdiend',    de: 'Punkte erhalten',      fr: 'Points gagnés' },
  huntComplete:      { en: 'Hunt complete!',     nl: 'Tocht voltooid!',    de: 'Tour abgeschlossen!',  fr: 'Tour terminé !' },
  finalScore:        { en: 'Final score',        nl: 'Eindscore',          de: 'Endstand',             fr: 'Score final' },
  points:            { en: 'points',             nl: 'punten',             de: 'Punkte',               fr: 'points' },
  locations:         { en: 'Locations',          nl: 'Locaties',            de: 'Orte',                fr: 'Lieux' },
  creditsSpent:      { en: 'Credits spent',      nl: 'Credits besteed',    de: 'Credits ausgegeben',   fr: 'Crédits dépensés' },
  playAgain:         { en: 'Play again',         nl: 'Opnieuw spelen',     de: 'Erneut spielen',       fr: 'Rejouer' },
  viewProfile:       { en: 'View profile',       nl: 'Bekijk profiel',     de: 'Profil ansehen',       fr: 'Voir le profil' },
  neighbourhoodClue: { en: 'Neighbourhood clue', nl: 'Buurt-hint',         de: 'Gegend-Hinweis',       fr: 'Indice de quartier' },
  streetHint:        { en: 'Street-level hint',  nl: 'Straathint',         de: 'Straßen-Hinweis',      fr: 'Indice de rue' },
  showMap:           { en: 'Show on map',        nl: 'Toon op kaart',      de: 'Auf Karte zeigen',     fr: 'Voir sur la carte' },
  unlocked:          { en: 'Unlocked',           nl: 'Open',               de: 'Entsperrt',            fr: 'Débloqué' },
  free:              { en: 'Free',               nl: 'Gratis',             de: 'Gratis',               fr: 'Gratuit' },
  getReady:          { en: 'Get ready',          nl: 'Maak je klaar',      de: 'Bereit machen',        fr: 'Préparez-vous' },
  credits:           { en: 'credits',            nl: 'credits',            de: 'Credits',              fr: 'crédits' },
  metres:            { en: 'metres',             nl: 'meters',             de: 'Meter',                fr: 'mètres' },
  locating:          { en: 'locating',           nl: 'zoeken',             de: 'suchen',               fr: 'recherche' },
  arrived:           { en: 'arrived!',           nl: 'aangekomen!',        de: 'angekommen!',          fr: 'arrivé !' },
}

export function t(lang: Lang, key: string): string {
  const entry = T[key]
  if (!entry) return key
  return entry[lang] ?? entry.en ?? key
}
