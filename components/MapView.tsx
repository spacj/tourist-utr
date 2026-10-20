'use client'
import { useEffect, useRef, useState } from 'react'
import type { Map as MlMap, Marker as MlMarker, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useI18n } from '@/hooks/useI18n'
import type { LatLngRadius } from '@/types'
import { MAP_STYLE_URL, MAP_ATTRIBUTION_CONTROL } from '@/lib/mapStyle'

type MapLib = typeof import('maplibre-gl')

interface Props {
  /** Search zone (always known). Drawn as a circle when `showZone`. */
  zone: LatLngRadius
  showZone: boolean
  /** Exact target — the pin is drawn only when `showPin`. */
  target: LatLngRadius | null
  showPin: boolean
  userLat: number | null
  userLng: number | null
}

/** GeoJSON polygon approximating a circle of radiusM around (lat, lng). */
function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = []
  const dLat = radiusM / 111_320
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI
    coords.push([lng + dLng * Math.sin(a), lat + dLat * Math.cos(a)])
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

/**
 * Game map. maplibre-gl (~800 kB) is loaded lazily, after first paint.
 * Attribution stays visible (compact) — OpenFreeMap/OSM require it.
 */
export function MapView({ zone, showZone, target, showPin, userLat, userLng }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const libRef = useRef<MapLib | null>(null)
  const mapRef = useRef<MlMap | null>(null)
  const userMarkerRef = useRef<MlMarker | null>(null)
  const targetMarkerRef = useRef<MlMarker | null>(null)
  const userInteractedRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [followingUser, setFollowingUser] = useState(true)
  const [failed, setFailed] = useState(false)

  // ── Lazy init ──
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    import('maplibre-gl').then((mod) => {
      if (cancelled || !containerRef.current) return
      const lib = ((mod as any).default ?? mod) as MapLib
      libRef.current = lib
      map = new lib.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [zone.lng, zone.lat],
        zoom: 14.5,
        // Full-screen game map: no cooperativeGestures (one-finger pan is the point).
        attributionControl: MAP_ATTRIBUTION_CONTROL,
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
      map.on('load', () => {
        if (cancelled || !map) return
        map.addSource('search-zone', {
          type: 'geojson',
          data: circlePolygon(zone.lat, zone.lng, zone.radiusM),
        })
        map.addLayer({
          id: 'search-zone-fill', type: 'fill', source: 'search-zone',
          paint: { 'fill-color': '#C2410C', 'fill-opacity': 0.10 },
        })
        map.addLayer({
          id: 'search-zone-line', type: 'line', source: 'search-zone',
          paint: { 'line-color': '#C2410C', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
        })
        setReady(true)
      })
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      userMarkerRef.current = null
      targetMarkerRef.current = null
      map?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Search zone ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('search-zone') as GeoJSONSource | undefined
    src?.setData(circlePolygon(zone.lat, zone.lng, zone.radiusM))
    const vis = showZone ? 'visible' : 'none'
    map.setLayoutProperty('search-zone-fill', 'visibility', vis)
    map.setLayoutProperty('search-zone-line', 'visibility', vis)
    if (showZone && !userInteractedRef.current && userLat === null) {
      map.easeTo({ center: [zone.lng, zone.lat], zoom: 14.5, duration: 600 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zone.lat, zone.lng, zone.radiusM, showZone])

  // ── Target pin ──
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || !ready) return
    if (showPin && target) {
      if (!targetMarkerRef.current) {
        const el = document.createElement('div')
        el.className = 'game-target-pin'
        el.setAttribute('aria-hidden', 'true')
        targetMarkerRef.current = new lib.Marker({ element: el }).setLngLat([target.lng, target.lat]).addTo(map)
      } else {
        targetMarkerRef.current.setLngLat([target.lng, target.lat])
      }
    } else if (targetMarkerRef.current) {
      targetMarkerRef.current.remove()
      targetMarkerRef.current = null
    }
  }, [ready, showPin, target?.lat, target?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Player position ──
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!map || !lib || !ready || userLat === null || userLng === null) return
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'game-user-dot'
      el.setAttribute('aria-hidden', 'true')
      userMarkerRef.current = new lib.Marker({ element: el }).setLngLat([userLng, userLat]).addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }
    if (!userInteractedRef.current) map.easeTo({ center: [userLng, userLat], duration: 800 })
  }, [ready, userLat, userLng])

  const recenter = () => {
    const map = mapRef.current
    if (!map || userLat === null || userLng === null) return
    userInteractedRef.current = false
    setFollowingUser(true)
    map.easeTo({ center: [userLng, userLat], zoom: 15.5, duration: 600 })
  }

  return (
    <div className="game-mapview">
      <div ref={containerRef} className="game-mapview-canvas" />
      {failed && <div className="game-map-failed">{t('mapUnavailable')}</div>}
      {!followingUser && userLat !== null && userLng !== null && (
        <button type="button" onClick={recenter} className="game-map-recenter" aria-label={t('recenterMap')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
      {showZone && !showPin && (
        <div className="game-map-note">{t('mapZoneNote')}</div>
      )}
    </div>
  )
}
