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
  title:             { en: 'Netherlands', nl: 'Nederland', de: 'Niederlande', fr: 'Pays-Bas', it: 'Paesi Bassi', es: 'Países Bajos' },
  subtitle:          { en: 'Grand Tour', nl: 'Grand Tour', de: 'Grand Tour', fr: 'Grand Tour', it: 'Grand Tour', es: 'Gran Tour' },
  tagline:           { en: 'The country, unlocked.', nl: 'Het land, ontgrendeld.', de: 'Das Land, entsperrt.', fr: 'Le pays, déverrouillé.', it: 'Il paese, svelato.', es: 'El país, desbloqueado.' },
  priceTag:          { en: '€5 · lifetime access', nl: '€5 · onbeperkt spelen', de: '€5 · lebenslanger Zugang', fr: '€5 · accès à vie', it: '€5 · accesso a vita', es: '€5 · acceso de por vida' },
  ctaStart:          { en: 'Start the adventure', nl: 'Start het avontuur', de: 'Abenteuer beginnen', fr: 'Commencer l\'aventure', it: 'Inizia l\'avventura', es: 'Comenzar la aventura' },
  ctaResume:         { en: 'Resume', nl: 'Hervatten', de: 'Fortsetzen', fr: 'Reprendre', it: 'Riprendi', es: 'Reanudar' },
  featStops:         { en: '8 handpicked stops', nl: '8 zorgvuldig gekozen locaties', de: '8 handverlesene Stopps', fr: '8 étapes choisies', it: '8 tappe selezionate', es: '8 paradas seleccionadas' },
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
  pwaInstallBody:    { en: 'Add UTR Tour to your home screen — opens fullscreen and works offline.', nl: 'Voeg UTR Tour toe aan je beginscherm — opent volledig en werkt offline.', de: 'Füge UTR Tour zum Startbildschirm hinzu — öffnet im Vollbild und funktioniert offline.', fr: 'Ajoutez UTR Tour à votre écran d\'accueil — plein écran et hors-ligne.', it: 'Aggiungi UTR Tour alla schermata Home — a schermo intero e offline.', es: 'Añade UTR Tour a tu pantalla de inicio — pantalla completa y sin conexión.' },
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
  waitingForHost:    { en: 'Waiting for host to start…', nl: 'Wachten op host…', de: 'Warten auf den Host…', fr: 'En attente du hôte…', it: 'In attesa dell\'host…', es: 'Esperando al anfitrión…' },
  startRace:         { en: 'Start race', nl: 'Start race', de: 'Rennen starten', fr: 'Démarrer la course', it: 'Avvia gara', es: 'Iniciar carrera' },
  players:           { en: 'Players', nl: 'Spelers', de: 'Spieler', fr: 'Joueurs', it: 'Giocatori', es: 'Jugadores' },
  host:              { en: 'Host', nl: 'Host', de: 'Host', fr: 'Hôte', it: 'Host', es: 'Anfitrión' },
  you:               { en: 'You', nl: 'Jij', de: 'Du', fr: 'Vous', it: 'Tu', es: 'Tú' },
  liveScoreboard:    { en: 'Live scoreboard', nl: 'Live scorebord', de: 'Live-Anzeigetafel', fr: 'Tableau en direct', it: 'Classifica live', es: 'Marcador en vivo' },
  raceStarted:       { en: 'Race started!', nl: 'Race gestart!', de: 'Rennen gestartet!', fr: 'Course lancée !', it: 'Gara iniziata!', es: '¡Carrera iniciada!' },
  raceFinished:      { en: 'Race finished', nl: 'Race afgelopen', de: 'Rennen beendet', fr: 'Course terminée', it: 'Gara finita', es: 'Carrera terminada' },
  firstToArrive:     { en: 'First to arrive +50 bonus', nl: 'Eerste aankomst +50 bonus', de: 'Als Erster +50 Bonus', fr: '1ᵉʳ arrivé : +50 bonus', it: 'Primo arrivato +50 bonus', es: 'Primer llegado +50 bonus' },
  invalidRoomCode:   { en: 'Invalid or expired room code', nl: 'Ongeldige of verlopen code', de: 'Ungültiger oder abgelaufener Code', fr: 'Code invalide ou expiré', it: 'Codice non valido o scaduto', es: 'Código inválido o expirado' },
  roomFull:          { en: 'Room is full', nl: 'Kamer is vol', de: 'Raum ist voll', fr: 'Salle pleine', it: 'Stanza piena', es: 'Sala llena' },
  signInToPlayMp:    { en: 'Sign in to play with friends', nl: 'Log in om met vrienden te spelen', de: 'Anmelden zum Mehrspieler', fr: 'Connectez-vous pour jouer entre amis', it: 'Accedi per giocare con amici', es: 'Inicia sesión para jugar con amigos' },
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

  // Homepage selling sections
  howItWorks:        { en: 'How it works', nl: 'Hoe het werkt', de: 'So funktioniert es', fr: 'Comment ça marche', it: 'Come funziona', es: 'Cómo funciona' },
  howStep1Title:     { en: 'Pick a city', nl: 'Kies een stad', de: 'Stadt wählen', fr: 'Choisissez une ville', it: 'Scegli una città', es: 'Elige una ciudad' },
  howStep1Desc:      { en: 'Browse our curated city guides. Each comes with multiple themed hunts — your first is always free.', nl: 'Blader door onze samengestelde stadsgidsen. Elke stad heeft meerdere thema-tochten — de eerste is altijd gratis.', de: 'Stöbere in unseren kuratierten Stadtführern. Jeder bietet mehrere Themen-Touren — die erste ist immer gratis.', fr: 'Parcourez nos guides de villes. Chaque ville propose plusieurs chasses à thème — la première est toujours gratuite.', it: 'Sfoglia le nostre guide cittadine. Ogni città ha più cacce a tema — la prima è sempre gratis.', es: 'Explora nuestras guías de ciudades. Cada una tiene varias búsquedas temáticas — la primera siempre es gratis.' },
  howStep2Title:     { en: 'Follow the clues', nl: 'Volg de raadsels', de: 'Folge den Hinweisen', fr: 'Suivez les indices', it: 'Segui gli indizi', es: 'Sigue las pistas' },
  howStep2Desc:      { en: 'Walk through the city using GPS-guided riddles. Discover hidden stories, fun facts, and trivia at every stop.', nl: 'Wandel door de stad met GPS-geleide raadsels. Ontdek verborgen verhalen, weetjes en trivia bij elke stop.', de: 'Spaziere durch die Stadt mit GPS-geführten Rätseln. Entdecke verborgene Geschichten und Wissenswertes an jedem Stopp.', fr: 'Parcourez la ville avec des énigmes guidées par GPS. Découvrez des histoires cachées et des anecdotes à chaque étape.', it: 'Cammina per la città con indizi guidati dal GPS. Scopri storie nascoste e curiosità a ogni tappa.', es: 'Camina por la ciudad con acertijos guiados por GPS. Descubre historias ocultas y curiosidades en cada parada.' },
  howStep3Title:     { en: 'Score & compete', nl: 'Score & competeer', de: 'Punkte & vergleiche', fr: 'Scorez & competez', it: 'Punteggia & competí', es: 'Puntúa & compite' },
  howStep3Desc:      { en: 'Earn points for speed, accuracy, and trivia. Challenge friends in real-time multiplayer races.', nl: 'Verdien punten voor snelheid, nauwkeurigheid en trivia. Daag vrienden uit in real-time multiplayer races.', de: 'Sammle Punkte für Geschwindigkeit, Genauigkeit und Quiz. Fordere Freunde in Echtzeit-Multiplayer-Rennen heraus.', fr: 'Gagnez des points pour la vitesse, la précision et le quiz. Affrontez vos amis en course multijoueur en temps réel.', it: 'Guadagna punti per velocità, precisione e quiz. Sfida gli amici in gare multiplayer in tempo reale.', es: 'Gana puntos por velocidad, precisión y trivia. Desafía a amigos en carreras multijugador en tiempo real.' },
  whyUtr:            { en: 'Why UTR Tour', nl: 'Waarom UTR Tour', de: 'Warum UTR Tour', fr: 'Pourquoi UTR Tour', it: 'Perché UTR Tour', es: 'Por qué UTR Tour' },
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
  review1Text:       { en: 'We discovered Utrecht neighbourhoods we never knew existed. The stories made every stop feel special.', nl: 'We ontdekten wijken in Utrecht die we niet kenden. De verhalen maakten elke stop bijzonder.', de: 'Wir haben Utrechter Viertel entdeckt, die wir nie kannten. Die Geschichten machten jeden Stopp besonders.', fr: 'Nous avons découvert des quartiers d\'Utrecht inconnus. Les histoires rendaient chaque étape spéciale.', it: 'Abbiamo scoperto quartieri di Utrecht che non conoscevamo. Le storie rendevano ogni tappa speciale.', es: 'Descubrimos barrios de Utrecht que no conocíamos. Las historias hicieron cada parada especial.' },
  review2Name:       { en: 'Familie de Vries', nl: 'Familie de Vries', de: 'Familie de Vries', fr: 'Famille de Vries', it: 'Famiglia de Vries', es: 'Familia de Vries' },
  review2Text:       { en: 'Perfect for a family Sunday. The kids loved the trivia and the compass arrow made it feel like a treasure hunt.', nl: 'Perfect voor een familiezondag. De kids hielden van de trivia en de kompaspijl voelde als een speurtocht.', de: 'Perfekt für einen Familien-Sonntag. Die Kids liebten das Quiz und der Kompasspfeil fühlte sich wie eine Schatzsuche an.', fr: 'Parfait pour un dimanche en famille. Les enfants ont adoré le quiz et la flèche du compas faisait penser à une chasse au trésor.', it: 'Perfetto per una domenica in famiglia. I bambini hanno adorato il quiz e la freccia bussola sembrava una caccia al tesoro.', es: 'Perfecto para un domingo en familia. A los niños les encantó la trivia y la brújula parecía una búsqueda del tesoro.' },
  review3Name:       { en: 'Marco, Milan', nl: 'Marco, Milaan', de: 'Marco, Mailand', fr: 'Marco, Milan', it: 'Marco, Milano', es: 'Marco, Milán' },
  review3Text:       { en: 'I\'ve lived in Amsterdam 10 years and still learned new things on the Hidden Amsterdam hunt. Brilliant.', nl: 'Ik woon al 10 jaar in Amsterdam en leerde nog nieuwe dingen op de Hidden Amsterdam-tocht. Geweldig.', de: 'Ich lebe seit 10 Jahren in Amsterdam und habe auf der Hidden-Amsterdam-Tour noch Neues gelernt. Brillant.', fr: 'J\'habite Amsterdam depuis 10 ans et j\'ai quand même appris de nouvelles choses. Brillant.', it: 'Vivo ad Amsterdam da 10 anni e ho comunque imparato cose nuove nella caccia Hidden Amsterdam. Brillante.', es: 'Vivo en Ámsterdam hace 10 años y aún así aprendí cosas nuevas. Brillante.' },
  ctaTitle:          { en: 'Ready to explore?', nl: 'Klaar om te ontdekken?', de: 'Bereit zu entdecken?', fr: 'Prêt à explorer ?', it: 'Pronto a esplorare?', es: '¿Listo para explorar?' },
  ctaSubtitle:       { en: 'Your first hunt in every city is free. No credit card required — just sign in and start walking.', nl: 'Je eerste tocht in elke stad is gratis. Geen creditcard nodig — gewoon inloggen en lopen.', de: 'Deine erste Tour in jeder Stadt ist gratis. Keine Kreditkarte nötig — einfach anmelden und losgehen.', fr: 'Votre première chasse dans chaque ville est gratuite. Pas de carte bancaire — connectez-vous et partez.', it: 'La tua prima caccia in ogni città è gratis. Nessuna carta richiesta — accedi e inizia a camminare.', es: 'Tu primera búsqueda en cada ciudad es gratis. Sin tarjeta requerida — solo inicia sesión y camina.' },
  ctaButton:         { en: 'Start your first hunt — free', nl: 'Start je eerste tocht — gratis', de: 'Starte deine erste Tour — gratis', fr: 'Commencez votre première chasse — gratuite', it: 'Inizia la tua prima caccia — gratis', es: 'Comienza tu primera búsqueda — gratis' },
  footerTagline:     { en: 'GPS-powered walking hunts through the Netherlands\' most beautiful cities.', nl: 'GPS-gestuurde wandeltochten door de mooiste steden van Nederland.', de: 'GPS-gestützte Walking-Touren durch die schönsten Städte der Niederlande.', fr: 'Chasses à pied guidées par GPS dans les plus belles villes des Pays-Bas.', it: 'Cacce a piedi con GPS nelle città più belle dei Paesi Bassi.', es: 'Búsquedas a pie con GPS por las ciudades más bellas de los Países Bajos.' },
  footerLinks:       { en: 'Cities', nl: 'Steden', de: 'Städte', fr: 'Villes', it: 'Città', es: 'Ciudades' },
  footerAbout:       { en: 'About', nl: 'Over ons', de: 'Über uns', fr: 'À propos', it: 'Chi siamo', es: 'Acerca de' },
  footerContact:     { en: 'Contact', nl: 'Contact', de: 'Kontakt', fr: 'Contact', it: 'Contatti', es: 'Contacto' },
  footerPrivacy:     { en: 'Privacy', nl: 'Privacy', de: 'Datenschutz', fr: 'Confidentialité', it: 'Privacy', es: 'Privacidad' },
  footerTerms:       { en: 'Terms', nl: 'Voorwaarden', de: 'AGB', fr: 'Conditions', it: 'Termini', es: 'Términos' },
  footerCopy:        { en: '© 2026 UTR Tour. All rights reserved.', nl: '© 2026 UTR Tour. Alle rechten voorbehouden.', de: '© 2026 UTR Tour. Alle Rechte vorbehalten.', fr: '© 2026 UTR Tour. Tous droits réservés.', it: '© 2026 UTR Tour. Tutti i diritti riservati.', es: '© 2026 UTR Tour. Todos los derechos reservados.' },
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
  midCtaDesc:        { en: 'Pick a city below — first hunt is on us.', nl: 'Kies hieronder een stad — de eerste tocht is gratis.', de: 'Wähle unten eine Stadt — die erste Tour geht aufs Haus.', fr: 'Choisissez une ville ci-dessous — la première chasse est offerte.', it: 'Scegli una città qui sotto — la prima caccia è gratis.', es: 'Elige una ciudad — la primera búsqueda es gratis.' },
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
