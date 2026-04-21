'use client'
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Clue } from '@/types'

interface Props {
  clue: Clue
  userLat: number | null
  userLng: number | null
  showTarget: boolean
}

export function MapView({ clue, userLat, userLng, showTarget }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map>()
  const userMarkerRef = useRef<maplibregl.Marker>()
  const targetMarkerRef = useRef<maplibregl.Marker>()

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [clue.lng, clue.lat],
      zoom: 14.5,
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = undefined }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (showTarget && !targetMarkerRef.current) {
      const el = document.createElement('div')
      el.style.cssText = `
        width:20px;height:20px;border-radius:50%;
        background:#6c63f5;border:3px solid #fff;
        box-shadow:0 0 0 4px rgba(108,99,245,.35);
      `
      targetMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([clue.lng, clue.lat])
        .addTo(map)
    } else if (!showTarget && targetMarkerRef.current) {
      targetMarkerRef.current.remove()
      targetMarkerRef.current = undefined
    }
  }, [showTarget, clue.lat, clue.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || userLat === null || userLng === null) return

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.style.cssText = `
        width:14px;height:14px;border-radius:50%;
        background:#378ADD;border:2px solid #fff;
        box-shadow:0 0 0 5px rgba(55,138,221,.25);
      `
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLng, userLat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLng, userLat])
    }

    map.easeTo({ center: [userLng, userLat], duration: 800 })
  }, [userLat, userLng])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!showTarget && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(12,12,20,.82)', border: '1px solid rgba(255,255,255,.1)',
          color: 'rgba(255,255,255,.7)', fontSize: 12, padding: '5px 14px',
          borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap',
          backdropFilter: 'blur(6px)',
        }}>
          Use "Show on map" hint to reveal the pin
        </div>
      )}
    </div>
  )
}
