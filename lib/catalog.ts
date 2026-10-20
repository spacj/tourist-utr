import 'server-only'
import { cache } from 'react'
import { adminDb } from '@/lib/firebaseAdmin'
import type { City, Country, Hunt, Lang } from '@/types'

/**
 * Server-side reads of the public catalogue (countries, cities, hunts) for
 * SSR pages, metadata and the sitemap. Only public, serialisable fields are
 * returned — never clues, answers, coordinates of stops or mystery solutions.
 *
 * Every loader returns `null` when Firestore can't be read (e.g. a build
 * machine without credentials) so callers can degrade to client-side fetching
 * instead of failing the build/render.
 */

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const LANGS: Lang[] = ['en', 'nl', 'de', 'fr', 'it', 'es']

export type PublicCity = City & { lat?: number; lng?: number; updatedAt?: number }
export type PublicHunt = Hunt & { isMystery?: boolean; updatedAt?: number }

export function isValidId(id: string | undefined | null): id is string {
  return !!id && ID_RE.test(id)
}

function toMs(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const ms = (v as { toMillis?: () => number } | null | undefined)?.toMillis?.()
  return typeof ms === 'number' ? ms : undefined
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Keep only the listed string fields of each language entry. */
function pickI18n<K extends string>(raw: unknown, fields: K[]): Partial<Record<Lang, Partial<Record<K, string>>>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Partial<Record<Lang, Partial<Record<K, string>>>> = {}
  for (const lang of LANGS) {
    const entry = (raw as Record<string, unknown>)[lang]
    if (!entry || typeof entry !== 'object') continue
    const picked: Partial<Record<K, string>> = {}
    for (const f of fields) {
      const v = (entry as Record<string, unknown>)[f]
      if (typeof v === 'string' && v) picked[f] = v
    }
    if (Object.keys(picked).length) out[lang] = picked
  }
  return Object.keys(out).length ? out : undefined
}

function toCity(id: string, d: Record<string, unknown>): PublicCity {
  const city: PublicCity = {
    id,
    countryId: str(d.countryId, 'nl'),
    name: str(d.name, id),
    country: str(d.country),
    description: str(d.description),
    priceEuros: num(d.priceEuros, 5),
    huntCount: num(d.huntCount),
    order: num(d.order),
    active: d.active !== false,
  }
  if (typeof d.coverEmoji === 'string') city.coverEmoji = d.coverEmoji
  if (typeof d.imageUrl === 'string' && d.imageUrl) city.imageUrl = d.imageUrl
  const i18n = pickI18n(d.i18n, ['name', 'country', 'description'])
  if (i18n) city.i18n = i18n
  if (Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng)) && d.lat != null && d.lng != null) {
    city.lat = Number(d.lat)
    city.lng = Number(d.lng)
  }
  const updated = toMs(d.updatedAt ?? d.createdAt)
  if (updated) city.updatedAt = updated
  return city
}

function toHunt(id: string, d: Record<string, unknown>): PublicHunt {
  const difficulty = d.difficulty === 'easy' || d.difficulty === 'hard' ? d.difficulty : 'medium'
  const hunt: PublicHunt = {
    id,
    cityId: str(d.cityId),
    order: num(d.order),
    title: str(d.title, id),
    description: str(d.description),
    city: str(d.city),
    difficulty,
    clueCount: num(d.clueCount),
    durationMin: num(d.durationMin),
    distanceKm: num(d.distanceKm),
    active: d.active !== false,
  }
  const i18n = pickI18n(d.i18n, ['title', 'description'])
  if (i18n) hunt.i18n = i18n
  if (d.tourType === 'tour' || d.tourType === 'hunt') hunt.tourType = d.tourType
  if (typeof d.tourCategory === 'string') hunt.tourCategory = d.tourCategory as Hunt['tourCategory']
  if (d.mystery && typeof d.mystery === 'object') hunt.isMystery = true
  const updated = toMs(d.updatedAt ?? d.createdAt)
  if (updated) hunt.updatedAt = updated
  return hunt
}

const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0)

/** All active cities, sorted. `null` = Firestore unavailable. */
export const getActiveCities = cache(async (): Promise<PublicCity[] | null> => {
  try {
    const snap = await adminDb().collection('cities').where('active', '==', true).get()
    return snap.docs.map(d => toCity(d.id, d.data())).sort(byOrder)
  } catch (e) {
    console.warn('[catalog] cities unavailable:', (e as Error)?.message ?? e)
    return null
  }
})

/** All active hunts (top-level docs only), sorted. `null` = Firestore unavailable. */
export const getActiveHunts = cache(async (): Promise<PublicHunt[] | null> => {
  try {
    const snap = await adminDb().collection('hunts').where('active', '==', true).get()
    return snap.docs.map(d => toHunt(d.id, d.data())).sort(byOrder)
  } catch (e) {
    console.warn('[catalog] hunts unavailable:', (e as Error)?.message ?? e)
    return null
  }
})

/** Active, navigable countries. `null` = Firestore unavailable. */
export const getActiveCountries = cache(async (): Promise<(Country & { updatedAt?: number })[] | null> => {
  try {
    const snap = await adminDb().collection('countries').where('active', '==', true).get()
    return snap.docs
      .map(d => {
        const data = d.data() as Record<string, unknown>
        const { createdAt, updatedAt, ...rest } = data
        return { ...(rest as unknown as Country), id: d.id, updatedAt: toMs(updatedAt ?? createdAt) }
      })
      .sort(byOrder)
  } catch (e) {
    console.warn('[catalog] countries unavailable:', (e as Error)?.message ?? e)
    return null
  }
})

/**
 * One city plus its active hunts.
 *  - `null`               → Firestore unavailable (render client-side fallback)
 *  - `{ city: null }`     → the city doesn't exist or is inactive (404)
 */
export const getCityWithHunts = cache(async (cityId: string): Promise<{ city: PublicCity | null; hunts: PublicHunt[] } | null> => {
  if (!isValidId(cityId)) return { city: null, hunts: [] }
  try {
    const [citySnap, huntsSnap] = await Promise.all([
      adminDb().collection('cities').doc(cityId).get(),
      adminDb().collection('hunts').where('cityId', '==', cityId).get(),
    ])
    if (!citySnap.exists) return { city: null, hunts: [] }
    const city = toCity(citySnap.id, citySnap.data() ?? {})
    if (!city.active) return { city: null, hunts: [] }
    const hunts = huntsSnap.docs
      .map(d => toHunt(d.id, d.data()))
      .filter(h => h.active)
      .sort(byOrder)
    return { city, hunts }
  } catch (e) {
    console.warn('[catalog] city unavailable:', (e as Error)?.message ?? e)
    return null
  }
})

/** Languages a hunt's public texts exist in (English is always the base). */
export function huntLanguages(h: Pick<Hunt, 'i18n'>): Lang[] {
  return LANGS.filter(l => l === 'en' || !!h.i18n?.[l]?.title)
}
