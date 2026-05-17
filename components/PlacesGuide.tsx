'use client'
import { Fragment, useMemo, useRef, useState, useEffect } from 'react'
import type { Place, PlacesSpec } from '@/lib/md'
import { PlacesGuideMap } from './PlacesGuideMap'

interface Props {
  /** Post title — shown in the floating top bar. */
  title: string
  excerpt: string
  category: string
  publishedAt: string
  readMinutes: number
  /** Map data: categories + places. */
  spec: PlacesSpec
  /** Pre-rendered HTML for the article body (segments + CTAs already inlined). */
  htmlSegments: string[]
  /** Pre-resolved CTA cards (matches the segments index). */
  ctaCards: React.ReactNode[]
}

type View = 'map' | 'list'
type SheetState = 'peek' | 'card' | 'full'

/**
 * Map-first places guide with a three-state bottom sheet:
 *  peek  — just the handle + selected place's name (gives the map maximum room)
 *  card  — focused place: image, description, links, prev/next pager
 *  full  — article body + filterable place list, both scrollable
 *
 * The sheet supports swipe gestures on the handle: drag up to grow, drag
 * down to shrink. A view toggle in the top bar swaps the whole layout for
 * a list-only view (no map), useful when the player just wants to scan.
 *
 * Click anywhere — map marker, list item, or `[label](#place-id)` link
 * inside the article body — to open that place's card.
 */
