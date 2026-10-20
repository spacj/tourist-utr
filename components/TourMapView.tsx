'use client'
import { useEffect, useRef, useState } from 'react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Clue } from '@/types'
import { useI18n } from '@/hooks/useI18n'

type MapLib = typeof import('maplibre-gl')

interface Props {
  clues: Clue[]
  visited: Set<string>
  selectedId: string | null
  onSelect: (clueId: string) => void
  userLat: number | null
  userLng: number | null
  /** CSS color for the route polyline + marker accents (e.g. tour category color). */
  accentColor?: string
}

/**
 * Build a 2-layer marker DOM tree:
 *   .tour-marker       <- root, MapLibre sets transform: translate3d(...) on this
 *     .tour-marker-inner  <- visual SVG pin goes here so root.style stays clean
 *
 * Touching root's transform/cssText would fight with MapLibre's positioning and
 * cause markers to "trail" / drift while panning. Keeping the root untouched
 * and updating only the inner element fixes that.
 *
 * The pin is an inline SVG teardrop — bottom tip points to the actual lat/lng
 * (we use anchor: 'bottom' on the MapLibre Marker so the tip sits exactly on
 * the coordinate). The number / check mark lives in a white inner circle.
 */
function buildMarkerDom(): { root: HTMLDivElement; inner: HTMLDivElement } {
  const root = document.createElement('div')
  root.className = 'tour-marker'
  const inner = document.createElement('div')
  inner.className = 'tour-marker-inner'
  // Flat circular badge — cleaner than the old teardrop, reads better at small
  // sizes and aligns visually with the rest of the modern UI (badges, pills).
  // The label/number is rendered as a child <span>; we only mutate that, so
  // MapLibre's translate3d on root keeps working.
  inner.innerHTML = `
    <span class="tour-marker-badge" aria-hidden>
      <span class="tour-marker-label"></span>
    </span>
    <span class="tour-marker-halo" aria-hidden></span>
  `
  root.appendChild(inner)
  return { root, inner }
}

function applyMarkerState(
  inner: HTMLDivElement,
  opts: { number: number; visited: boolean; selected: boolean; accentColor: string }
) {
  const { number, visited, selected, accentColor } = opts
  const fill = visited ? '#22c97a' : accentColor
  const badge = inner.querySelector('.tour-marker-badge') as HTMLElement | null
  const label = inner.querySelector('.tour-marker-label') as HTMLElement | null
  if (badge) badge.style.background = fill
  if (label) label.textContent = visited ? '✓' : String(number)
  inner.classList.toggle('is-selected', selected)
  inner.classList.toggle('is-visited', visited)
}

