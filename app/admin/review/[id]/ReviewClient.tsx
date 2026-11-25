'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiGet, apiPost, ApiError } from '@/lib/apiFetch'
import { StopsMap } from '@/components/studio/StopsMap'
import { LANG_LABEL, STATUS_LABEL, date, problemText } from '@/components/studio/studioText'
import { cityCenter } from '@/lib/cityGeo'
import type { DraftContent, DraftProblem } from '@/lib/huntDraft'
import type { CreatorProfile, HuntDraftStatus } from '@/types'

interface DraftView {
  id: string; ownerUid: string; status: HuntDraftStatus; live: boolean; publishedVersion: number
  rejectionReason: string | null; content: DraftContent; submittedAt: number | null
}
interface CityOption { id: string; name: string }

/** /admin/review/[id] — check a creator's hunt, then approve (translate + publish) or reject. */
export function ReviewClient({ id }: { id: string }) {
  const { user, loading, signIn } = useAuth()
  const registered = !!user && !user.isAnonymous
  const [data, setData] = useState<{ draft: DraftView; creator: CreatorProfile | null; problems: DraftProblem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const [cityId, setCityId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string; problems?: DraftProblem[] } | null>(null)

  useEffect(() => {
    if (!registered) return
    apiGet<NonNullable<typeof data>>(`/api/admin/review/${id}`)
      .then(d => { setData(d); setCityId(d.draft.content.cityId ?? '') })
      .catch(e => setError(e instanceof ApiError && e.status === 403 ? 'This account has no admin access.' : 'Could not load this hunt.'))
    fetch('/api/cities').then(r => r.json()).then(l => setCities(Array.isArray(l) ? l : [])).catch(() => {})
  }, [registered, id])

  const c = data?.draft.content
  const center = useMemo(() => {
    const s = c?.stops.find(x => x.lat !== null && x.lng !== null)
    return s ? { lat: s.lat!, lng: s.lng! } : (c?.cityId && cityCenter({ id: c.cityId })) || { lat: 52.09, lng: 5.12 }
  }, [c])
  const mapStops = useMemo(() => c?.stops.map((s, i) => ({ id: s.id, n: i + 1, lat: s.lat, lng: s.lng })) ?? [], [c])

  if (loading) return <main className="page-center"><div className="spinner" role="status" aria-label="Loading" /></main>
  if (!registered) return <main className="page-center"><button type="button" className="btn-primary" onClick={signIn}>Sign in</button></main>
  if (error) return <main className="page-center"><p className="flow-page-sub">{error}</p></main>
  if (!data || !c) return <main className="page-center"><div className="spinner" role="status" aria-label="Loading" /></main>

  const { draft, creator, problems } = data

  async function approve() {
    if (!cityId) { setResult({ kind: 'error', text: 'Choose the city first (create it in Firestore if it is new).' }); return }
    setBusy('approve')
    setResult({ kind: 'ok', text: 'Translating into five languages and publishing… this can take a minute or two.' })
    try {
      const r = await apiPost<{ active: boolean }>(`/api/admin/review/${id}`, { action: 'approve', cityId })
      setData(d => d ? { ...d, draft: { ...d.draft, status: 'approved', live: true, publishedVersion: d.draft.publishedVersion + 1 } } : d)
      setResult({ kind: 'ok', text: r.active ? 'Approved and live.' : 'Approved. It will be listed once the creator finishes their Stripe payout setup.' })
    } catch (e) {
      const probs = e instanceof ApiError && Array.isArray(e.data?.problems) ? e.data.problems as DraftProblem[] : undefined
      setResult({ kind: 'error', text: probs ? 'Not published: fix these first (or reject with these notes).' : `Approval failed${e instanceof ApiError ? ` (${e.code})` : ''}.`, problems: probs })
    } finally {
      setBusy(null)
    }
  }

  async function reject() {
    if (reason.trim().length < 5) { setResult({ kind: 'error', text: 'Write what the creator should change.' }); return }
    setBusy('reject')
    try {
      await apiPost(`/api/admin/review/${id}`, { action: 'reject', reason })
      setData(d => d ? { ...d, draft: { ...d.draft, status: 'rejected', rejectionReason: reason } } : d)
      setResult({ kind: 'ok', text: 'Sent back to the creator with your notes.' })
    } catch {
      setResult({ kind: 'error', text: 'Could not reject. Try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="studio">
      <div className="container studio-wrap">
        <a className="back-link" href="/admin?tab=reviews">← Reviews</a>
        <header className="studio-head">
          <div>
            <p className="studio-eyebrow">Review · <span className={`studio-badge is-${draft.status}`}>{STATUS_LABEL[draft.status]}</span></p>
            <h1 className="studio-title">{c.title || 'Untitled'}</h1>
            <p className="studio-sub">
              By {creator ? <a href={`/creators/${creator.slug}`}>{creator.displayName}</a> : 'unknown'} ({creator?.country.toUpperCase()}, Stripe {creator?.chargesEnabled ? 'ready' : 'not ready'})
              {' '}· written in {LANG_LABEL[c.sourceLang]} · {c.tourType === 'tour' ? `walking tour (${c.tourCategory})` : `hunt, ${c.difficulty}`}
              {' '}· {c.stops.length} stops · {c.durationMin} min · {c.distanceKm} km · sent {date(draft.submittedAt)}
              {draft.publishedVersion > 0 ? ` · version ${draft.publishedVersion} is published` : ''}
            </p>
          </div>
        </header>

        {problems.length > 0 && (
          <div className="studio-card studio-problems">
            <h2 className="studio-h2">Automatic checks ({problems.length})</h2>
            <ul>{problems.map((p, i) => <li key={i}>{p.where === 'hunt' ? 'Hunt' : `Stop ${p.where}`}: {problemText(p)}</li>)}</ul>
          </div>
        )}

        <section className="studio-card">
          <h2 className="studio-h2">Description</h2>
          <p className="admin-pre">{c.description}</p>
          {c.coverImageUrl && <p><a href={c.coverImageUrl} target="_blank" rel="noopener noreferrer">Cover photo</a></p>}
          <StopsMap center={center} stops={mapStops} className="studio-map admin-map" />
        </section>

        <section className="studio-card">
          <h2 className="studio-h2">Stops (with answers)</h2>
          <ol className="admin-stops">
            {c.stops.map(s => (
              <li key={s.id}>
                <h3 className="studio-h3">{s.icon} {s.locationName} <span className="studio-hint">— {s.theme} · r={s.radiusM} m · {s.lat}, {s.lng}</span></h3>
                <dl className="admin-dl">
                  <dt>Riddle</dt><dd className="admin-pre">{s.riddle}</dd>
                  {(s.hint1 || s.hint2) && <><dt>Hints</dt><dd>1) {s.hint1}<br />2) {s.hint2}</dd></>}
                  <dt>Fun fact</dt><dd className="admin-pre">{s.funFact}</dd>
                  {s.puzzle && <>
                    <dt>Puzzle ({s.puzzle.type}{s.puzzle.scheme ? `, ${s.puzzle.scheme}` : ''})</dt>
                    <dd>{s.puzzle.prompt}<br /><strong>Answer:</strong> {s.puzzle.answers.join(' | ')}<br /><em>Hint:</em> {s.puzzle.hint}<br /><em>Why:</em> {s.puzzle.explain}</dd>
                  </>}
                  {s.trivia && <>
                    <dt>Quiz</dt>
                    <dd>{s.trivia.question}<br />{s.trivia.options.map((o, i) => <span key={i} className={i === s.trivia!.correctIndex ? 'admin-correct' : ''}>{String.fromCharCode(65 + i)}) {o}{' '}</span>)}<br /><em>{s.trivia.explain}</em></dd>
                  </>}
                </dl>
              </li>
            ))}
          </ol>
        </section>

        <section className="studio-card admin-decide">
          <h2 className="studio-h2">Decision</h2>
          <p className="studio-hint">Check that every stop is public, safe and reachable, facts are right, and nothing is copied. Approving translates the hunt into the five other languages with Claude and publishes it.</p>
          <div className="studio-grid">
            <label className="studio-field">
              <span className="bench-add-label">City {c.cityRequest ? `(creator asked for “${c.cityRequest}”)` : ''}</span>
              <select className="bench-add-input" value={cityId} onChange={e => setCityId(e.target.value)}>
                <option value="">Choose…</option>
                {cities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <div className="studio-inline">
            <button type="button" className="btn-primary" onClick={approve} disabled={!!busy}>{busy === 'approve' ? 'Publishing…' : 'Approve and publish'}</button>
          </div>
          <label className="studio-field">
            <span className="bench-add-label">Or send back with notes</span>
            <textarea className="bench-add-textarea" rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="What should the creator change?" />
          </label>
          <button type="button" className="btn-secondary" onClick={reject} disabled={!!busy}>Send back</button>
          {result && (
            <div className={result.kind === 'ok' ? 'studio-note is-ok' : 'creator-error'} role={result.kind === 'ok' ? 'status' : 'alert'}>
              {result.text}
              {result.problems && <ul>{result.problems.map((p, i) => <li key={i}>{p.where === 'hunt' ? 'Hunt' : `Stop ${p.where}`}: {problemText(p)}</li>)}</ul>}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
