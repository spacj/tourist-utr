'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { fmt } from '@/lib/i18n/fmt'
import { canSaveOffline, saveAreaOffline, tilesForArea } from '@/lib/offlineMap'
import { Check } from 'lucide-react'

interface Props {
  cityName: string
  /** City-level centre (lib/cityGeo). Never pass stop coordinates. */
  center: { lat: number; lng: number }
  radiusKm?: number
}

type State =
  | { kind: 'idle' }
  | { kind: 'saving'; pct: number }
  | { kind: 'done' }
  | { kind: 'error' }

const STORE_KEY = 'th-map-saved'

function savedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')) } catch { return new Set() }
}

/** Rough download size: ~60 kB per vector tile (z12–14) + ~1 MB of glyphs/sprites. */
function estimateMb(lat: number, lng: number, radiusKm: number): number {
  let tiles = 0
  for (let z = 12; z <= 14; z++) tiles += tilesForArea(lat, lng, radiusKm, z).length
  return Math.max(1, Math.round(tiles * 0.06 + 1))
}

/**
 * "Save {city} map for offline" — caches the city-centre basemap through the
 * service worker so the game map still draws with patchy data. Renders
 * nothing when no service worker controls the page (dev, unsupported).
 */
export function SaveMapOffline({ cityName, center, radiusKm = 2.5 }: Props) {
  const { t } = useI18n()
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<State>({ kind: 'idle' })
  const key = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`

  useEffect(() => {
    setSupported(canSaveOffline())
    if (savedSet().has(key)) setState({ kind: 'done' })
  }, [key])

  if (!supported) return null

  const save = async () => {
    if (state.kind === 'saving') return
    setState({ kind: 'saving', pct: 0 })
    try {
      const res = await saveAreaOffline(
        { lat: center.lat, lng: center.lng, radiusKm },
        p => setState({ kind: 'saving', pct: p.total ? Math.round((p.done / p.total) * 100) : 0 }),
      )
      // A few misses (e.g. an empty sea tile) are fine; mostly-failed is not.
      if (res.total === 0 || res.failed > res.total * 0.2) throw new Error('incomplete')
      const s = savedSet(); s.add(key)
      try { localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(s))) } catch {}
      setState({ kind: 'done' })
    } catch {
      setState({ kind: 'error' })
    }
  }

  const label = state.kind === 'saving'
    ? fmt(t('saveMapSaving'), { pct: state.pct })
    : fmt(t('saveMapOffline'), { city: cityName })

  return (
    <div className={`save-map-offline is-${state.kind}`}>
      {state.kind === 'done' ? (
        <p className="save-map-offline-done" role="status">
          <Check size={16} strokeWidth={2.6} aria-hidden /> {t('saveMapDone')}
        </p>
      ) : (
        <>
          <button
            type="button"
            className="save-map-offline-btn"
            onClick={save}
            disabled={state.kind === 'saving'}
            aria-busy={state.kind === 'saving'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
            <span>{label}</span>
          </button>
          {state.kind === 'saving' && (
            <span className="save-map-offline-bar" aria-hidden>
              <span style={{ width: `${state.pct}%` }} />
            </span>
          )}
          <p className="save-map-offline-hint" role={state.kind === 'error' ? 'alert' : undefined}>
            {state.kind === 'error'
              ? t('saveMapFailed')
              : fmt(t('saveMapHint'), { mb: estimateMb(center.lat, center.lng, radiusKm) })}
          </p>
        </>
      )}
    </div>
  )
}
