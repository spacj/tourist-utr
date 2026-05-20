'use client'
import { useMemo, useState, useEffect } from 'react'
import { Bench, BENCH_CATEGORIES } from '@/types'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { PlacesGuideMap } from '@/components/PlacesGuideMap'
import type { Place, PlaceCategory } from '@/lib/md'

interface Props {
  initialBenches: Bench[]
}

/**
 * Public benches directory. Map-first (reuses PlacesGuideMap) with a
 * category filter and a scrollable card list. Admins get an "Add a bench
 * here" button that links to the GPS capture form.
 *
 * The server component already rendered every bench as crawlable HTML +
 * JSON-LD; this client layer just adds the interactive map and filtering.
 */
export function BenchesClient({ initialBenches }: Props) {
  const isAdmin = useIsAdmin()
  const [benches, setBenches] = useState<Bench[]>(initialBenches)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialBenches[0]?.id ?? null)
  const [view, setView] = useState<'map' | 'list'>('map')

  // Refresh from the API on mount so a freshly-added bench appears without a
  // full rebuild (the server page is ISR-cached for an hour).
  useEffect(() => {
    fetch('/api/benches').then(r => r.json()).then((rows: Bench[]) => {
      if (Array.isArray(rows) && rows.length) setBenches(rows)
    }).catch(() => {})
  }, [])

  const categories: PlaceCategory[] = BENCH_CATEGORIES.map(c => ({
    id: c.id, label: c.label, icon: c.icon, color: c.color,
  }))

  const filtered = useMemo(
    () => activeCat ? benches.filter(b => b.category === activeCat) : benches,
    [benches, activeCat]
  )

  // Map benches → the Place shape PlacesGuideMap expects.
  const placesForMap: Place[] = filtered.map(b => ({
    id: b.id,
    name: b.title,
    category: b.category,
    lat: b.lat,
    lng: b.lng,
    description: b.description,
  }))

  const selected = benches.find(b => b.id === selectedId) ?? benches[0] ?? null
  const catOf = (id: string) => BENCH_CATEGORIES.find(c => c.id === id)

  return (
    <div className={`benches-page view-${view}`}>
      <header className="benches-topbar">
        <a href="/" className="tour-topbar-back" aria-label="Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </a>
        <div className="tour-topbar-info">
          <div className="tour-topbar-eyebrow">🪑 Benches · {benches.length} spots</div>
          <div className="tour-topbar-title">Good places to sit</div>
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
        <a href="/benches/add" className="benches-add-fab" aria-label="Add a bench at my location">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Add a bench</span>
        </a>
      )}

      {benches.length === 0 ? (
        <div className="benches-empty">
          <div className="benches-empty-icon" aria-hidden>🪑</div>
          <h2>No benches yet</h2>
          <p>This map is just getting started. Check back soon — or if you're an editor, drop the first pin.</p>
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

          <div className="places-guide-cats benches-cats" role="tablist" aria-label="Bench types">
            <button type="button" className={`places-guide-cat ${activeCat === null ? 'is-active' : ''}`} onClick={() => setActiveCat(null)}>
              All · {benches.length}
            </button>
            {BENCH_CATEGORIES.map(cat => {
              const count = benches.filter(b => b.category === cat.id).length
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

          {selected && (() => {
            const cat = catOf(selected.category)
            return (
              <aside className="benches-sheet">
                <div className="benches-sheet-body">
                  {cat && (
                    <div className="benches-card-cat" style={{ color: cat.color }}>
                      <span aria-hidden>{cat.icon}</span> {cat.label}
                    </div>
                  )}
                  <h3 className="benches-card-title">{selected.title}</h3>
                  {selected.city && <div className="benches-card-city">{selected.city}</div>}
                  {selected.description && <p className="benches-card-desc">{selected.description}</p>}
                  <div className="benches-card-actions">
                    <a className="benches-card-link" href={`/benches/${selected.slug}`}>Open page →</a>
                    <a
                      className="benches-card-directions"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                  </div>
                </div>
              </aside>
            )
          })()}
        </>
      ) : (
        <main className="benches-list-view">
          <div className="benches-list-inner">
            <div className="places-list-view-cats" role="tablist" aria-label="Bench types">
              <button type="button" className={`places-guide-cat ${activeCat === null ? 'is-active' : ''}`} onClick={() => setActiveCat(null)}>
                All · {benches.length}
              </button>
              {BENCH_CATEGORIES.map(cat => {
                const count = benches.filter(b => b.category === cat.id).length
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
            <ul className="benches-grid">
              {filtered.map(b => {
                const cat = catOf(b.category)
                return (
                  <li key={b.id}>
                    <a className="benches-grid-card" href={`/benches/${b.slug}`}>
                      <span className="benches-grid-icon" style={{ background: cat?.color ?? '#6366f1' }} aria-hidden>
                        {cat?.icon ?? '🪑'}
                      </span>
                      <div className="benches-grid-body">
                        {cat && <div className="benches-grid-cat" style={{ color: cat.color }}>{cat.label}</div>}
                        <div className="benches-grid-name">{b.title}</div>
                        {b.city && <div className="benches-grid-city">{b.city}</div>}
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
