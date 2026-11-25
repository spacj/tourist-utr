import { HttpError } from '@/lib/apiAuth'

/**
 * Pure helpers for creator profiles (tested in tests/creatorProfile.test.ts).
 * Server-side reads/writes live in lib/creators.ts.
 */

/**
 * Countries a creator can be paid in: Stripe Connect Express countries we
 * accept for now (EU/EEA + UK, CH, US, CA, AU). Extend as needed.
 */
export const CREATOR_COUNTRIES = [
  'at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie', 'it',
  'lv', 'lt', 'lu', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se',
  'no', 'is', 'li', 'gb', 'ch', 'us', 'ca', 'au',
] as const

export type CreatorCountry = (typeof CREATOR_COUNTRIES)[number]

export const DISPLAY_NAME_MAX = 60
export const BIO_MAX = 600

/** "Anna's Ghost Walks!" → "annas-ghost-walks" (ascii, 3–40 chars). */
export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return s.length >= 3 ? s : `creator-${s || 'x'}`.slice(0, 40)
}

/** Slug candidates to try in order: the base, then base-2, base-3, … */
export function slugCandidates(base: string, count = 20): string[] {
  const out = [base]
  for (let i = 2; i <= count; i++) out.push(`${base.slice(0, 36)}-${i}`)
  return out
}

export interface CreatorProfileInput {
  displayName: string
  bio: string
  country: CreatorCountry
  acceptTerms: boolean
}

/** Validate a POST /api/creator/profile body (throws HttpError 400). */
export function parseCreatorProfileInput(body: Record<string, unknown>): CreatorProfileInput {
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().replace(/\s+/g, ' ') : ''
  if (displayName.length < 2 || displayName.length > DISPLAY_NAME_MAX) throw new HttpError(400, 'invalid_displayName')
  const bio = typeof body.bio === 'string' ? body.bio.trim() : ''
  if (bio.length > BIO_MAX) throw new HttpError(400, 'invalid_bio')
  const country = typeof body.country === 'string' ? body.country.toLowerCase() : ''
  if (!(CREATOR_COUNTRIES as readonly string[]).includes(country)) throw new HttpError(400, 'invalid_country')
  return { displayName, bio, country: country as CreatorCountry, acceptTerms: body.acceptTerms === true }
}
