'use client'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight, Compass, Landmark, MapPin, Moon, ShoppingBag,
  Users, UtensilsCrossed, type LucideProps,
} from 'lucide-react'
import { Clue, Hunt, localizeClue, localizeHunt, TourCategory } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { haversineM } from '@/lib/geo'
import { TourMapView } from '@/components/TourMapView'
import { useGPS } from '@/hooks/useGPS'
import { useToast } from '@/components/Toast'
import { apiPost, ApiError } from '@/lib/apiFetch'
import { enqueue } from '@/lib/offlineQueue'
import { errorKey, fmt, isNetworkFailure } from '@/lib/gameClient'

interface Props {
  hunt: Hunt
  clues: Clue[]
  sessionId: string
  cityId: string | null
  initiallyArrivedIds: string[]
}

// Notebook inks (all ≥ 4.5:1 against white text and on paper).
const TOUR_CATEGORY_META: Record<TourCategory, { Icon: ComponentType<LucideProps>; color: string }> = {
  nightlife: { Icon: Moon,            color: '#3B4A6B' },
  food:      { Icon: UtensilsCrossed, color: '#A33B2B' },
  shopping:  { Icon: ShoppingBag,     color: '#7A5417' },
  culture:   { Icon: Landmark,        color: '#2E6A58' },
  family:    { Icon: Users,           color: '#7A3E62' },
  general:   { Icon: Compass,         color: '#23201B' },
}

const NEARBY_M = 60

