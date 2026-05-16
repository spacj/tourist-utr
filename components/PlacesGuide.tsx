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

/**
 * Walking-tour-style layout for a "places-guide" blog article:
 *  - full-screen map, no connecting polyline
 *  - bottom sheet has two modes:
 *      'card'    = focused place card (name, image, description, address)
 *      'list'    = scrollable list of places (with category filter chips)
 *  - clicking a place anywhere (map marker, list item, or an in-article
 *    anchor link with href="#place-<id>") opens that place card
 *
 * The article body lives in the expanded sheet (above the place list) so
 * users can read the prose and tap into specific spots without leaving the
 * map view.
 */
export function PlacesGuide({
  title, excerpt, category, publishedAt, readMinutes, spec, htmlSegments, ctaCards,
}: Props) {
  const places: Place[] = spec.places
  const [selectedId, setSelectedId] = useState<string | null>(places[0]?.id ?? null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [sheetMode, setSheetMode] = useState<'card' | 'list'>('card')
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
    setSheetMode('card')
    // Scroll the matching list item into view so when the user later expands
    // the list, the place they came from is on screen.
    const el = listItemRefs.current.get(placeId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const selectedPlace = places.find(p => p.id === selectedId) ?? places[0] ?? null
  const selectedCategory = selectedPlace
    ? spec.categories.find(c => c.id === selectedPlace.category) ?? spec.categories[0]
    : null
  const accentColor = selectedCategory?.color ?? '#6366f1'

  return (
    <div className={`tour-fullscreen sheet-${sheetMode}`}>
      {/* Top bar — back to /blog, title + meta, category filter chip strip */}
      <header className="tour-topbar places-guide-topbar">
        <a href="/blog" className="tour-topbar-back" aria-label="Back to blog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">📍 {category}</div>
          <div className="tour-topbar-title">{title}</div>
        </div>
        <div className="places-guide-meta" aria-label={`${places.length} places · ${readMinutes} min read`}>
          <span className="places-guide-meta-count">{places.length}</span>
          <span className="places-guide-meta-label">places</span>
        </div>
      </header>

      {/* Full-screen map */}
      <div className="tour-fullmap">
        <PlacesGuideMap
          places={filteredPlaces}
          categories={spec.categories}
          selectedId={selectedId}
          onSelect={selectPlace}
          userLat={userPos?.lat ?? null}
          userLng={userPos?.lng ?? null}
        />
      </div>

      {/* Category filter chips — floats just above the sheet */}
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

      {/* Bottom sheet — two modes */}
      <aside className={`tour-sheet tour-sheet-${sheetMode}`}>
        <button
          type="button"
          className="tour-sheet-handle"
          onClick={() => setSheetMode(sheetMode === 'list' ? 'card' : 'list')}
          aria-label={sheetMode === 'list' ? 'Collapse list' : 'Expand list'}
        >
          <span className="tour-sheet-grip" aria-hidden />
          <span className="tour-sheet-handle-label">
            {sheetMode === 'list' ? `Selected place ↓` : `Read article · ${places.length} places ↑`}
          </span>
        </button>

        {/* CARD mode — focused place */}
        {sheetMode === 'card' && selectedPlace && selectedCategory && (
          <div className="places-guide-card">
            {selectedPlace.image && (
              <div className="places-guide-card-image">
                <img src={selectedPlace.image} alt={selectedPlace.name} loading="lazy" />
              </div>
            )}
            <div className="places-guide-card-body">
              <div className="places-guide-card-cat" style={{ color: selectedCategory.color }}>
                <span aria-hidden>{selectedCategory.icon}</span> {selectedCategory.label}
              </div>
              <h3 className="places-guide-card-name">{selectedPlace.name}</h3>
              {selectedPlace.address && (
                <div className="places-guide-card-addr">{selectedPlace.address}</div>
              )}
              {selectedPlace.description && (
                <p className="places-guide-card-desc">{selectedPlace.description}</p>
              )}
              <div className="places-guide-card-actions">
                <button
                  type="button"
                  className="tour-card-detail-btn"
                  onClick={() => setSheetMode('list')}
                >
                  Read article ↑
                </button>
                {selectedPlace.url && (
                  <a href={selectedPlace.url} target="_blank" rel="noopener noreferrer" className="places-guide-card-link" style={{ background: accentColor }}>
                    More info →
                  </a>
                )}
              </div>
              {/* Pager */}
              <div className="tour-card-pager">
                <button
                  type="button"
                  className="tour-card-pager-btn"
                  disabled={places.findIndex(p => p.id === selectedPlace.id) <= 0}
                  onClick={() => {
                    const i = places.findIndex(p => p.id === selectedPlace.id)
                    if (i > 0) selectPlace(places[i - 1].id)
                  }}
                  aria-label="Previous place"
                >
                  ←
                </button>
                <span className="tour-card-pager-pos">
                  {places.findIndex(p => p.id === selectedPlace.id) + 1} / {places.length}
                </span>
                <button
                  type="button"
                  className="tour-card-pager-btn"
                  disabled={places.findIndex(p => p.id === selectedPlace.id) >= places.length - 1}
                  onClick={() => {
                    const i = places.findIndex(p => p.id === selectedPlace.id)
                    if (i < places.length - 1) selectPlace(places[i + 1].id)
                  }}
                  aria-label="Next place"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIST mode — article + filterable place list */}
        {sheetMode === 'list' && (
          <div className="places-guide-list-mode">
            {/* Article body — anchor links of the form #place-<id> open the place card */}
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

            <h3 className="places-guide-list-heading">All places ({filteredPlaces.length})</h3>
            <ul className="tour-stops">
              {filteredPlaces.map((place) => {
                const cat = spec.categories.find(c => c.id === place.category)
                const isOpen = selectedId === place.id
                return (
                  <li
                    key={place.id}
                    id={`place-${place.id}`}
                    ref={(el) => {
                      if (el) listItemRefs.current.set(place.id, el)
                      else listItemRefs.current.delete(place.id)
                    }}
                    className={`tour-stop ${isOpen ? 'is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="tour-stop-summary"
                      onClick={() => selectPlace(place.id)}
                    >
                      <span
                        className="tour-stop-num"
                        style={{ background: cat?.color ?? '#6366f1' }}
                        aria-hidden
                      >
                        {cat?.icon ?? '📍'}
                      </span>
                      <div className="tour-stop-headline">
                        <div className="tour-stop-name">{place.name}</div>
                        {cat && (
                          <div className="tour-stop-meta">
                            <span className="tour-stop-theme">{cat.label}</span>
                            {place.address && <span className="tour-stop-distance">{place.address}</span>}
                          </div>
                        )}
                      </div>
                      <span className="tour-stop-chevron" aria-hidden>▸</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