export function PlacesGuide({
  title, excerpt, category, publishedAt, readMinutes, spec, htmlSegments, ctaCards,
}: Props) {
  const places: Place[] = spec.places
  const [selectedId, setSelectedId] = useState<string | null>(places[0]?.id ?? null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [view, setView] = useState<View>('map')
  const [sheetState, setSheetState] = useState<SheetState>('card')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const listItemRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // Optional live GPS — purely for the "you're nearby" hint (no scoring here).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Catch clicks on in-article anchors (`<a href="#place-<id>">`) and use
  // them to open the matching place card. Bound once on the article container.
  const articleRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = articleRef.current
    if (!root) return
    const handler = (ev: MouseEvent) => {
      const target = (ev.target as HTMLElement | null)?.closest('a')
      if (!target) return
      const href = target.getAttribute('href') ?? ''
      const m = href.match(/^#place-(.+)$/)
      if (!m) return
      const placeId = decodeURIComponent(m[1])
      if (places.some(p => p.id === placeId)) {
        ev.preventDefault()
        selectPlace(placeId)
        // From the article (full sheet) → drop back to card so they can see
        // the map fly to the marker.
        setSheetState('card')
      }
    }
    root.addEventListener('click', handler)
    return () => root.removeEventListener('click', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  const filteredPlaces = useMemo(
    () => activeCat ? places.filter(p => p.category === activeCat) : places,
    [places, activeCat]
  )

  const selectPlace = (placeId: string) => {
    setSelectedId(placeId)
    setView('map')
    if (sheetState === 'peek') setSheetState('card')
    // Scroll the matching list item into view so when the user later expands
    // to full mode, the place they came from is on screen.
    const el = listItemRefs.current.get(placeId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // ── Swipe gestures on the sheet handle ─────────────────────────────
  // Threshold-based: any drag of more than 36px snaps the sheet to the
  // next state in the direction of the drag. Tap (small movement) cycles
  // states upward, like the old click behaviour.
  const touchStartY = useRef<number | null>(null)
  const onHandleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (Math.abs(dy) < 24) return // treat as tap — onClick handles cycling
    setSheetState(prev => {
      if (dy > 0) {
        // dragged down → shrink
        return prev === 'full' ? 'card' : 'peek'
      }
      // dragged up → grow
      return prev === 'peek' ? 'card' : 'full'
    })
  }
  const cycleSheet = () => {
    setSheetState(prev =>
      prev === 'peek' ? 'card'
      : prev === 'card' ? 'full'
      : 'peek'
    )
  }

  const selectedPlace = places.find(p => p.id === selectedId) ?? places[0] ?? null
  const selectedCategory = selectedPlace
    ? spec.categories.find(c => c.id === selectedPlace.category) ?? spec.categories[0]
    : null
  const accentColor = selectedCategory?.color ?? '#6366f1'

  const handleLabel =
    sheetState === 'full' ? 'Collapse ↓'
    : sheetState === 'card' ? `Read article · ${places.length} places ↑`
    : `${selectedPlace?.name ?? 'Tap to expand'} ↑`

  return (
    <div className={`places-guide view-${view} ${view === 'map' ? `sheet-${sheetState}` : ''}`}>
      {/* Top bar — back to /blog, title + meta, view toggle */}
      <header className="places-guide-topbar">
        <a href="/blog" className="tour-topbar-back" aria-label="Back to blog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">📍 {category} · {places.length} places</div>
          <div className="tour-topbar-title">{title}</div>
        </div>
        <div className="places-guide-view-toggle" role="tablist" aria-label="Layout">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            className={`places-guide-view-btn ${view === 'map' ? 'is-active' : ''}`}
            onClick={() => setView('map')}
            aria-label="Map view"
            title="Map"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            className={`places-guide-view-btn ${view === 'list' ? 'is-active' : ''}`}
            onClick={() => setView('list')}
            aria-label="List view"
            title="List"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="4" cy="6" r="1.4" /><circle cx="4" cy="12" r="1.4" /><circle cx="4" cy="18" r="1.4" />
            </svg>
          </button>
        </div>
      </header>

      {/* ╭─────────────── MAP VIEW ───────────────╮ */}
      {view === 'map' && (
        <>
          <div className="places-guide-map-wrap">
            <PlacesGuideMap
              places={filteredPlaces}
              categories={spec.categories}
              selectedId={selectedId}
              onSelect={selectPlace}
              userLat={userPos?.lat ?? null}
              userLng={userPos?.lng ?? null}
            />
          </div>

          {/* Category filter chips — float just above the sheet */}
          <div className="places-guide-cats" role="tablist" aria-label="Place categories">
            <button
              type="button"
              className={`places-guide-cat ${activeCat === null ? 'is-active' : ''}`}
              onClick={() => setActiveCat(null)}
            >
              All · {places.length}
            </button>
            {spec.categories.map(cat => {
              const count = places.filter(p => p.category === cat.id).length
              if (count === 0) return null
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`places-guide-cat ${activeCat === cat.id ? 'is-active' : ''}`}
                  onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                  style={activeCat === cat.id ? { background: cat.color, color: '#fff', borderColor: cat.color } : undefined}
                >
                  <span aria-hidden style={{ marginRight: 4 }}>{cat.icon}</span>
                  {cat.label} · {count}
                </button>
              )
            })}
          </div>

          {/* Three-state bottom sheet (peek / card / full) */}
          <aside className={`places-sheet sheet-${sheetState}`}>
            <button
              type="button"
              className="places-sheet-handle"
              onClick={cycleSheet}
              onTouchStart={onHandleTouchStart}
              onTouchEnd={onHandleTouchEnd}
              aria-label={sheetState === 'full' ? 'Collapse sheet' : 'Expand sheet'}
            >
              <span className="places-sheet-grip" aria-hidden />
              <span className="places-sheet-handle-label">{handleLabel}</span>
            </button>

            {/* Scrollable content area — overflow-y: auto so swiping down on
                the actual content shows more of it (rather than dragging the
                sheet). The handle on top is the sheet's resize affordance. */}
            <div className="places-sheet-scroll">
              {/* ── Peek mode just shows a compact strip with the selected place */}
              {sheetState === 'peek' && selectedPlace && selectedCategory && (
                <button
                  type="button"
                  className="places-sheet-peek"
                  onClick={() => setSheetState('card')}
                >
                  <span className="places-sheet-peek-icon" style={{ background: selectedCategory.color }} aria-hidden>
                    {selectedCategory.icon}
                  </span>
                  <span className="places-sheet-peek-name">{selectedPlace.name}</span>
                  <span className="places-sheet-peek-arrow" aria-hidden>↑</span>
                </button>
              )}

              {/* ── Card mode — focused place */}
              {sheetState === 'card' && selectedPlace && selectedCategory && (
                <FocusedPlaceCard
                  place={selectedPlace}
                  category={selectedCategory}
                  accentColor={accentColor}
                  index={places.findIndex(p => p.id === selectedPlace.id)}
                  total={places.length}
                  onPrev={() => {
                    const i = places.findIndex(p => p.id === selectedPlace.id)
                    if (i > 0) selectPlace(places[i - 1].id)
                  }}
                  onNext={() => {
                    const i = places.findIndex(p => p.id === selectedPlace.id)
                    if (i < places.length - 1) selectPlace(places[i + 1].id)
                  }}
                  onExpand={() => setSheetState('full')}
                />
              )}

              {/* ── Full mode — article + place list */}
              {sheetState === 'full' && (
                <FullArticleAndList
                  excerpt={excerpt}
                  category={category}
                  publishedAt={publishedAt}
                  readMinutes={readMinutes}
                  htmlSegments={htmlSegments}
                  ctaCards={ctaCards}
                  articleRef={articleRef}
                  filteredPlaces={filteredPlaces}
                  categories={spec.categories}
                  selectedId={selectedId}
                  listItemRefs={listItemRefs}
                  onSelect={selectPlace}
                />
              )}
            </div>
          </aside>
        </>
      )}

      {/* ╭─────────────── LIST VIEW ───────────────╮ */}
      {view === 'list' && (
        <main className="places-list-view">
          <div className="places-list-view-inner">
            {/* Article body up top */}
            <div className="places-guide-article" ref={articleRef}>
              <div className="blog-post-meta">
                <span className="blog-post-cat">{category}</span>
                <span aria-hidden>·</span>
                <time dateTime={publishedAt}>
                  {new Date(publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
                <span aria-hidden>·</span>
                <span>{readMinutes} min read</span>
              </div>
              {excerpt && <p className="places-guide-article-lede">{excerpt}</p>}
              <div className="blog-post-body">
                {htmlSegments.map((html, i) => (
                  <Fragment key={i}>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                    {i < ctaCards.length && ctaCards[i]}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Category filter strip */}
            <div className="places-list-view-cats" role="tablist" aria-label="Place categories">
              <button
                type="button"
                className={`places-guide-cat ${activeCat === null ? 'is-active' : ''}`}
                onClick={() => setActiveCat(null)}
              >
                All · {places.length}
              </button>
              {spec.categories.map(cat => {
                const count = places.filter(p => p.category === cat.id).length
                if (count === 0) return null
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`places-guide-cat ${activeCat === cat.id ? 'is-active' : ''}`}
                    onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
                    style={activeCat === cat.id ? { background: cat.color, color: '#fff', borderColor: cat.color } : undefined}
                  >
                    <span aria-hidden style={{ marginRight: 4 }}>{cat.icon}</span>
                    {cat.label} · {count}
                  </button>
                )
              })}
            </div>

            {/* Full-screen scrollable list of place cards */}
            <ul className="places-list-grid">
              {filteredPlaces.map((place) => {
                const cat = spec.categories.find(c => c.id === place.category)
                return (
                  <li key={place.id} id={`place-${place.id}`}>
                    <button
                      type="button"
                      className="places-list-card"
                      onClick={() => selectPlace(place.id)}
                    >
                      {place.image && (
                        <div className="places-list-card-image">
                          <img src={place.image} alt={place.name} loading="lazy" />
                        </div>
                      )}
                      <div className="places-list-card-body">
                        {cat && (
                          <div className="places-list-card-cat" style={{ color: cat.color }}>
                            <span aria-hidden>{cat.icon}</span> {cat.label}
                          </div>
                        )}
                        <div className="places-list-card-name">{place.name}</div>
                        {place.address && (
                          <div className="places-list-card-addr">{place.address}</div>
                        )}
                        {place.description && (
                          <p className="places-list-card-desc">{place.description}</p>
                        )}
                        <div className="places-list-card-cta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          Show on map →
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </main>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Focused place card (sheet 'card' state)
// ───────────────────────────────────────────────────────────────────

function FocusedPlaceCard({
  place, category, accentColor, index, total, onPrev, onNext, onExpand,
}: {
  place: Place
  category: { id: string; label: string; icon: string; color: string }
  accentColor: string
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  onExpand: () => void
}) {
  return (
    <div className="places-card">
      {place.image && (
        <div className="places-card-image">
          <img src={place.image} alt={place.name} loading="lazy" />
        </div>
      )}
      <div className="places-card-body">
        <div className="places-card-cat" style={{ color: category.color }}>
          <span aria-hidden>{category.icon}</span> {category.label}
        </div>
        <h3 className="places-card-name">{place.name}</h3>
        {place.address && <div className="places-card-addr">{place.address}</div>}
        {place.description && <p className="places-card-desc">{place.description}</p>}
        <div className="places-card-actions">
          <button type="button" className="places-card-expand-btn" onClick={onExpand}>
            Read article ↑
          </button>
          {place.url && (
            <a href={place.url} target="_blank" rel="noopener noreferrer" className="places-card-link" style={{ background: accentColor }}>
              More info →
            </a>
          )}
        </div>
        <div className="places-card-pager">
          <button type="button" className="places-card-pager-btn" disabled={index <= 0} onClick={onPrev} aria-label="Previous place">←</button>
          <span className="places-card-pager-pos">{index + 1} / {total}</span>
          <button type="button" className="places-card-pager-btn" disabled={index >= total - 1} onClick={onNext} aria-label="Next place">→</button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Full mode: article body + place list
// ───────────────────────────────────────────────────────────────────

function FullArticleAndList({
  excerpt, category, publishedAt, readMinutes, htmlSegments, ctaCards, articleRef,
  filteredPlaces, categories, selectedId, listItemRefs, onSelect,
}: {
  excerpt: string
  category: string
  publishedAt: string
  readMinutes: number
  htmlSegments: string[]
  ctaCards: React.ReactNode[]
  articleRef: React.RefObject<HTMLDivElement>
  filteredPlaces: Place[]
  categories: { id: string; label: string; icon: string; color: string }[]
  selectedId: string | null
  listItemRefs: React.MutableRefObject<Map<string, HTMLLIElement>>
  onSelect: (id: string) => void
}) {
  return (
    <div className="places-full-body">
      <div className="places-guide-article" ref={articleRef}>
        <div className="blog-post-meta">
          <span className="blog-post-cat">{category}</span>
          <span aria-hidden>·</span>
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          <span aria-hidden>·</span>
          <span>{readMinutes} min read</span>
        </div>
        {excerpt && <p className="places-guide-article-lede">{excerpt}</p>}
        <div className="blog-post-body">
          {htmlSegments.map((html, i) => (
            <Fragment key={i}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
              {i < ctaCards.length && ctaCards[i]}
            </Fragment>
          ))}
        </div>
      </div>

      <h3 className="places-full-list-heading">All places ({filteredPlaces.length})</h3>
      <ul className="places-full-list">
        {filteredPlaces.map((place) => {
          const cat = categories.find(c => c.id === place.category)
          const isOpen = selectedId === place.id
          return (
            <li
              key={place.id}
              id={`place-${place.id}`}
              ref={(el) => {
                if (el) listItemRefs.current.set(place.id, el)
                else listItemRefs.current.delete(place.id)
              }}
              className={`places-full-list-item ${isOpen ? 'is-open' : ''}`}
            >
              <button
                type="button"
                className="places-full-list-summary"
                onClick={() => onSelect(place.id)}
              >
                <span className="places-full-list-icon" style={{ background: cat?.color ?? '#6366f1' }} aria-hidden>
                  {cat?.icon ?? '📍'}
                </span>
                <div className="places-full-list-text">
                  <div className="places-full-list-name">{place.name}</div>
                  {cat && (
                    <div className="places-full-list-meta">
                      <span>{cat.label}</span>
                      {place.address && <span>· {place.address}</span>}
                    </div>
                  )}
                </div>
                <span className="places-full-list-chevron" aria-hidden>▸</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
