'use client'
import { useEffect, useRef } from 'react'
import { getProximityZone, getProximityKey, ProximityZoneKey } from '@/types'

const R = 52
const C = 2 * Math.PI * R

interface Props {
  distanceM: number | null
  bearing: number
  arrived: boolean
  accuracy: number | null
}

// Synthesized chime — no audio files, no bandwidth cost
function playChime(freq = 880, duration = 0.14) {
  if (typeof window === 'undefined') return
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
    setTimeout(() => ctx.close?.(), (duration + 0.1) * 1000)
  } catch {}
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { (navigator as any).vibrate(pattern) } catch {}
  }
}

// Map zone → chime frequency (colder = lower, hotter = higher)
const ZONE_FREQ: Record<ProximityZoneKey, number> = {
  cold:    440,
  cool:    587,
  warm:    740,
  hot:     880,
  burning: 1175,
}

export function ProximityRing({ distanceM, bearing, arrived, accuracy }: Props) {
  const MAX  = 400
  const fill = distanceM === null ? 0 : Math.max(0, 1 - distanceM / MAX)
  const dash = (fill * C).toFixed(1)

  const needleX = 65 + 40 * Math.sin((bearing * Math.PI) / 180)
  const needleY = 65 - 40 * Math.cos((bearing * Math.PI) / 180)

  const zone    = getProximityZone(distanceM)
  const zoneKey = getProximityKey(distanceM)
  const prevZoneRef = useRef<ProximityZoneKey | null>(null)

  // audio + haptic feedback when crossing into a warmer zone
  useEffect(() => {
    if (arrived) return
    if (!zoneKey) return
    const prev = prevZoneRef.current
    prevZoneRef.current = zoneKey
    if (!prev || prev === zoneKey) return
    const order: ProximityZoneKey[] = ['cold', 'cool', 'warm', 'hot', 'burning']
    if (order.indexOf(zoneKey) > order.indexOf(prev)) {
      playChime(ZONE_FREQ[zoneKey])
      vibrate(40)
    }
  }, [zoneKey, arrived])

  // celebration on arrival
  useEffect(() => {
    if (!arrived) return
    playChime(660, 0.18)
    setTimeout(() => playChime(880, 0.18), 140)
    setTimeout(() => playChime(1175, 0.3), 280)
    vibrate([60, 40, 60, 40, 120])
  }, [arrived])

  const ringColor = arrived
    ? '#22c97a'
    : (zone?.color ?? '#6c63f5')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width="140" height="140" viewBox="0 0 130 130" style={{ overflow: 'visible' }}>
        {/* Outer ring glow */}
        {zone && !arrived && (
          <circle cx="65" cy="65" r={R + 5} fill="none"
            stroke={ringColor} strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.3"
            style={{ transition: 'stroke .4s' }}
          />
        )}
        {/* Track */}
        <circle cx="65" cy="65" r={R} fill="none"
          stroke="rgba(255,255,255,.06)" strokeWidth="9" />
        {/* Fill arc */}
        <circle cx="65" cy="65" r={R} fill="none"
          stroke={ringColor}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C.toFixed(1)}`}
          transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke .4s' }}
        />
        {/* Compass arrow needle */}
        {!arrived && distanceM !== null && distanceM > 15 && (
          <g style={{ transition: 'transform .9s ease' }}
             transform={`rotate(${bearing} 65 65)`}>
            {/* arrow shaft */}
            <line x1="65" y1="65" x2="65" y2="30"
              stroke={ringColor} strokeWidth="3" strokeLinecap="round" />
            {/* arrowhead */}
            <polygon points="65,22 59,32 71,32" fill={ringColor} />
            {/* tail dot */}
            <circle cx="65" cy="65" r="3" fill={ringColor} />
          </g>
        )}
        {/* Centre text — only checkmark when arrived, or distance when no arrow */}
        {arrived && (
          <>
            <text x="65" y="61" textAnchor="middle" fontSize="28"
              fill="#22c97a" fontFamily="system-ui" fontWeight="600">✓</text>
            <text x="65" y="79" textAnchor="middle" fontSize="11"
              fill="#22c97a" fontFamily="system-ui">arrived!</text>
          </>
        )}
        {!arrived && distanceM !== null && distanceM <= 15 && (
          <>
            <text x="65" y="60" textAnchor="middle" fontSize="22"
              fill="#eeedf8" fontFamily="system-ui" fontWeight="600">
              {distanceM}
            </text>
            <text x="65" y="77" textAnchor="middle" fontSize="11"
              fill="#8b8aaa" fontFamily="system-ui">
              metres
            </text>
          </>
        )}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {!arrived && distanceM !== null && distanceM > 15 && (
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-serif, Georgia), serif', color: ringColor, lineHeight: 1 }}>
            {distanceM}m
          </div>
        )}
        {zone && !arrived && (
          <span className="zone-label" style={{ color: zone.color }}>
            {zone.label}
          </span>
        )}
        {accuracy !== null && !arrived && (
          <span style={{ fontSize: 10, color: '#56556a' }}>GPS ±{accuracy}m</span>
        )}
      </div>
    </div>
  )
}
