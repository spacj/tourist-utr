'use client'
import { useEffect, useRef, useState } from 'react'
import type { Map as MlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE_URL, MAP_ATTRIBUTION_CONTROL } from '@/lib/mapStyle'

type MapLib = typeof import('maplibre-gl')

/**
 * Small embedded map, loaded only when it scrolls into view;
 * cooperativeGestures keeps one-finger page scrolling working.
 *  - hunt pages: a broad dashed circle around the city centre (spoiler-free);
 *  - bench/fountain pages: a pin on the exact spot (`pin`, `radiusM={null}`).
 */
export function AreaMap({
  lat, lng, label, radiusM = 1200, pin = false, zoom = 13, className = 'landing-map',
}: {
  lat: number; lng: number; label: string
  radiusM?: number | null; pin?: boolean; zoom?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !ref.current) return
    let cancelled = false
    let map: MlMap | null = null
    import('maplibre-gl').then(mod => {
      if (cancelled || !ref.current) return
      const lib = ((mod as any).default ?? mod) as MapLib
      const m = new lib.Map({
        container: ref.current,
        style: MAP_STYLE_URL,
        center: [lng, lat],
        zoom,
        attributionControl: MAP_ATTRIBUTION_CONTROL,
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      })
      map = m
      if (pin) new lib.Marker({ color: '#A33B2B' }).setLngLat([lng, lat]).addTo(m)
      m.on('load', () => {
        if (cancelled || !radiusM) return
        const steps = 64
        const dLat = radiusM / 111_320
        const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
        const coords: [number, number][] = []
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * 2 * Math.PI
          coords.push([lng + dLng * Math.sin(a), lat + dLat * Math.cos(a)])
        }
        m.addSource('area', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } },
        })
        m.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#2E6A58', 'fill-opacity': 0.08 } })
        m.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#2E6A58', 'line-width': 2, 'line-dasharray': [2, 2] } })
      })
    }).catch(() => {})
    return () => { cancelled = true; map?.remove() }
  }, [visible, lat, lng, radiusM, pin, zoom])

  return <div ref={ref} className={className} role="img" aria-label={label} />
}
