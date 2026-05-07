'use client'
import { useEffect, useRef, useState } from 'react'
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
  // Once the user manually pans/zooms, we stop auto-recentering on every GPS tick.
  // They can tap the recenter button to opt back in.
  const userInteractedRef = useRef(false)
  const [followingUser, setFollowingUser] = useState(true)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [clue.lng, clue.lat],
      zoom: 14.5,
      attributionControl: false,
    })
    mapRef.current = map

    // Detect user-driven movement: dragstart, zoomstart with originalEvent (vs programmatic).
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

    // Only auto-recenter while the user hasn't pinched/dragged the map.
    if (!userInteractedRef.current) {
      map.easeTo({ center: [userLng, userLat], duration: 800 })
    }
  }, [userLat, userLng])

  const recenter = () => {
    const map = mapRef.current
    if (!map || userLat === null || userLng === null) return
    userInteractedRef.current = false
    setFollowingUser(true)
    map.easeTo({ center: [userLng, userLat], zoom: 15.5, duration: 600 })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!followingUser && userLat !== null && userLng !== null && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter on my location"
          style={{
            position: 'absolute',
            right: 12,
            bottom: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: '#fff',
            color: '#378ADD',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      )}
      {!showTarget && (
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,.92)', border: '1px solid rgba(20,20,30,.10)',
          color: 'rgba(20,20,30,.7)', fontSize: 12, padding: '5px 14px',
          borderRadius: 20, pointerEvents: 'none', whiteSpace: 'nowrap',
          backdropFilter: 'blur(6px)',
        }}>
          Use "Show on map" hint to reveal the pin
        </div>
      )}
    </div>
  )
}
