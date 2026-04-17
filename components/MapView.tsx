// components/MapView.tsx
'use client'
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Clue } from '@/types'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface Props {
  clue: Clue
  userLat: number | null
  userLng: number | null
  showTarget: boolean   // true when hint 2 or 3 is unlocked
}

export function MapView({ clue, userLat, userLng, showTarget }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map>()
  const userMarkerRef = useRef<mapboxgl.Marker>()
  const targetMarkerRef = useRef<mapboxgl.Marker>()

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [clue.lng, clue.lat],
      zoom: 14.5,
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = undefined }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show / hide target pin when hint unlocked
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (showTarget && !targetMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'target-marker'
      el.style.cssText = `
        width:20px;height:20px;border-radius:50%;
        background:#6c63f5;border:3px solid #fff;
        box-shadow:0 0 0 4px rgba(108,99,245,.35);
      `
      targetMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([clue.lng, clue.lat])
        .addTo(map)
    } else if (!showTarget && targetMarkerRef.current) {
      targetMarkerRef.current.remove()
      targetMarkerRef.current = undefined
    }
  }, [showTarget, clue.lat, clue.lng])

  // Move user dot
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
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
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
          Unlock hint 2 to reveal the pin
        </div>
      )}
    </div>
  )
}