/** Walking tours: self-guided stops, no puzzles and no points. */
export function TourClient({ hunt: rawHunt, clues: rawClues, sessionId, cityId, initiallyArrivedIds }: Props) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const hunt = localizeHunt(rawHunt, lang)
  const clues = useMemo(
    () => rawClues.map(c => localizeClue(c, lang)).sort((a, b) => a.order - b.order),
    [rawClues, lang]
  )

  const [arrived, setArrived] = useState<Set<string>>(new Set(initiallyArrivedIds))
  const { fix, error: gpsError, retry: retryGps } = useGPS(true)
  const userPos = fix ? { lat: fix.lat, lng: fix.lng } : null
  const [openClueId, setOpenClueId] = useState<string | null>(clues[0]?.id ?? null)
  const [marking, setMarking] = useState<string | null>(null)
  // 'card' = collapsed sheet showing just the selected stop; 'list' = full
  // expandable list of all stops with details
  const [sheetMode, setSheetMode] = useState<'card' | 'list'>('card')
  const stopRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // Wake lock so the screen doesn't sleep mid-tour.
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    let lock: any = null
    const acquire = async () => {
      try {
        const wl = (navigator as any).wakeLock
        if (wl) lock = await wl.request('screen')
      } catch {}
    }
    acquire()
    const onVis = () => { if (document.visibilityState === 'visible' && !lock) acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release?.() } catch {}
    }
  }, [])

  const markVisited = async (clueId: string) => {
    if (arrived.has(clueId) || marking) return
    setMarking(clueId)
    // Optimistic local update; server confirms via /api/verify-location at clue.lat/lng.
    const clue = clues.find(c => c.id === clueId)
    if (!clue) { setMarking(null); return }
    setArrived(prev => new Set(prev).add(clueId))
    const body = { sessionId, clueId, lat: clue.lat, lng: clue.lng, at: Date.now() }
    try {
      await apiPost('/api/verify-location', body)
    } catch (e) {
      if (e instanceof ApiError) {
        // Server refused — undo the optimistic tick.
        setArrived(prev => { const n = new Set(prev); n.delete(clueId); return n })
        toast.error(t(errorKey(e.code)))
      } else if (isNetworkFailure(e)) {
        // Offline: keep the tick and replay later.
        await enqueue({ url: '/api/verify-location', body, reconcileKey: `verify:${sessionId}:${clueId}` })
      }
    } finally {
      setMarking(null)
      // Auto-open the next un-visited stop
      const idx = clues.findIndex(c => c.id === clueId)
      const next = clues.slice(idx + 1).find(c => !arrived.has(c.id))
      if (next) setOpenClueId(next.id)
    }
  }

  const cat: TourCategory = (rawHunt.tourCategory ?? 'general') as TourCategory
  const catMeta = TOUR_CATEGORY_META[cat]
  const completedCount = arrived.size
  const allDone = completedCount >= clues.length

  const focusOnMap = (clueId: string) => {
    setOpenClueId(clueId)
    setSheetMode('card')
  }

  const onMarkerSelect = (clueId: string) => {
    setOpenClueId(clueId)
    // Tapping a marker collapses the list to a card view focused on that stop.
    setSheetMode('card')
    const el = stopRefs.current.get(clueId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const selectedClue = clues.find(c => c.id === openClueId) ?? clues[0] ?? null
  const selectedDistance = selectedClue && userPos
    ? Math.round(haversineM(userPos.lat, userPos.lng, selectedClue.lat, selectedClue.lng))
    : null
  const selectedNearby = selectedDistance !== null && selectedDistance <= NEARBY_M
  const selectedVisited = selectedClue ? arrived.has(selectedClue.id) : false

  return (
    <div className={`tour-fullscreen sheet-${sheetMode}`}>
      {/* Floating top bar */}
      <header className="tour-topbar">
        <a href={cityId ? `/city/${cityId}` : '/'} className="tour-topbar-back" aria-label={t('exitTour')}>
          <ArrowLeft size={20} strokeWidth={2} aria-hidden />
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">
            <catMeta.Icon size={16} strokeWidth={1.75} aria-hidden />
            {cat === 'general' ? t('tourLabel') : t(`cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}`)}
          </div>
          <div className="tour-topbar-title">{hunt.title}</div>
        </div>
        <div className="tour-topbar-progress" aria-label={fmt(t('tourProgressLabel'), { n: completedCount, total: clues.length })}>
          <div className="tour-topbar-progress-num">{completedCount}/{clues.length}</div>
          <div className="tour-topbar-progress-bar">
            <div
              className="tour-topbar-progress-fill"
              style={{
                width: `${clues.length ? (completedCount / clues.length) * 100 : 0}%`,
                background: catMeta.color,
              }}
            />
          </div>
        </div>
      </header>

      {/* Full-screen map */}
      <div className="tour-fullmap">
        <TourMapView
          clues={clues}
          visited={arrived}
          selectedId={openClueId}
          onSelect={onMarkerSelect}
          userLat={userPos?.lat ?? null}
          userLng={userPos?.lng ?? null}
          accentColor={catMeta.color}
        />
      </div>

      {gpsError && (
        <div className="tour-gps-error" role="alert">
          <span>{t(gpsError === 'denied' ? 'gpsDeniedTitle' : gpsError === 'unsupported' ? 'gpsUnsupported' : gpsError === 'timeout' ? 'gpsTimeout' : 'gpsUnavailable')}</span>
          {gpsError !== 'unsupported' && (
            <button type="button" className="btn-secondary" onClick={retryGps}>{t('retry')}</button>
          )}
        </div>
      )}

      {/* Bottom sheet — two modes: card (selected stop) and list (all stops) */}
      <aside className={`tour-sheet tour-sheet-${sheetMode}`} aria-label={t('tourStops')}>
        <button
          type="button"
          className="tour-sheet-handle"
          onClick={() => setSheetMode(sheetMode === 'list' ? 'card' : 'list')}
          aria-label={sheetMode === 'list' ? t('collapse') : t('expand')}
        >
          <span className="tour-sheet-grip" aria-hidden />
          <span className="tour-sheet-handle-label">
            {sheetMode === 'list' ? `${clues.length} ${t('tourStops').toLowerCase()}` : `${t('tourStops')} ↑`}
          </span>
        </button>

        {sheetMode === 'card' && selectedClue && (() => {
          const distance = selectedDistance
          const nearby = selectedNearby
          const isVisited = selectedVisited
          return (
            <div className="tour-card">
              <div className="tour-card-head">
                <span className={`tour-card-badge ${isVisited ? 'is-visited' : ''}`} style={!isVisited ? { background: catMeta.color } : undefined}>
                  {isVisited ? <Check size={16} strokeWidth={2.5} aria-label={t('visited')} /> : selectedClue.order}
                </span>
                <div className="tour-card-headline">
                  <div className="tour-card-name">{selectedClue.locationName || fmt(t('stopN'), { n: selectedClue.order })}</div>
                  {selectedClue.theme && <div className="tour-card-theme">{selectedClue.theme}</div>}
                </div>
                {distance !== null && !isVisited && (
                  <div className={`tour-card-distance ${nearby ? 'is-near' : ''}`}>
                    {distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}
                    {nearby && <span className="tour-card-distance-tag">{t('nearby')}</span>}
                  </div>
                )}
              </div>
              {selectedClue.riddle && (
                <p className="tour-card-desc typewriter">{selectedClue.riddle}</p>
              )}
              <div className="tour-card-actions">
                <button
                  type="button"
                  className="tour-card-detail-btn"
                  onClick={() => setSheetMode('list')}
                >
                  {t('moreHints')} ↑
                </button>
                {isVisited ? (
                  <span className="tour-card-visited-tag"><Check size={16} strokeWidth={2.25} aria-hidden /> {t('visited')}</span>
                ) : (
                  <button
                    type="button"
                    className={`tour-card-here-btn ${nearby ? 'is-nearby' : ''}`}
                    onClick={() => markVisited(selectedClue.id)}
                    disabled={marking === selectedClue.id}
                  >
                    {marking === selectedClue.id ? '…' : t('imHere')}
                  </button>
                )}
              </div>
              {/* Pager */}
              <div className="tour-card-pager">
                <button
                  type="button"
                  className="tour-card-pager-btn"
                  disabled={selectedClue.order <= 1}
                  onClick={() => {
                    const prev = clues.find(c => c.order === selectedClue.order - 1)
                    if (prev) onMarkerSelect(prev.id)
                  }}
                  aria-label={t('prevStop')}
                >
                  <ArrowLeft size={18} strokeWidth={2} aria-hidden />
                </button>
                <span className="tour-card-pager-pos">
                  {selectedClue.order} / {clues.length}
                </span>
                <button
                  type="button"
                  className="tour-card-pager-btn"
                  disabled={selectedClue.order >= clues.length}
                  onClick={() => {
                    const nxt = clues.find(c => c.order === selectedClue.order + 1)
                    if (nxt) onMarkerSelect(nxt.id)
                  }}
                  aria-label={t('nextStop')}
                >
                  <ArrowRight size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          )
        })()}

        {sheetMode === 'list' && (
          <ul className="tour-stops">
            {clues.map((clue) => {
              const isOpen = openClueId === clue.id
              const isVisited = arrived.has(clue.id)
              const distance = userPos
                ? Math.round(haversineM(userPos.lat, userPos.lng, clue.lat, clue.lng))
                : null
              const nearby = distance !== null && distance <= NEARBY_M

              return (
                <li
                  key={clue.id}
                  ref={(el) => {
                    if (el) stopRefs.current.set(clue.id, el)
                    else stopRefs.current.delete(clue.id)
                  }}
                  className={`tour-stop ${isVisited ? 'is-visited' : ''} ${isOpen ? 'is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="tour-stop-summary"
                    onClick={() => setOpenClueId(isOpen ? null : clue.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="tour-stop-num">
                      {isVisited ? <Check size={16} strokeWidth={2.5} aria-label={t('visited')} /> : clue.order}
                    </span>
                    <div className="tour-stop-headline">
                      <div className="tour-stop-name">{clue.locationName || fmt(t('stopN'), { n: clue.order })}</div>
                      <div className="tour-stop-meta">
                        {clue.theme && <span className="tour-stop-theme">{clue.theme}</span>}
                        {distance !== null && !isVisited && (
                          <span className={`tour-stop-distance ${nearby ? 'is-near' : ''}`}>
                            {distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}
                            {nearby && ` · ${t('nearby')}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="tour-stop-chevron" aria-hidden>{isOpen ? <ChevronDown size={18} strokeWidth={2} /> : <ChevronRight size={18} strokeWidth={2} />}</span>
                  </button>

                  {isOpen && (
                    <div className="tour-stop-body">
                      {clue.riddle && <p className="tour-stop-desc">{clue.riddle}</p>}
                      {clue.funFact && (
                        <div className="tour-stop-funfact">
                          <span className="tour-stop-funfact-label">{t('didYouKnow')}</span>
                          <p>{clue.funFact}</p>
                        </div>
                      )}
                      <div className="tour-stop-actions">
                        <button
                          type="button"
                          onClick={() => focusOnMap(clue.id)}
                          className="tour-stop-maps-btn"
                        >
                          <MapPin size={16} strokeWidth={1.75} aria-hidden />
                          {t('showMap')}
                        </button>
                        {isVisited ? (
                          <span className="tour-stop-visited-tag"><Check size={16} strokeWidth={2.25} aria-hidden /> {t('visited')}</span>
                        ) : (
                          <button
                            type="button"
                            className={`tour-stop-here-btn ${nearby ? 'is-nearby' : ''}`}
                            onClick={() => markVisited(clue.id)}
                            disabled={marking === clue.id}
                          >
                            {marking === clue.id ? '…' : t('imHere')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {allDone && (
          <a
            href={`/hunt/complete?session=${sessionId}`}
            className="tour-cta-finish"
          >
            {t('seeFinal')} <ArrowRight size={18} strokeWidth={2} aria-hidden />
          </a>
        )}
      </aside>
    </div>
  )
}
