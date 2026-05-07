'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Clue } from '@/types'

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

const ROUTE_SOURCE_ID = 'tour-route'
const ROUTE_LAYER_ID = 'tour-route-line'

function buildMarkerEl(opts: {
  number: number
  visited: boolean
  selected: boolean
  accentColor: string
}): HTMLDivElement {
  const { number, visited, selected, accentColor } = opts
  const el = document.createElement('div')
  el.setAttribute('aria-label', `Stop ${number}`)
  // The colored circle
  const fill = visited ? '#22c97a' : accentColor
  const ring = selected ? '0 0 0 5px rgba(255,106,19,0.32)' : '0 2px 8px rgba(0,0,0,0.25)'
  el.style.cssText = `
    width: 32px; height: 32px;
    border-radius: 50%;
    background: ${fill};
    border: 2px solid #fff;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: ${ring};
    transition: transform 0.15s ease, box-shadow 0.2s ease;
    font-family: system-ui, -apple-system, sans-serif;
  `
  el.textContent = visited ? '✓' : String(number)
  if (selected) el.style.transform = 'scale(1.18)'
  return el
}

export function TourMapView({
  clues, visited, selectedId, onSelect, userLat, userLng, accentColor = '#ff6a13',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map>()
  const userMarkerRef = useRef<maplibregl.Marker>()
  const stopMarkersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map())
  const userInteractedRef = useRef(false)
  const [followingUser, setFollowingUser] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // ── Initialize map once, fit it to all stops ───────────────────────
  useEffect(() => {
    if (!containerRef.current || clues.length === 0) return

    const lngs = clues.map(c => c.lng)
    const lats = clues.map(c => c.lat)
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ]

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      bounds,
      fitBoundsOptions: { padding: 56, maxZoom: 16 },
      attributionControl: false,
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
      // Route polyline through all stops in order
      const coordinates = clues.map(c => [c.lng, c.lat] as [number, number])
      map.addSource(ROUTE_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        },
      })
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: 'line',
        source: ROUTE_SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': accentColor,
          'line-width': 4,
          'line-opacity': 0.55,
          'line-dasharray': [1.5, 1.5],
        },
      })
      setMapReady(true)
    })

    return () => {
      stopMarkersRef.current.forEach(({ marker }) => marker.remove())
      stopMarkersRef.current.clear()
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = undefined
      }
      map.remove()
      mapRef.current = undefined
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render / update stop markers when state changes ───────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const seen = new Set<string>()
    clues.forEach(clue => {
      seen.add(clue.id)
      const isVisited = visited.has(clue.id)
      const isSelected = selectedId === clue.id
      const newEl = buildMarkerEl({
        number: clue.order,
        visited: isVisited,
        selected: isSelected,
        accentColor,
      })
      newEl.addEventListener('click', () => onSelect(clue.id))

      const existing = stopMarkersRef.current.get(clue.id)
      if (existing) {
        // Re-style by replacing the element's innerHTML / styles in place
        existing.el.style.cssText = newEl.style.cssText
        existing.el.textContent = newEl.textContent
        // Replace the click handler — easiest is to clone and swap
      } else {
        const marker = new maplibregl.Marker({ element: newEl, anchor: 'center' })
          .setLngLat([clue.lng, clue.lat])
          .addTo(map)
        stopMarkersRef.current.set(clue.id, { marker, el: newEl })
      }
    })

    // Remove markers for clues no longer present
    stopMarkersRef.current.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove()
        stopMarkersRef.current.delete(id)
      }
    })
  }, [clues, visited, selectedId, mapReady, accentColor, onSelect])

  // ── User position marker + auto-follow until they pan ─────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || userLat === null || userLng === null) return

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 14px; height: 14px;
        border-radius: 50%;
        background: #378ADD;
        border: 2px solid #fff;
        box-shadow: 0 0 0 5px rgba(55,138,221,0.25);
      `
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLng, userLat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }

    if (followingUser) {
      map.easeTo({ center: [userLng, userLat], duration: 600 })
    }
  }, [userLat, userLng, followingUser])

  // ── Pan/zoom to selected stop when it changes (programmatic move) ─
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const clue = clues.find(c => c.id === selectedId)
    if (!clue) return
    map.easeTo({ center: [clue.lng, clue.lat], zoom: Math.max(map.getZoom(), 15.5), duration: 600 })
  }, [selectedId, clues])

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
      { padding: 56, maxZoom: 16, duration: 600 }
    )
  }

  return (
    <div className="tour-map">
      <div ref={containerRef} className="tour-map-canvas" />
      <div className="tour-map-controls">
        <button type="button" className="tour-map-control" onClick={fitAll} aria-label="Fit all stops">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V4a1 1 0 0 1 1-1h3M21 7V4a1 1 0 0 0-1-1h-3M3 17v3a1 1 0 0 0 1 1h3M21 17v3a1 1 0 0 1-1 1h-3" />
          </svg>
        </button>
        {userLat !== null && userLng !== null && (
          <button
            type="button"
            className={`tour-map-control ${followingUser ? 'is-active' : ''}`}
            onClick={recenterOnUser}
            aria-label="Center on my location"
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
