'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Place, PlaceCategory } from '@/lib/md'

interface Props {
  places: Place[]
  categories: PlaceCategory[]
  selectedId: string | null
  onSelect: (placeId: string) => void
  userLat: number | null
  userLng: number | null
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
  places, categories, selectedId, onSelect, userLat, userLng,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map>()
  const userMarkerRef = useRef<maplibregl.Marker>()
  const placeMarkersRef = useRef<Map<string, { marker: maplibregl.Marker; inner: HTMLDivElement }>>(new Map())
  const [mapReady, setMapReady] = useState(false)

  // ── Initialize map once, fit it to all places ─────────────────────
  useEffect(() => {
    if (!containerRef.current || places.length === 0) return

    const lngs = places.map(p => p.lng)
    const lats = places.map(p => p.lat)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      bounds,
      fitBoundsOptions: { padding: 80, maxZoom: 16 },
      attributionControl: false,
    })
    mapRef.current = map
    map.on('load', () => setMapReady(true))

    return () => {
      placeMarkersRef.current.forEach(({ marker }) => marker.remove())
      placeMarkersRef.current.clear()
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = undefined
      }
      map.remove()
      mapRef.current = undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build a quick id→category lookup for icon + color
  const catById = new Map<string, PlaceCategory>()
  for (const c of categories) catById.set(c.id, c)
  const fallback = categories[0] ?? { id: '', label: '', icon: '📍', color: '#6366f1' }

  // ── Render / update place markers ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

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
        const marker = new maplibregl.Marker({ element: root, anchor: 'center' })
          .setLngLat([place.lng, place.lat])
          .addTo(map)
        entry = { marker, inner }
        placeMarkersRef.current.set(place.id, entry)
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
    if (!map || userLat === null || userLng === null) return
    if (!userMarkerRef.current) {
      const root = document.createElement('div')
      root.className = 'tour-user-marker'
      const inner = document.createElement('div')
      inner.className = 'tour-user-marker-inner'
      root.appendChild(inner)
      userMarkerRef.current = new maplibregl.Marker({ element: root })
        .setLngLat([userLng, userLat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }
  }, [userLat, userLng])

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
