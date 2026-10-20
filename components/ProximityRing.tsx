'use client'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/gameClient'
import { warmthColor, warmthFor, type Navigation, type Warmth } from '@/types'

const SIZE = 160
const CX = SIZE / 2
const CY = SIZE / 2
const R = 64
const C = 2 * Math.PI * R
const WARMTH_ORDER: Warmth[] = ['cold', 'warm', 'hot', 'burning']
const ZONE_FREQ: Record<Warmth, number> = { cold: 440, warm: 660, hot: 880, burning: 1175 }
const DIR_KEYS = ['dirN', 'dirNE', 'dirE', 'dirSE', 'dirS', 'dirSW', 'dirW', 'dirNW']

interface Props {
  mode: Navigation
  /** Compass mode: metres to the target. */
  distanceM: number | null
  /** Compass mode: degrees clockwise from north. */
  bearing: number | null
  /** Warmth band (both modes; derived from distance in compass mode). */
  warmth: Warmth | null
  accuracy: number | null
  /** Device heading, when the compass sensor is on. */
  heading?: number | null
  compact?: boolean
}

// Synthesized chime — no audio files.
function playChime(freq: number, duration = 0.14) {
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

/**
 * Navigation dial. Compass mode: arrow to the target (relative to the phone's
 * heading when known), N marker rotating with the heading, distance readout.
 * Warmth mode: no direction — four bands, the current one lit.
 */
export function ProximityRing({ mode, distanceM, bearing, warmth: warmthProp, accuracy, heading, compact }: Props) {
  const { t } = useI18n()
  const warmth: Warmth | null = mode === 'compass' && distanceM !== null ? warmthFor(distanceM) : warmthProp
  const color = warmthColor(warmth)
  const hasHeading = typeof heading === 'number'
  const arrowDeg = bearing === null ? null : hasHeading ? ((bearing - heading! + 360) % 360) : bearing
  const northDeg = hasHeading ? (360 - heading!) % 360 : 0

  // Warmer → chime + buzz.
  const prevRef = useRef<Warmth | null>(null)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = warmth
    if (!prev || !warmth || prev === warmth) return
    if (WARMTH_ORDER.indexOf(warmth) > WARMTH_ORDER.indexOf(prev)) {
      playChime(ZONE_FREQ[warmth])
      try { (navigator as any).vibrate?.(40) } catch {}
    }
  }, [warmth])

  // Screen-reader announcement of zone changes, at most every 10 s.
  const [announce, setAnnounce] = useState('')
  const lastAnnounce = useRef(0)
  useEffect(() => {
    if (!warmth) return
    const now = Date.now()
    if (now - lastAnnounce.current < 10_000) return
    lastAnnounce.current = now
    setAnnounce(t(`zone_${warmth}`))
  }, [warmth, t])

  const dirLabel = bearing === null ? '' : t(DIR_KEYS[Math.round(bearing / 45) % 8])
  const label = mode === 'compass' && distanceM !== null
    ? fmt(t('ringCompassLabel'), { distance: distanceM, direction: dirLabel })
    : warmth
      ? fmt(t('ringWarmthLabel'), { zone: t(`zone_${warmth}`) })
      : t('locating')

  const fill = mode === 'compass' && distanceM !== null ? Math.max(0.04, 1 - distanceM / 600) : 0
  const showArrow = mode === 'compass' && arrowDeg !== null && distanceM !== null && distanceM > 10

  return (
    <div className={`compass ${warmth === 'burning' ? 'compass-burning' : ''} ${compact ? 'compass-compact' : ''}`}>
      <svg
        className="compass-ring-svg"
        width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img" aria-label={label}
        style={{ overflow: 'visible' }}
      >
        <circle cx={CX} cy={CY} r={R - 2} fill="#fffdf8" stroke="rgba(43,38,30,0.10)" strokeWidth="1" />

        {mode === 'compass' ? (
          <>
            {/* Rotating bezel: ticks + N follow the device heading. */}
            <g transform={`rotate(${northDeg} ${CX} ${CY})`} style={{ transition: 'transform .4s ease' }}>
              {Array.from({ length: 12 }, (_, i) => i * 30).map(deg => {
                const cardinal = deg % 90 === 0
                const r1 = R + 2, r2 = r1 + (cardinal ? 7 : 4)
                const rad = ((deg - 90) * Math.PI) / 180
                return (
                  <line key={deg}
                    x1={CX + r1 * Math.cos(rad)} y1={CY + r1 * Math.sin(rad)}
                    x2={CX + r2 * Math.cos(rad)} y2={CY + r2 * Math.sin(rad)}
                    stroke={cardinal ? '#23201B' : 'rgba(43,38,30,0.32)'}
                    strokeWidth={cardinal ? 1.6 : 1} strokeLinecap="round" />
                )
              })}
              <text x={CX} y={CY - R + 14} textAnchor="middle" fontSize="11" fontWeight="700"
                fill="#A33B2B" fontFamily="system-ui">N</text>
            </g>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(43,38,30,0.08)" strokeWidth="6" />
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${(fill * C).toFixed(1)} ${C.toFixed(1)}`}
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: 'stroke-dasharray 1s ease' }} />
            {showArrow && (
              <g transform={`rotate(${arrowDeg} ${CX} ${CY})`} style={{ transition: 'transform .6s ease' }}>
                <line x1={CX} y1={CY + 8} x2={CX} y2={CY - 30} stroke={color} strokeWidth="3.2" strokeLinecap="round" />
                <polygon points={`${CX},${CY - 42} ${CX - 7},${CY - 28} ${CX + 7},${CY - 28}`} fill={color} />
              </g>
            )}
            <circle cx={CX} cy={CY} r="5" fill="#fff" stroke={color} strokeWidth="2" />
          </>
        ) : (
          // Warmth: concentric bands, outer = cold, inner = burning.
          WARMTH_ORDER.map((w, i) => {
            const active = warmth === w
            const reached = warmth !== null && WARMTH_ORDER.indexOf(warmth) >= i
            return (
              <circle key={w} cx={CX} cy={CY} r={R - 4 - i * 14}
                fill={active ? `${warmthColor(w)}33` : 'none'}
                stroke={warmthColor(w)}
                strokeOpacity={reached ? 0.95 : 0.22}
                strokeWidth={active ? 5 : 3} />
            )
          })
        )}
      </svg>

      <div className="compass-readout" aria-hidden="true">
        {mode === 'compass' && distanceM !== null && (
          <div className="compass-distance" style={{ color }}>
            <span className="compass-distance-num">{distanceM}</span>
            <span className="compass-distance-unit">{t('metresShort')}</span>
          </div>
        )}
        {warmth ? (
          <span className="compass-zone" style={{ color, background: `${color}1a`, borderColor: `${color}55` }}>
            {t(`zone_${warmth}`)}
          </span>
        ) : (
          <span className="compass-zone compass-zone-pending">{t('locating')}</span>
        )}
        {accuracy !== null && !compact && (
          <span className="compass-accuracy">{fmt(t('gpsAccuracy'), { m: accuracy })}</span>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </div>
  )
}

