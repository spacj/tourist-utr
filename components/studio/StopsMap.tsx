'use client'
import { useEffect, useRef } from 'react'
import type { Map as MlMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE_URL, MAP_ATTRIBUTION_CONTROL } from '@/lib/mapStyle'

type MapLib = typeof import('maplibre-gl')

export interface MapStop { id: string; n: number; lat: number | null; lng: number | null; radiusM?: number }

/**
 * Map of a hunt's stops for the creator studio and the admin review.
 * Numbered pins; with `onPick`, clicking the map (or dragging the selected
 * pin) sets the selected stop's location.
 */
export function StopsMap({
  center, stops, selectedId = null, onPick, className = 'studio-map', label = 'Map of the stops',
}: {
  center: { lat: number; lng: number }
  stops: MapStop[]
  selectedId?: string | null
  onPick?: (lat: number, lng: number) => void
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const libRef = useRef<MapLib | null>(null)
  const markersRef = useRef<Marker[]>([])
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const fittedRef = useRef(false)

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    import('maplibre-gl').then(mod => {
      if (cancelled || !ref.current) return
      const lib = ((mod as any).default ?? mod) as MapLib
      libRef.current = lib
      const m = new lib.Map({
        container: ref.current,
        style: MAP_STYLE_URL,
        center: [center.lng, center.lat],
        zoom: 14,
        attributionControl: MAP_ATTRIBUTION_CONTROL,
        dragRotate: false,
        pitchWithRotate: false,
      })
      m.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right')
      m.on('click', e => pickRef.current?.(Math.round(e.lngLat.lat * 1e6) / 1e6, Math.round(e.lngLat.lng * 1e6) / 1e6))
      mapRef.current = m
      m.on('load', () => { if (!cancelled) m.fire('stops:refresh') })
    }).catch(() => {})
    return () => {
      cancelled = true
      markersRef.current.forEach(mk => mk.remove())
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw pins whenever the stops or the selection change.
  useEffect(() => {
    const draw = () => {
      const m = mapRef.current
      const lib = libRef.current
      if (!m || !lib) return
      markersRef.current.forEach(mk => mk.remove())
      markersRef.current = []
      const placed = stops.filter(s => s.lat !== null && s.lng !== null)
      for (const s of placed) {
        const el = document.createElement('div')
        el.className = `studio-pin${s.id === selectedId ? ' is-selected' : ''}`
        el.textContent = String(s.n)
        const draggable = !!onPick && s.id === selectedId
        const mk = new lib.Marker({ element: el, draggable }).setLngLat([s.lng!, s.lat!]).addTo(m)
        if (draggable) {
          mk.on('dragend', () => {
            const p = mk.getLngLat()
            pickRef.current?.(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6)
          })
        }
        markersRef.current.push(mk)
      }
      if (!fittedRef.current && placed.length) {
        fittedRef.current = true
        const b = new lib.LngLatBounds()
        placed.forEach(s => b.extend([s.lng!, s.lat!]))
        m.fitBounds(b, { padding: 50, maxZoom: 16, duration: 0 })
      }
    }
    draw()
    const m = mapRef.current
    m?.on('stops:refresh', draw)
    return () => { m?.off('stops:refresh', draw) }
  }, [stops, selectedId, onPick])

  return <div ref={ref} className={className} role="img" aria-label={label} />
}
