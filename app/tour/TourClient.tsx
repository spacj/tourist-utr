'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Clue, Hunt, localizeClue, localizeHunt, TourCategory } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { haversineM } from '@/lib/geo'
import { TourMapView } from '@/components/TourMapView'

interface Props {
  hunt: Hunt
  clues: Clue[]
  sessionId: string
  initiallyArrivedIds: string[]
}

const TOUR_CATEGORY_META: Record<TourCategory, { icon: string; color: string }> = {
  nightlife: { icon: '🌙', color: '#7c3aed' },
  food:      { icon: '🍝', color: '#dc2626' },
  shopping:  { icon: '🛍️', color: '#0891b2' },
  culture:   { icon: '🏛️', color: '#0d9488' },
  family:    { icon: '👨‍👩‍👧', color: '#f59e0b' },
  general:   { icon: '🧭', color: '#6366f1' },
}

const NEARBY_M = 60

export function TourClient({ hunt: rawHunt, clues: rawClues, sessionId, initiallyArrivedIds }: Props) {
  const { t, lang } = useI18n()
  const hunt = localizeHunt(rawHunt, lang)
  const clues = useMemo(
    () => rawClues.map(c => localizeClue(c, lang)).sort((a, b) => a.order - b.order),
    [rawClues, lang]
  )

  const [arrived, setArrived] = useState<Set<string>>(new Set(initiallyArrivedIds))
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [openClueId, setOpenClueId] = useState<string | null>(clues[0]?.id ?? null)
  const [marking, setMarking] = useState<string | null>(null)
  // 'card' = collapsed sheet showing just the selected stop; 'list' = full
  // expandable list of all stops with details
  const [sheetMode, setSheetMode] = useState<'card' | 'list'>('card')
  const stopRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // Live GPS — used to surface "you're nearby" hints, not for scoring.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

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
    try {
      await fetch('/api/verify-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clueId, lat: clue.lat, lng: clue.lng }),
      })
    } catch {
      // Network failure: keep the optimistic state. The next reconnect/visit will reconcile.
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
        <a href="/" className="tour-topbar-back" aria-label={t('exitTour')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">
            <span style={{ marginRight: 4 }}>{catMeta.icon}</span>
            {t(`cat${cat.charAt(0).toUpperCase()}${cat.slice(1)}` as any) || t('tourLabel')}
          </div>
          <div className="tour-topbar-title">{hunt.title}</div>
        </div>
        <div className="tour-topbar-progress" aria-label={`${completedCount} of ${clues.length} stops visited`}>
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

      {/* Bottom sheet — two modes: card (selected stop) and list (all stops) */}
      <aside className={`tour-sheet tour-sheet-${sheetMode}`} aria-label={t('tourStops')}>
        <button
          type="button"
          className="tour-sheet-handle"
          onClick={() => setSheetMode(sheetMode === 'list' ? 'card' : 'list')}
          aria-label={sheetMode === 'list' ? 'Collapse list' : 'Expand list'}
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
                  {isVisited ? '✓' : selectedClue.order}
                </span>
                <div className="tour-card-headline">
                  <div className="tour-card-name">{selectedClue.locationName || `Stop ${selectedClue.order}`}</div>
                  {selectedClue.theme && <div className="tour-card-theme">{selectedClue.theme}</div>}
                </div>
                {distance !== null && !isVisited && (
                  <div className={`tour-card-distance ${nearby ? 'is-near' : ''}`}>
                    {distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}
                    {nearby && <span className="tour-card-distance-tag">{t('nearby') || 'nearby'}</span>}
                  </div>
                )}
              </div>
              {selectedClue.riddle && (
                <p className="tour-card-desc">{selectedClue.riddle}</p>
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
                  <span className="tour-card-visited-tag">✓ {t('visited')}</span>
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
                  ←
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
                  →
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
                      {isVisited ? '✓' : clue.order}
                    </span>
                    <div className="tour-stop-headline">
                      <div className="tour-stop-name">{clue.locationName || `Stop ${clue.order}`}</div>
                      <div className="tour-stop-meta">
                        {clue.theme && <span className="tour-stop-theme">{clue.theme}</span>}
                        {distance !== null && !isVisited && (
                          <span className={`tour-stop-distance ${nearby ? 'is-near' : ''}`}>
                            {distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`}
                            {nearby && ' · nearby'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="tour-stop-chevron" aria-hidden>{isOpen ? '▾' : '▸'}</span>
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
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {t('showMap')}
                        </button>
                        {isVisited ? (
                          <span className="tour-stop-visited-tag">✓ {t('visited')}</span>
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
            {t('seeFinal')} →
          </a>
        )}
      </aside>
    </div>
  )
}
