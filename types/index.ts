export type HintTier = 1 | 2 | 3

export interface Clue {
  id: string
  order: number
  totalClues: number
  riddle: string
  locationName: string
  lat: number
  lng: number
  radiusM: number
  hint1: string
  hint2: string
  hint2PhotoUrl?: string | null
  hint3: string        // static fallback; server returns dynamic version
}

export interface VerifyResponse {
  arrived: boolean
  distanceM?: number
  bearing?: number
  dynamicHint3?: string
  pointsEarned?: number
  timeBonus?: number
  hintPenalty?: number
  nextClue?: Clue | null
  huntComplete?: boolean
}

export interface CreditPackage {
  id: string
  credits: number
  priceCents: number
  label: string
  badge?: string
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'small',  credits: 5,  priceCents: 99,  label: '5 credits' },
  { id: 'medium', credits: 15, priceCents: 249, label: '15 credits', badge: 'Popular' },
  { id: 'large',  credits: 40, priceCents: 499, label: '40 credits', badge: 'Best value' },
]

export const HINT_COSTS: Record<HintTier, number> = { 1: 0, 2: 3, 3: 5 }

export const SCORE = {
  base: 100,
  timeBonus: 20,
  timeBonusWindowMs: 10 * 60 * 1000,
  hint2Penalty: 10,
  hint3Penalty: 25,
}

export const STARTING_CREDITS = 10
