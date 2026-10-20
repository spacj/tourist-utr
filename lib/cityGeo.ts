/**
 * City-level map centres (the historic centre / main square). Public
 * knowledge, never a hunt stop: landing pages and "save map for offline"
 * use these so they can show the area without revealing any stop.
 *
 * A city document may carry its own `lat`/`lng`; that wins over this table.
 */
const CENTERS: Record<string, { lat: number; lng: number }> = {
  city_utrecht:    { lat: 52.0907, lng: 5.1214 },
  city_amsterdam:  { lat: 52.3728, lng: 4.8936 },
  city_the_hague:  { lat: 52.0799, lng: 4.3113 },
  city_rotterdam:  { lat: 51.9225, lng: 4.4792 },
  city_delft:      { lat: 52.0116, lng: 4.3571 },
  city_leiden:     { lat: 52.1583, lng: 4.4931 },
  city_haarlem:    { lat: 52.3812, lng: 4.6368 },
  city_maastricht: { lat: 50.8492, lng: 5.6889 },
  city_milan:      { lat: 45.4642, lng: 9.1900 },
  city_rome:       { lat: 41.8986, lng: 12.4768 },
}

export function cityCenter(
  city: { id: string; lat?: unknown; lng?: unknown } | null | undefined,
): { lat: number; lng: number } | null {
  if (!city) return null
  const lat = Number(city.lat)
  const lng = Number(city.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng }
  return CENTERS[city.id] ?? null
}
