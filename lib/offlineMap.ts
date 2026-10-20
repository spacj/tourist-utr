'use client'
import { MAP_STYLE_URL } from '@/lib/mapStyle'

/**
 * "Save map for offline": works out every URL MapLibre needs to draw an area
 * (style, TileJSON, sprites, glyphs, vector tiles for a zoom range) and asks
 * the service worker to cache them (public/sw.js, PRECACHE_TILES).
 *
 * Only ever pass a city-level centre here (lib/cityGeo), never stop
 * coordinates: the saved area is a plain disc around the centre.
 */

export interface SaveAreaOptions {
  lat: number
  lng: number
  /** Radius around the centre, km. */
  radiusKm?: number
  minZoom?: number
  maxZoom?: number
  styleUrl?: string
}

export interface SaveProgress {
  done: number
  total: number
  failed: number
}

/** Glyph ranges for Latin text (basic, Latin-1/Extended-A, punctuation). */
const GLYPH_RANGES = ['0-255', '256-511', '8192-8447']

function lng2tile(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}
function lat2tile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

/** Tiles (z/x/y) covering the bounding box of a disc. */
export function tilesForArea(lat: number, lng: number, radiusKm: number, z: number): [number, number, number][] {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const max = 2 ** z - 1
  const clamp = (v: number) => Math.min(max, Math.max(0, v))
  const x0 = clamp(lng2tile(lng - dLng, z)), x1 = clamp(lng2tile(lng + dLng, z))
  const y0 = clamp(lat2tile(lat + dLat, z)), y1 = clamp(lat2tile(lat - dLat, z))
  const out: [number, number, number][] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y])
  return out
}

function fillTemplate(tpl: string, z: number, x: number, y: number) {
  return tpl.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

/** Font stacks referenced by symbol layers (literal arrays only). */
function fontStacks(style: any): string[] {
  const stacks = new Set<string>()
  for (const layer of style?.layers ?? []) {
    let f = layer?.layout?.['text-font']
    if (Array.isArray(f) && f[0] === 'literal') f = f[1]
    if (Array.isArray(f) && f.every((s: unknown) => typeof s === 'string')) stacks.add(f.join(','))
  }
  return Array.from(stacks)
}

/** Every URL needed to render the area offline. */
export async function collectAreaUrls(opts: SaveAreaOptions): Promise<string[]> {
  const { lat, lng, radiusKm = 2.5, minZoom = 12, maxZoom = 16, styleUrl = MAP_STYLE_URL } = opts
  const urls = new Set<string>([styleUrl])

  const style = await fetch(styleUrl).then(r => {
    if (!r.ok) throw new Error(`style ${r.status}`)
    return r.json()
  })

  // Sprites (1x and 2x).
  const sprites: string[] = typeof style.sprite === 'string'
    ? [style.sprite]
    : Array.isArray(style.sprite) ? style.sprite.map((s: { url: string }) => s?.url).filter(Boolean) : []
  for (const s of sprites) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) urls.add(s + suffix)
  }

  // Glyphs. Built through URL() so encoding matches what MapLibre requests.
  if (typeof style.glyphs === 'string') {
    for (const stack of fontStacks(style)) {
      for (const range of GLYPH_RANGES) {
        const raw = style.glyphs.replace('{fontstack}', stack).replace('{range}', range)
        try { urls.add(new URL(raw).toString()) } catch {}
      }
    }
  }

  // Tile sources: TileJSON → tiles[] template → z/x/y for the area.
  for (const src of Object.values<any>(style.sources ?? {})) {
    if (src?.type !== 'vector' && src?.type !== 'raster') continue
    let tiles: string[] | undefined = src.tiles
    let srcMin = src.minzoom ?? 0
    let srcMax = src.maxzoom ?? 22
    if (!tiles && typeof src.url === 'string') {
      urls.add(src.url)
      const tj = await fetch(src.url).then(r => (r.ok ? r.json() : null)).catch(() => null)
      if (!tj) continue
      tiles = tj.tiles
      srcMin = tj.minzoom ?? srcMin
      srcMax = tj.maxzoom ?? srcMax
    }
    const tpl = tiles?.[0]
    if (!tpl) continue
    // Past the source's maxzoom MapLibre overzooms the last level, so
    // clamping costs nothing in detail.
    const zFrom = Math.max(minZoom, srcMin)
    const zTo = Math.min(maxZoom, srcMax)
    for (let z = zFrom; z <= zTo; z++) {
      for (const [tz, x, y] of tilesForArea(lat, lng, radiusKm, z)) urls.add(fillTemplate(tpl, tz, x, y))
    }
  }

  return Array.from(urls)
}

/** True when a service worker can take the job (production, supported browser). */
export function canSaveOffline(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
}

/**
 * Collects the URLs and streams them through the service worker. Resolves
 * with the final counts; rejects if there's no worker or the style can't be
 * fetched (e.g. already offline).
 */
export async function saveAreaOffline(
  opts: SaveAreaOptions,
  onProgress?: (p: SaveProgress) => void,
): Promise<SaveProgress> {
  if (!('serviceWorker' in navigator)) throw new Error('no_sw')
  const reg = await navigator.serviceWorker.ready
  const worker = navigator.serviceWorker.controller ?? reg.active
  if (!worker) throw new Error('no_sw')

  const urls = await collectAreaUrls(opts)

  return new Promise<SaveProgress>((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = (ev: MessageEvent) => {
      const d = ev.data as { type: string } & SaveProgress
      const p = { done: d.done, total: d.total, failed: d.failed }
      onProgress?.(p)
      if (d.type === 'done') {
        channel.port1.close()
        resolve(p)
      }
    }
    worker.postMessage({ type: 'PRECACHE_TILES', urls }, [channel.port2])
  })
}
