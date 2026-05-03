export type HintTier = 1 | 2 | 3
export type Difficulty = 'easy' | 'medium' | 'hard'

export const CITY_UNLOCK_PRICE_EUROS = 5

export interface CityI18n {
  name?: string
  country?: string
  description?: string
}

export interface City {
  id: string
  name: string
  country: string
  description: string
  coverEmoji?: string
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

export interface ClueI18n {
  theme?: string
  riddle?: string
  locationName?: string
  hint1?: string
  hint2?: string
  hint3?: string
  funFact?: string
  trivia?: Trivia
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
  }
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
  home:              { en: 'Home',                nl: 'Home',               de: 'Start',                fr: 'Accueil' },
  expand:            { en: 'Expand',              nl: 'Uitklappen',         de: 'Erweitern',            fr: 'Agrandir' },
  collapse:          { en: 'Collapse',            nl: 'Inklappen',          de: 'Einklappen',           fr: 'Réduire' },
  moreHints:         { en: 'Hints & details',     nl: 'Hints & details',    de: 'Hinweise & Details',   fr: 'Indices & détails' },
  leaveHuntConfirm:  { en: 'Leave the hunt? Your progress is saved.', nl: 'Stoppen? Voortgang blijft bewaard.', de: 'Tour verlassen? Dein Fortschritt bleibt erhalten.', fr: 'Quitter ? Votre progression est enregistrée.' },

  // Difficulty
  diffEasy:          { en: 'Easy',                nl: 'Makkelijk',          de: 'Leicht',               fr: 'Facile' },
  diffMedium:        { en: 'Medium',              nl: 'Gemiddeld',          de: 'Mittel',               fr: 'Moyen' },
  diffHard:          { en: 'Hard',                nl: 'Moeilijk',           de: 'Schwer',               fr: 'Difficile' },

  // Empty / status
  noHuntsYet:        { en: 'No hunts available yet.', nl: 'Nog geen tochten beschikbaar.', de: 'Noch keine Touren verfügbar.', fr: 'Aucun parcours pour l\'instant.' },
  ctaCompleted:      { en: 'Completed',           nl: 'Voltooid',           de: 'Abgeschlossen',        fr: 'Terminé' },
  inProgress:        { en: 'In progress',         nl: 'Bezig',              de: 'Läuft',                fr: 'En cours' },
  bestScore:         { en: 'Best',                nl: 'Beste',              de: 'Bestleistung',         fr: 'Meilleur' },

  // Score breakdown
  noHintBonus:       { en: 'No-hint bonus',       nl: 'Geen-hint-bonus',    de: 'Kein-Hinweis-Bonus',   fr: 'Bonus sans indice' },
  streakBonusLabel:  { en: 'Streak bonus',        nl: 'Reeks-bonus',        de: 'Serien-Bonus',         fr: 'Bonus série' },

  // Profile page
  profileTitle:      { en: 'Your profile',        nl: 'Jouw profiel',       de: 'Dein Profil',          fr: 'Votre profil' },
  profileSignInHint: { en: 'Sign in to track your progress across hunts.', nl: 'Log in om je voortgang bij te houden.', de: 'Melde dich an, um deinen Fortschritt zu verfolgen.', fr: 'Connectez-vous pour suivre votre progression.' },
  signInGoogle:      { en: 'Sign in with Google', nl: 'Inloggen met Google', de: 'Mit Google anmelden', fr: 'Se connecter avec Google' },
  backToHunts:       { en: '← Back to hunts',     nl: '← Terug naar tochten', de: '← Zurück zu Touren', fr: '← Retour aux parcours' },
  huntsDone:         { en: 'Hunts done',          nl: 'Tochten gedaan',     de: 'Touren erledigt',      fr: 'Parcours faits' },
  placesFound:       { en: 'Places found',        nl: 'Plekken gevonden',   de: 'Orte gefunden',        fr: 'Lieux trouvés' },
  totalScore:        { en: 'Total score',         nl: 'Totaalscore',        de: 'Gesamtpunkte',         fr: 'Score total' },
  huntHistory:       { en: 'Hunt history',        nl: 'Geschiedenis',       de: 'Verlauf',              fr: 'Historique' },
  noHuntsPlayed:     { en: 'No hunts played yet. Go explore!', nl: 'Nog niets gespeeld. Ga op pad!', de: 'Noch nichts gespielt. Geh los!', fr: 'Aucun parcours. À l\'aventure !' },
  playHunt:          { en: 'Play a hunt',         nl: 'Speel een tocht',    de: 'Tour starten',         fr: 'Jouer un parcours' },
  signOut:           { en: 'Sign out',            nl: 'Uitloggen',          de: 'Abmelden',             fr: 'Se déconnecter' },

  // Achievements (complete page)
  achExplorer:       { en: 'Explorer',            nl: 'Ontdekker',          de: 'Entdecker',            fr: 'Explorateur' },
  achFlawless:       { en: 'Flawless',            nl: 'Vlekkeloos',         de: 'Makellos',             fr: 'Sans faute' },
  achFinisher:       { en: 'Finisher',            nl: 'Voltooid',           de: 'Vollender',            fr: 'Finisseur' },
  ach1000:           { en: '1000+',               nl: '1000+',              de: '1000+',                fr: '1000+' },

  // Cities + unlock
  chooseCity:        { en: 'Choose a city',       nl: 'Kies een stad',      de: 'Stadt wählen',         fr: 'Choisissez une ville' },
  cities:            { en: 'Cities',              nl: 'Steden',             de: 'Städte',               fr: 'Villes' },
  hunts:             { en: 'hunts',               nl: 'tochten',            de: 'Touren',               fr: 'parcours' },
  firstFree:         { en: 'First hunt free',     nl: 'Eerste tocht gratis',de: 'Erste Tour gratis',    fr: '1ʳᵉ aventure gratuite' },
  unlockCityCta:     { en: 'Unlock all of {city} — €5', nl: 'Ontgrendel heel {city} — €5', de: '{city} komplett freischalten — €5', fr: 'Débloquer tout {city} — 5 €' },
  locked:            { en: 'Locked',              nl: 'Vergrendeld',        de: 'Gesperrt',             fr: 'Verrouillé' },
  unlockToPlay:      { en: 'Unlock to play',      nl: 'Ontgrendel om te spelen', de: 'Freischalten zum Spielen', fr: 'Débloquer pour jouer' },
  freeHunt:          { en: 'Free',                nl: 'Gratis',             de: 'Gratis',               fr: 'Gratuit' },
  cityUnlockedNote:  { en: 'You\'ve unlocked this city — all hunts are open.', nl: 'Je hebt deze stad ontgrendeld — alle tochten zijn open.', de: 'Du hast diese Stadt freigeschaltet — alle Touren sind offen.', fr: 'Vous avez débloqué cette ville — tous les parcours sont ouverts.' },
  unlockingCity:     { en: 'Opening payment…',    nl: 'Betaling openen…',   de: 'Zahlung öffnen…',      fr: 'Paiement en cours…' },
  unlockSuccess:     { en: 'City unlocked! 🎉',   nl: 'Stad ontgrendeld! 🎉', de: 'Stadt freigeschaltet! 🎉', fr: 'Ville débloquée ! 🎉' },
  signInToUnlock:    { en: 'Sign in to unlock this city', nl: 'Log in om deze stad te ontgrendelen', de: 'Anmelden, um die Stadt freizuschalten', fr: 'Connectez-vous pour débloquer cette ville' },
}

export function t(lang: Lang, key: string): string {
  const entry = T[key]
  if (!entry) return key
  return entry[lang] ?? entry.en ?? key
}
