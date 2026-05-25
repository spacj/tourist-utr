'use client'
import { useMemo, useState, useEffect } from 'react'
import { Bench, SpotKind, SPOT_KINDS } from '@/types'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { PlacesGuideMap } from '@/components/PlacesGuideMap'
import type { Place, PlaceCategory } from '@/lib/md'

interface Props {
  kind: SpotKind
  initialSpots: Bench[]
}

/**
 * Public spot directory shared by /benches and /fountains. Map-first (reuses
 * PlacesGuideMap) with a category filter and a scrollable card list. Admins
 * get an "Add" button to the GPS capture form. The server page already
 * rendered every spot as crawlable HTML + JSON-LD; this is the interactive
 * layer. All copy + categories come from SPOT_KINDS[kind].
 */
export function SpotsClient({ kind, initialSpots }: Props) {
  const cfg = SPOT_KINDS[kind]
  const base = cfg.urlBase
  const isAdmin = useIsAdmin()
  const [spots, setSpots] = useState<Bench[]>(initialSpots)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialSpots[0]?.id ?? null)
  const [view, setView] = useState<'map' | 'list'>('map')

  // Refresh from the API on mount so a freshly-added spot appears without a
  // full rebuild (the server page is ISR-cached for an hour).
  useEffect(() => {
    fetch(`/api/benches?kind=${kind}`).then(r => r.json()).then((rows: Bench[]) => {
      if (Array.isArray(rows)) setSpots(rows)
    }).catch(() => {})
  }, [kind])

  const categories: PlaceCategory[] = cfg.categories.map(c => ({
    id: c.id, label: c.label, icon: c.icon, color: c.color,
  }))

  const filtered = useMemo(
    () => activeCat ? spots.filter(b => b.categories.includes(activeCat)) : spots,
    [spots, activeCat]
  )

  const placesForMap: Place[] = filtered.map(b => ({
    id: b.id,
    name: b.title,
    category: b.categories[0] ?? cfg.defaultCategory,
    lat: b.lat,
    lng: b.lng,
    description: b.description,
    address: b.address,
  }))

  const selected = spots.find(b => b.id === selectedId) ?? spots[0] ?? null
  const catOf = (id: string) => cfg.categories.find(c => c.id === id)
  const catsOf = (b: Bench) => b.categories.map(catOf).filter(Boolean) as typeof cfg.categories
  const countWith = (id: string) => spots.filter(b => b.categories.includes(id)).length

  const renderCatChips = (extraClass: string) => (
    <div className={extraClass} role="tablist" aria-label={`${cfg.copy.nounSingular} types`}>
      <button type="button" className={`places-guide-cat ${activeCat === null ? 'is-active' : ''}`} onClick={() => setActiveCat(null)}>
        All · {spots.length}
      </button>
      {cfg.categories.map(cat => {
        const count = countWith(cat.id)
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
  )

  return (
    <div className={`benches-page view-${view}`}>
      <header className="benches-topbar">
        <a href="/" className="tour-topbar-back" aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">{cfg.icon} {cfg.copy.eyebrow} · {spots.length} {cfg.copy.nounPlural}</div>
          <div className="tour-topbar-title">{cfg.copy.sectionTitle}</div>
        </div>
        <div className="places-guide-view-toggle" role="tablist" aria-label="Layout">
          <button type="button" role="tab" aria-selected={view === 'map'} className={`places-guide-view-btn ${view === 'map' ? 'is-active' : ''}`} onClick={() => setView('map')} aria-label="Map view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={`places-guide-view-btn ${view === 'list' ? 'is-active' : ''}`} onClick={() => setView('list')} aria-label="List view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/></svg>
          </button>
        </div>
      </header>

      {isAdmin && (
        <a href={`/${base}/add`} className="benches-add-fab" aria-label={cfg.copy.addCta}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>{cfg.copy.addCta}</span>
        </a>
      )}

      {spots.length === 0 ? (
        <div className="benches-empty">
          <div className="benches-empty-icon" aria-hidden>{cfg.icon}</div>
          <h2>{cfg.copy.emptyTitle}</h2>
          <p>{cfg.copy.emptyBody}</p>
        </div>
      ) : view === 'map' ? (
        <>
          <div className="benches-map-wrap">
            <PlacesGuideMap
              places={placesForMap}
              categories={categories}
              selectedId={selectedId}
              onSelect={setSelectedId}
              userLat={null}
              userLng={null}
            />
          </div>

          {renderCatChips('places-guide-cats benches-cats')}

          {selected && (() => {
            const cats = catsOf(selected)
            const where = [selected.address, selected.city].filter(Boolean).join(', ')
            return (
              <aside className="benches-sheet">
                <div className="benches-sheet-body">
                  {cats.length > 0 && (
                    <div className="benches-card-cats">
                      {cats.map(cat => (
                        <span key={cat.id} className="benches-card-cat-chip" style={{ color: cat.color, borderColor: cat.color }}>
                          <span aria-hidden>{cat.icon}</span> {cat.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <h3 className="benches-card-title">{selected.title}</h3>
                  {where && <div className="benches-card-city">📍 {where}</div>}
                  {selected.description && <p className="benches-card-desc">{selected.description}</p>}
                  <div className="benches-card-actions">
                    <a className="benches-card-link" href={`/${base}/${selected.slug}`}>Open page →</a>
                    <a
                      className="benches-card-directions"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                  </div>
                  {isAdmin && (
                    <a className="benches-card-edit" href={`/${base}/edit/${selected.id}`}>✎ Edit {cfg.copy.nounSingular}</a>
                  )}
                </div>
              </aside>
            )
          })()}
        </>
      ) : (
        <main className="benches-list-view">
          <div className="benches-list-inner">
            {renderCatChips('places-list-view-cats')}
            <ul className="benches-grid">
              {filtered.map(b => {
                const cats = catsOf(b)
                const primary = cats[0]
                const where = [b.address, b.city].filter(Boolean).join(', ')
                return (
                  <li key={b.id}>
                    <a className="benches-grid-card" href={`/${base}/${b.slug}`}>
                      <span className="benches-grid-icon" style={{ background: primary?.color ?? cfg.accent }} aria-hidden>
                        {primary?.icon ?? cfg.icon}
                      </span>
                      <div className="benches-grid-body">
                        {cats.length > 0 && (
                          <div className="benches-grid-cats">
                            {cats.map(c => (
                              <span key={c.id} className="benches-grid-cat" style={{ color: c.color }}>{c.icon} {c.label}</span>
                            ))}
                          </div>
                        )}
                        <div className="benches-grid-name">{b.title}</div>
                        {where && <div className="benches-grid-city">{where}</div>}
                        {b.description && <p className="benches-grid-desc">{b.description}</p>}
                      </div>
                      <span className="benches-grid-arrow" aria-hidden>→</span>
                    </a>
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
