'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { BENCH_CATEGORIES } from '@/types'

/**
 * Admin-only form to drop a bench at the editor's current GPS position.
 * Captures live coordinates, lets them tweak title/description/category,
 * then POSTs to /api/benches (which re-checks the admin allowlist server
 * side). On success, redirects to the new bench's SEO page.
 */
export default function AddBenchPage() {
  const { user, loading, signIn } = useAuth()
  const isAdmin = useIsAdmin()

  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addrState, setAddrState] = useState<'idle' | 'looking' | 'ok' | 'error'>('idle')
  const [categories, setCategories] = useState<string[]>([BENCH_CATEGORIES[0].id])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (id: string) =>
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  // Reverse-geocode the captured point into a street line via OpenStreetMap's
  // Nominatim. Best-effort: the admin can still edit/clear the fields by hand.
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
      const line = [road, houseNumber].filter(Boolean).join(' ').trim()
      setAddress(line)
      setPostalCode(a.postcode || '')
      const locality = a.city || a.town || a.village || a.municipality || a.suburb || ''
      if (locality) setCity(prev => prev || locality)
      setAddrState('ok')
    } catch {
      setAddrState('error')
    }
  }

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState('error'); setGeoError('Geolocation is not available in this browser.')
      return
    }
    setGeoState('locating'); setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
        setGeoState('ok')
        reverseGeocode(p.coords.latitude, p.coords.longitude)
      },
      (err) => {
        setGeoState('error')
        setGeoError(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable it to drop a pin here.'
          : 'Could not get your location. Try again outdoors.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // Kick off a location request as soon as an admin lands on the page.
  useEffect(() => {
    if (isAdmin) locate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  const submit = async () => {
    if (!user || !coords || !title.trim() || categories.length === 0 || submitting) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/benches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid,
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

  if (loading) {
    return <main className="page-center"><div className="spinner" /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container bench-add">
          <a href="/benches" className="back-link">← Benches</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>Sign in with an editor account to add a bench.</p>
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
            <p>Only editors can add benches. If you think you should have access, get in touch.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container bench-add">
        <a href="/benches" className="back-link">← Benches</a>
        <h1 className="bench-add-title">Add a bench</h1>
        <p className="bench-add-sub">Drops a pin at your current location. Stand on the spot for the most accurate position.</p>

        {/* GPS status */}
        <div className={`bench-add-geo bench-add-geo-${geoState}`}>
          {geoState === 'locating' && <><span className="spinner-mini-dark" aria-hidden /> Getting your location…</>}
          {geoState === 'ok' && coords && (
            <>
              <span aria-hidden>📍</span>
              <span>Located: <code>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</code> (±{Math.round(coords.accuracy)}m)</span>
              <button type="button" className="bench-add-relocate" onClick={locate}>Update</button>
            </>
          )}
          {geoState === 'error' && <><span aria-hidden>⚠️</span> <span>{geoError}</span> <button type="button" className="bench-add-relocate" onClick={locate}>Retry</button></>}
          {geoState === 'idle' && <button type="button" className="bench-add-relocate" onClick={locate}>Use my location</button>}
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
          onClick={submit}
          disabled={submitting || !coords || !title.trim() || categories.length === 0}
        >
          {submitting ? 'Saving…' : 'Publish bench'}
        </button>
        {!coords && <p className="bench-add-hint">Waiting for your location before you can publish.</p>}
      </div>
    </main>
  )
}
