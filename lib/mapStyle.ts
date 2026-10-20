/**
 * Basemap for every MapLibre map in the app.
 *
 * OpenFreeMap: free, no API key, commercial use allowed, OpenMapTiles schema
 * on OpenStreetMap data. Attribution ("OpenFreeMap © OpenMapTiles Data from
 * OpenStreetMap") ships in the TileJSON, so it shows up automatically as long
 * as each map keeps an AttributionControl — always use MAP_ATTRIBUTION_CONTROL.
 *
 * (Replaced CARTO basemaps, whose free tier is non-commercial only.)
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

/** Origin the service worker runtime-caches (style, TileJSON, tiles, sprites, glyphs). */
export const MAP_TILE_ORIGIN = 'https://tiles.openfreemap.org'

/** Compact "ⓘ" attribution — visible on every map, small on phones. */
export const MAP_ATTRIBUTION_CONTROL = { compact: true } as const
