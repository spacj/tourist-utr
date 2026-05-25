'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { SpotKind, SPOT_KINDS } from '@/types'

/**
 * Admin-only form to drop a spot (bench or fountain) at the editor's current
 * GPS position, parameterized by kind. POSTs to /api/benches (which re-checks
 * the admin allowlist server-side). On success, redirects to the spot's page.
 */
export function SpotAddForm({ kind }: { kind: SpotKind }) {
  const cfg = SPOT_KINDS[kind]
  const base = cfg.urlBase
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
  const [categories, setCategories] = useState<string[]>([cfg.categories[0].id])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (id: string) =>
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

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
          kind,
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
        window.location.href = `/${base}/${data.slug}`
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
          <a href={`/${base}`} className="back-link">← {cfg.copy.eyebrow}</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>Sign in with an editor account to add a {cfg.copy.nounSingular}.</p>
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
          <a href={`/${base}`} className="back-link">← {cfg.copy.eyebrow}</a>
          <div className="empty-card" style={{ marginTop: 16 }}>
            <p>Only editors can add {cfg.copy.nounPlural}. If you think you should have access, get in touch.</p>
          </div>
        </div>
      </main>
    )
  }

  const titlePlaceholder = kind === 'fountain' ? 'e.g. Drinking fountain on the Neude' : 'e.g. Sunset bench above the Dom'

  return (
    <main className="page-center">
      <div className="container bench-add">
        <a href={`/${base}`} className="back-link">← {cfg.copy.eyebrow}</a>
        <h1 className="bench-add-title">{cfg.copy.addTitle}</h1>
        <p className="bench-add-sub">{cfg.copy.addSub}</p>

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

        {/* Category picker — pick as many as apply */}
        <label className="bench-add-label">{cfg.copy.typeLabel} <span className="bench-add-multi">pick all that apply</span></label>
        <div className="bench-add-cats">
          {cfg.categories.map(cat => {
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

        <label className="bench-add-label" htmlFor="spot-title">Title</label>
        <input
          id="spot-title"
          className="bench-add-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder}
          maxLength={80}
        />

        <label className="bench-add-label" htmlFor="spot-address">
          Street &amp; number
          {addrState === 'looking' && <span className="bench-add-multi"> looking up…</span>}
          {addrState === 'ok' && <span className="bench-add-multi"> auto-filled — edit if needed</span>}
        </label>
        <input
          id="spot-address"
          className="bench-add-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Domplein 9"
          maxLength={120}
        />

        <div className="bench-add-row">
          <div className="bench-add-row-col">
            <label className="bench-add-label" htmlFor="spot-postal">Postal code</label>
            <input
              id="spot-postal"
              className="bench-add-input"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g. 3512 JE"
              maxLength={16}
            />
          </div>
          <div className="bench-add-row-col">
            <label className="bench-add-label" htmlFor="spot-city">City / area</label>
            <input
              id="spot-city"
              className="bench-add-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Utrecht"
              maxLength={60}
            />
          </div>
        </div>

        <label className="bench-add-label" htmlFor="spot-desc">Description</label>
        <textarea
          id="spot-desc"
          className="bench-add-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={kind === 'fountain' ? 'Is it drinkable? Bottle-friendly? Always on?…' : 'What makes this spot good? View, shade, who it suits…'}
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
          {submitting ? 'Saving…' : `Publish ${cfg.copy.nounSingular}`}
        </button>
        {!coords && <p className="bench-add-hint">Waiting for your location before you can publish.</p>}
      </div>
    </main>
  )
}