export function TourMapView({
  clues, visited, selectedId, onSelect, userLat, userLng, accentColor = '#ff6a13',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()
  const libRef = useRef<MapLib | null>(null)
  const mapRef = useRef<MlMap>()
  const userMarkerRef = useRef<MlMarker>()
  const stopMarkersRef = useRef<Map<string, { marker: MlMarker; inner: HTMLDivElement }>>(new Map())
  const userInteractedRef = useRef(false)
  const [followingUser, setFollowingUser] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // ── Initialize map once (maplibre loaded lazily), fit it to all stops ──
  useEffect(() => {
    if (!containerRef.current || clues.length === 0) return
    let cancelled = false
    let map: MlMap | null = null

    const lngs = clues.map(c => c.lng)
    const lats = clues.map(c => c.lat)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    import('maplibre-gl').then((mod) => {
    if (cancelled || !containerRef.current) return
    const lib = ((mod as any).default ?? mod) as MapLib
    libRef.current = lib
    map = new lib.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      bounds,
      fitBoundsOptions: { padding: 80, maxZoom: 16 },
      // OSM/CARTO licence: attribution must stay visible.
      attributionControl: { compact: true },
    })
    mapRef.current = map

    const onUserMove = (e: any) => {
      if (e?.originalEvent) {
        userInteractedRef.current = true
        setFollowingUser(false)
      }
    }
    map.on('dragstart', onUserMove)
    map.on('zoomstart', onUserMove)
    map.on('rotatestart', onUserMove)
    map.on('pitchstart', onUserMove)

    map.on('load', () => {
      // No connecting polyline: tour stops are independent points; the
      // numbered markers already convey order.
      if (!cancelled) setMapReady(true)
    })
    }).catch(() => {})

    return () => {
      cancelled = true
      stopMarkersRef.current.forEach(({ marker }) => marker.remove())
      stopMarkersRef.current.clear()
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = undefined
      }
      map?.remove()
      mapRef.current = undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render / update stop markers when state changes ───────────────
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || !mapReady) return

    const seen = new Set<string>()
    clues.forEach(clue => {
      seen.add(clue.id)
      const isVisited = visited.has(clue.id)
      const isSelected = selectedId === clue.id

      let entry = stopMarkersRef.current.get(clue.id)
      if (!entry) {
        const { root, inner } = buildMarkerDom()
        // Click on inner so the event doesn't bubble into MapLibre's drag.
        inner.addEventListener('click', (ev) => {
          ev.stopPropagation()
          onSelect(clue.id)
        })
        // Circular badge — anchor on center so the disc sits exactly on the
        // lat/lng (instead of the bottom edge that the old teardrop needed).
        const marker = new lib.Marker({ element: root, anchor: 'center' })
          .setLngLat([clue.lng, clue.lat])
          .addTo(map)
        entry = { marker, inner }
        stopMarkersRef.current.set(clue.id, entry)
      }

      // IMPORTANT: only mutate the inner element's styles. The root carries
      // MapLibre's translate3d positioning and must stay untouched.
      applyMarkerState(entry.inner, {
        number: clue.order,
        visited: isVisited,
        selected: isSelected,
        accentColor,
      })
    })

    stopMarkersRef.current.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove()
        stopMarkersRef.current.delete(id)
      }
    })
  }, [clues, visited, selectedId, mapReady, accentColor, onSelect])

  // ── User position marker ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || !mapReady || userLat === null || userLng === null) return

    if (!userMarkerRef.current) {
      const root = document.createElement('div')
      root.className = 'tour-user-marker'
      const inner = document.createElement('div')
      inner.className = 'tour-user-marker-inner'
      root.appendChild(inner)
      userMarkerRef.current = new lib.Marker({ element: root })
        .setLngLat([userLng, userLat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }

    if (followingUser) {
      map.easeTo({ center: [userLng, userLat], duration: 600 })
    }
  }, [userLat, userLng, followingUser, mapReady])

  // ── Pan/zoom to selected stop when it changes ─────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedId) return
    const clue = clues.find(c => c.id === selectedId)
    if (!clue) return
    map.easeTo({ center: [clue.lng, clue.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 600 })
  }, [selectedId, clues, mapReady])

  const recenterOnUser = () => {
    const map = mapRef.current
    if (!map || userLat === null || userLng === null) return
    userInteractedRef.current = false
    setFollowingUser(true)
    map.easeTo({ center: [userLng, userLat], zoom: 15.5, duration: 600 })
  }

  const fitAll = () => {
    const map = mapRef.current
    if (!map || clues.length === 0) return
    userInteractedRef.current = true
    setFollowingUser(false)
    const lngs = clues.map(c => c.lng)
    const lats = clues.map(c => c.lat)
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, maxZoom: 16, duration: 600 }
    )
  }

  return (
    <div className="tour-map">
      <div ref={containerRef} className="tour-map-canvas" />
      <div className="tour-map-controls">
        <button type="button" className="tour-map-control" onClick={fitAll} aria-label={t('fitAllStops')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V4a1 1 0 0 1 1-1h3M21 7V4a1 1 0 0 0-1-1h-3M3 17v3a1 1 0 0 0 1 1h3M21 17v3a1 1 0 0 1-1 1h-3" />
          </svg>
        </button>
        {userLat !== null && userLng !== null && (
          <button
            type="button"
            className={`tour-map-control ${followingUser ? 'is-active' : ''}`}
            onClick={recenterOnUser}
            aria-label={t('recenterMap')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
