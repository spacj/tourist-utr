'use client'
import { useEffect, useRef } from 'react'
import { getProximityZone, getProximityKey, ProximityZoneKey } from '@/types'

const SIZE = 160
const CX = SIZE / 2
const CY = SIZE / 2
const R = 64
const C = 2 * Math.PI * R

interface Props {
  distanceM: number | null
  bearing: number
  arrived: boolean
  accuracy: number | null
  heading?: number | null
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

const ZONE_FREQ: Record<ProximityZoneKey, number> = {
  cold:    440,
  cool:    587,
  warm:    740,
  hot:     880,
  burning: 1175,
}

// 12 tick marks (every 30°). Cardinals are longer / labeled.
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30)

export function ProximityRing({ distanceM, bearing, arrived, accuracy, heading }: Props) {
  const MAX  = 400
  const fill = distanceM === null ? 0 : Math.max(0, 1 - distanceM / MAX)
  const dash = (fill * C).toFixed(1)

  const zone    = getProximityZone(distanceM)
  const zoneKey = getProximityKey(distanceM)
  const prevZoneRef = useRef<ProximityZoneKey | null>(null)

  const adjustedBearing = heading !== null && heading !== undefined
    ? ((bearing - heading) + 360) % 360
    : bearing

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

  const ringColor = arrived ? '#22c97a' : (zone?.color ?? '#ff6a13')
  const burning = !arrived && zoneKey === 'burning'
  const showCenterDistance = arrived || (distanceM !== null && distanceM <= 15)

  return (
    <div className={`compass ${burning ? 'compass-burning' : ''} ${arrived ? 'compass-arrived' : ''}`}>
      <svg className="compass-ring-svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor={ringColor} stopOpacity="0.55" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="1" />
          </linearGradient>
          <radialGradient id="ring-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff4e8" stopOpacity="1" />
          </radialGradient>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Outer halo glow (color-pulses on burning zone) */}
        {!arrived && zone && (
          <circle cx={CX} cy={CY} r={R + 8} fill="none"
            stroke={ringColor}
            strokeWidth="2"
            opacity="0.18"
            filter="url(#soft-glow)"
            className="compass-halo"
          />
        )}

        {/* Bezel face */}
        <circle cx={CX} cy={CY} r={R - 2} fill="url(#ring-bg)"
          stroke="rgba(20,20,30,0.06)" strokeWidth="1" />

        {/* Tick marks (cardinal & intercardinal) */}
        {TICKS.map(deg => {
          const isCardinal = deg % 90 === 0
          const len = isCardinal ? 7 : 4
          const r1 = R + 2
          const r2 = r1 + len
          const rad = ((deg - 90) * Math.PI) / 180
          const x1 = CX + r1 * Math.cos(rad)
          const y1 = CY + r1 * Math.sin(rad)
          const x2 = CX + r2 * Math.cos(rad)
          const y2 = CY + r2 * Math.sin(rad)
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isCardinal ? '#1a1a25' : 'rgba(20,20,30,0.32)'}
              strokeWidth={isCardinal ? 1.6 : 1}
              strokeLinecap="round" />
          )
        })}

        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="rgba(20,20,30,0.08)" strokeWidth="6" />

        {/* Fill arc */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C.toFixed(1)}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)' }}
        />

        {/* Bearing arrow (rotates with bearing, adjusted for device heading) */}
        {!arrived && distanceM !== null && distanceM > 15 && (
          <g style={{ transition: 'transform .9s ease' }}
             transform={`rotate(${adjustedBearing} ${CX} ${CY})`}>
            {/* Arrow shaft */}
            <line x1={CX} y1={CY + 8} x2={CX} y2={CY - 32}
              stroke={ringColor} strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
            {/* Arrow head */}
            <polygon points={`${CX},${CY - 42} ${CX - 7},${CY - 28} ${CX + 7},${CY - 28}`}
              fill={ringColor} />
            {/* Tail */}
            <circle cx={CX} cy={CY + 12} r="3" fill={ringColor} opacity="0.5" />
          </g>
        )}

        {/* Centre hub + N */}
        {!arrived && distanceM !== null && distanceM > 15 && (
          <>
            <circle cx={CX} cy={CY} r="6" fill="#fff" stroke={ringColor} strokeWidth="2" />
            <text x={CX} y={CY - 18} textAnchor="middle" fontSize="10"
              fill="rgba(20,20,30,0.55)" fontFamily="system-ui" fontWeight="700"
              letterSpacing="0.06em">N</text>
          </>
        )}

        {/* Centre — arrived state */}
        {arrived && (
          <>
            <circle cx={CX} cy={CY} r="22" fill="rgba(34,201,122,0.12)" />
            <text x={CX} y={CY + 4} textAnchor="middle" fontSize="32"
              fill="#22c97a" fontFamily="system-ui" fontWeight="600">✓</text>
            <text x={CX} y={CY + 24} textAnchor="middle" fontSize="11"
              fill="#22c97a" fontFamily="system-ui" fontWeight="600"
              letterSpacing="0.08em">ARRIVED</text>
          </>
        )}

        {/* Centre — close-range readout (≤15 m) */}
        {!arrived && distanceM !== null && distanceM <= 15 && (
          <>
            <circle cx={CX} cy={CY} r="26" fill={`${ringColor}22`} />
            <text x={CX} y={CY + 4} textAnchor="middle" fontSize="28"
              fill={ringColor} fontFamily="system-ui" fontWeight="700">
              {distanceM}
            </text>
            <text x={CX} y={CY + 22} textAnchor="middle" fontSize="10"
              fill={ringColor} fontFamily="system-ui" fontWeight="600"
              letterSpacing="0.1em">METRES</text>
          </>
        )}
      </svg>

      {/* Below ring — distance, zone, accuracy */}
      <div className="compass-readout">
        {!arrived && distanceM !== null && distanceM > 15 && (
          <div className="compass-distance" style={{ color: ringColor }}>
            <span className="compass-distance-num">{distanceM}</span>
            <span className="compass-distance-unit">m</span>
          </div>
        )}
        {zone && !arrived && (
          <span className="compass-zone" style={{ color: zone.color, background: `${zone.color}1f`, borderColor: `${zone.color}40` }}>
            {zone.label}
          </span>
        )}
        {accuracy !== null && !arrived && (
          <span className="compass-accuracy">GPS ±{accuracy}m</span>
        )}
      </div>
    </div>
  )
}
