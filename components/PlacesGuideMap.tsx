'use client'
import { useEffect, useRef, useState, useMemo } from 'react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Place, PlaceCategory } from '@/lib/md'
import { MAP_STYLE_URL, MAP_ATTRIBUTION_CONTROL } from '@/lib/mapStyle'

type MapLib = typeof import('maplibre-gl')

interface Props {
  places: Place[]
  categories: PlaceCategory[]
  selectedId: string | null
  onSelect: (placeId: string) => void
  userLat: number | null
  userLng: number | null
  /** Embedded in a scrolling page: one finger scrolls the page, two pan the
   *  map (ctrl/⌘ + wheel to zoom on desktop). Default true. */
  cooperativeGestures?: boolean
}

/**
 * Build a category-coloured marker. Same 2-layer DOM pattern as TourMapView —
 * MapLibre owns the root's translate3d transform, we only mutate .inner.
 * Inside the badge we render the category icon (emoji) instead of a number,
 * so a glance at the map tells you the kind of place without picking it.
 */
function buildMarkerDom(icon: string): { root: HTMLDivElement; inner: HTMLDivElement } {
  const root = document.createElement('div')
  root.className = 'place-marker'
  const inner = document.createElement('div')
  inner.className = 'place-marker-inner'
  inner.innerHTML = `
    <span class="place-marker-badge" aria-hidden>
      <span class="place-marker-icon"></span>
    </span>
    <span class="place-marker-halo" aria-hidden></span>
  `
  const labelEl = inner.querySelector('.place-marker-icon') as HTMLElement
  labelEl.textContent = icon
  root.appendChild(inner)
  return { root, inner }
}

function applyMarkerState(
  inner: HTMLDivElement,
  opts: { color: string; selected: boolean }
) {
  const { color, selected } = opts
  const badge = inner.querySelector('.place-marker-badge') as HTMLElement | null
  if (badge) badge.style.background = color
  inner.classList.toggle('is-selected', selected)
}

export function PlacesGuideMap({
  places, categories, selectedId, onSelect, userLat, userLng, cooperativeGestures = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const libRef = useRef<MapLib | null>(null)
  const mapRef = useRef<MlMap>()
  const userMarkerRef = useRef<MlMarker>()
  const placeMarkersRef = useRef<Map<string, { marker: MlMarker; inner: HTMLDivElement }>>(new Map())
  const [mapReady, setMapReady] = useState(false)

  // ── Initialize map once (maplibre-gl loaded lazily), fit it to all places ─────────────────────
  useEffect(() => {
    if (!containerRef.current || places.length === 0) return

    const lngs = places.map(p => p.lng)
    const lats = places.map(p => p.lat)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    let cancelled = false
    let map: MlMap | null = null
    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return
      const lib = ((mod as any).default ?? mod) as MapLib
      libRef.current = lib
      map = new lib.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        bounds,
        fitBoundsOptions: { padding: 80, maxZoom: 16 },
        // OpenFreeMap/OSM attribution must stay visible.
        attributionControl: MAP_ATTRIBUTION_CONTROL,
        cooperativeGestures,
      })
      mapRef.current = map
      map.on('load', () => { if (!cancelled) setMapReady(true) })
    }).catch(() => {})

    // The marker registry is a Map that lives for the component's lifetime.
    const placeMarkers = placeMarkersRef.current
    return () => {
      cancelled = true
      placeMarkers.forEach(({ marker }) => marker.remove())
      placeMarkers.clear()
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = undefined
      }
      map?.remove()
      mapRef.current = undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build a quick id→category lookup for icon + color
  const catById = useMemo(() => new Map<string, PlaceCategory>(categories.map(c => [c.id, c])), [categories])
  const fallback = useMemo<PlaceCategory>(
    () => categories[0] ?? { id: '', label: '', icon: '📍', color: '#2E6A58' },
    [categories],
  )

  // ── Render / update place markers ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || !mapReady) return

    const seen = new Set<string>()
    places.forEach(place => {
      seen.add(place.id)
      const cat = catById.get(place.category) ?? fallback
      const isSelected = selectedId === place.id

      let entry = placeMarkersRef.current.get(place.id)
      if (!entry) {
        const { root, inner } = buildMarkerDom(cat.icon)
        inner.addEventListener('click', (ev) => {
          ev.stopPropagation()
          onSelect(place.id)
        })
        const marker = new lib.Marker({ element: root, anchor: 'center' })
          .setLngLat([place.lng, place.lat])
          .addTo(map)
        entry = { marker, inner }
        placeMarkersRef.current.set(place.id, entry)
      } else {
        // Keep the marker in sync if the place was repositioned.
        entry.marker.setLngLat([place.lng, place.lat])
      }

      applyMarkerState(entry.inner, { color: cat.color, selected: isSelected })
    })

    placeMarkersRef.current.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove()
        placeMarkersRef.current.delete(id)
      }
    })
  }, [places, selectedId, mapReady, onSelect, catById, fallback])

  // ── User location dot ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || userLat === null || userLng === null) return
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
  }, [userLat, userLng, mapReady])

  // ── Pan to selected place ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const place = places.find(p => p.id === selectedId)
    if (!place) return
    map.easeTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }, [selectedId, places])

  const fitAll = () => {
    const map = mapRef.current
    if (!map || places.length === 0) return
    const lngs = places.map(p => p.lng)
    const lats = places.map(p => p.lat)
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, maxZoom: 16, duration: 600 }
    )
  }

  return (
    <div className="tour-map">
      <div ref={containerRef} className="tour-map-canvas" />
      <div className="tour-map-controls">
        <button type="button" className="tour-map-control" onClick={fitAll} aria-label="Fit all places">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V4a1 1 0 0 1 1-1h3M21 7V4a1 1 0 0 0-1-1h-3M3 17v3a1 1 0 0 0 1 1h3M21 17v3a1 1 0 0 1-1 1h-3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
