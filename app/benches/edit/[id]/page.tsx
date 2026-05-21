'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { Bench, BENCH_CATEGORIES } from '@/types'
import { PlacesGuideMap } from '@/components/PlacesGuideMap'
import type { Place, PlaceCategory } from '@/lib/md'

/**
 * Admin-only form to edit a published bench: tweak its tags, text and
 * address, or reposition the pin to wherever the editor is standing now.
 * The current position is shown live on the map. Saves via PATCH /api/benches
 * (slug stays fixed so links don't break), then returns to the bench page.
 */
export default function EditBenchPage({ params }: { params: { id: string } }) {
  const { user, loading, signIn } = useAuth()
  const isAdmin = useIsAdmin()

  const [bench, setBench] = useState<Bench | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'missing'>('loading')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [addrState, setAddrState] = useState<'idle' | 'looking' | 'ok' | 'error'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the bench to edit.
  useEffect(() => {
    fetch('/api/benches')
      .then(r => r.json())
      .then((rows: Bench[]) => {
        const b = Array.isArray(rows) ? rows.find(x => x.id === params.id) : null
        if (!b) { setLoadState('missing'); return }
        setBench(b)
        setTitle(b.title)
        setDescription(b.description ?? '')
        setCity(b.city ?? '')
        setAddress(b.address ?? '')
        setPostalCode(b.postalCode ?? '')
        setCategories(b.categories?.length ? b.categories : ['quiet'])
        setCoords({ lat: b.lat, lng: b.lng })
        setLoadState('ok')
      })
      .catch(() => setLoadState('missing'))
  }, [params.id])

  const toggleCategory = (cid: string) =>
    setCategories(prev => prev.includes(cid) ? prev.filter(c => c !== cid) : [...prev, cid])

  const reverseGeocode = async (lat: number, lng: number) => {
    setAddrState('looking')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      const a = data?.address ?? {}
      const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || ''
      const houseNumber = a.house_number || ''
      setAddress([road, houseNumber].filter(Boolean).join(' ').trim())
      setPostalCode(a.postcode || '')
      const locality = a.city || a.town || a.village || a.municipality || a.suburb || ''
      if (locality) setCity(locality)
      setAddrState('ok')
    } catch {
      setAddrState('error')
    }
  }

  const repositionHere = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState('error'); setGeoError('Geolocation is not available in this browser.')
      return
    }
    setGeoState('locating'); setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
        setGeoState('ok')
        reverseGeocode(p.coords.latitude, p.coords.longitude)
      },
      (err) => {
        setGeoState('error')
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable it to move the pin here.'
          : 'Could not get your location. Try again outdoors.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const save = async () => {
    if (!user || !bench || !coords || !title.trim() || categories.length === 0 || submitting) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/benches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: bench.id,
          email: user.email,
          title: title.trim(),
          description: description.trim(),
          city: city.trim(),
          address: address.trim(),
          postalCode: postalCode.trim(),
          categories,
          lat: coords.lat,
          lng: coords.lng,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.slug) {
        window.location.href = `/benches/${data.slug}`
      } else {
        setError(data?.error === 'not_admin' ? 'Your account is not an editor.' : 'Could not save. Check the fields and try again.')
        setSubmitting(false)
      }
    } catch {
      setError('Network error. Try again.')
      setSubmitting(false)
    }
  }

  const mapCategories: PlaceCategory[] = useMemo(
    () => BENCH_CATEGORIES.map(c => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })),
    []
  )
  const mapPlaces: Place[] = useMemo(() => {
    if (!coords) return []
    return [{
      id: bench?.id ?? 'edit',
      name: title || 'Bench',
      category: categories[0] ?? 'quiet',
      lat: coords.lat,
      lng: coords.lng,
    }]
  }, [bench?.id, title, categories, coords])

  if (loading || loadState === 'loading') {
    return <main className="page-center"><div className="spinner" /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container bench-add">
          <a href="/benches" className="back-link">← Benches</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>Sign in with an editor account to edit a bench.</p>
            <button onClick={signIn} className="btn-primary" style={{ marginTop: 12 }}>Sign in</button>
          </div>
        </div>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="page-center">
        <div className="container bench-add">
          <a href="/benches" className="back-link">← Benches</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>Only editors can edit benches.</p>
          </div>
        </div>
      </main>
    )
  }

  if (loadState === 'missing' || !bench) {
    return (
      <main className="page-center">
        <div className="container bench-add">
          <a href="/benches" className="back-link">← Benches</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>That bench could not be found.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container bench-add">
        <a href={`/benches/${bench.slug}`} className="back-link">← Back to bench</a>
        <h1 className="bench-add-title">Edit bench</h1>
        <p className="bench-add-sub">Update the details, or stand on the new spot and move the pin to your current location.</p>

        {/* Live map of the current pin position */}
        <div className="bench-edit-map">
          <PlacesGuideMap
            places={mapPlaces}
            categories={mapCategories}
            selectedId={bench.id}
            onSelect={() => {}}
            userLat={geoState === 'ok' && coords ? coords.lat : null}
            userLng={geoState === 'ok' && coords ? coords.lng : null}
          />
        </div>

        {/* Reposition control */}
        <div className={`bench-add-geo bench-add-geo-${geoState === 'idle' ? 'ok' : geoState}`}>
          {geoState === 'locating' && <><span className="spinner-mini-dark" aria-hidden /> Getting your location…</>}
          {geoState === 'error'
            ? <><span aria-hidden>⚠️</span> <span>{geoError}</span> <button type="button" className="bench-add-relocate" onClick={repositionHere}>Retry</button></>
            : (
              <>
                <span aria-hidden>📍</span>
                <span>Pin at <code>{coords?.lat.toFixed(5)}, {coords?.lng.toFixed(5)}</code></span>
                <button type="button" className="bench-add-relocate" onClick={repositionHere}>Move pin to my location</button>
              </>
            )}
        </div>

        {/* Category picker — pick as many as fit the spot */}
        <label className="bench-add-label">Type of spot <span className="bench-add-multi">pick all that apply</span></label>
        <div className="bench-add-cats">
          {BENCH_CATEGORIES.map(cat => {
            const on = categories.includes(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={on}
                className={`bench-add-cat ${on ? 'is-active' : ''}`}
                onClick={() => toggleCategory(cat.id)}
                style={on ? { background: cat.color, color: '#fff', borderColor: cat.color } : undefined}
              >
                <span aria-hidden>{cat.icon}</span> {cat.label}
              </button>
            )
          })}
        </div>

        <label className="bench-add-label" htmlFor="bench-title">Title</label>
        <input
          id="bench-title"
          className="bench-add-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sunset bench above the Dom"
          maxLength={80}
        />

        <label className="bench-add-label" htmlFor="bench-address">
          Street &amp; number
          {addrState === 'looking' && <span className="bench-add-multi"> looking up…</span>}
          {addrState === 'ok' && <span className="bench-add-multi"> auto-filled — edit if needed</span>}
        </label>
        <input
          id="bench-address"
          className="bench-add-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Domplein 9"
          maxLength={120}
        />

        <div className="bench-add-row">
          <div className="bench-add-row-col">
            <label className="bench-add-label" htmlFor="bench-postal">Postal code</label>
            <input
              id="bench-postal"
              className="bench-add-input"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g. 3512 JE"
              maxLength={16}
            />
          </div>
          <div className="bench-add-row-col">
            <label className="bench-add-label" htmlFor="bench-city">City / area</label>
            <input
              id="bench-city"
              className="bench-add-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Utrecht"
              maxLength={60}
            />
          </div>
        </div>

        <label className="bench-add-label" htmlFor="bench-desc">Description</label>
        <textarea
          id="bench-desc"
          className="bench-add-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What makes this spot good? View, shade, who it suits…"
          rows={4}
          maxLength={600}
        />

        {error && <p className="bench-add-error">{error}</p>}

        <button
          type="button"
          className="btn-primary bench-add-submit"
          onClick={save}
          disabled={submitting || !coords || !title.trim() || categories.length === 0}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </main>
  )
}
