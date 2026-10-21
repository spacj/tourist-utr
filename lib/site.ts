/** Site-wide constants. Legal identity comes from env so it's never guessed. */
// The apex domain redirects to www, so www is the canonical origin.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tourhunts.com'
export const SITE_NAME = 'TourHunts'

export const LEGAL = {
  /** Registered business name, e.g. "TourHunts (eenmanszaak M. Al Qaisi)". */
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || 'TourHunts',
  /** Chamber of Commerce (KvK) number. */
  kvk: process.env.NEXT_PUBLIC_LEGAL_KVK || '',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || 'Utrecht, the Netherlands',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@tourhunts.com',
  updated: '19 October 2026',
}
