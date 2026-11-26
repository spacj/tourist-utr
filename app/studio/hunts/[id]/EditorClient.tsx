'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch, apiGet, apiPost, ApiError } from '@/lib/apiFetch'
import { StopsMap } from '@/components/studio/StopsMap'
import { LANG_LABEL, STATUS_LABEL, problemText, uploadCreatorImage } from '@/components/studio/studioText'
import { cityCenter } from '@/lib/cityGeo'
import { CIPHER_SCHEMES, encode, scramble } from '@/lib/cipher'
import {
  ALL_LANGS, CODED_PUZZLES, CREATOR_PUZZLE_TYPES, LIMITS, TOUR_CATEGORIES, emptyStop,
  type CreatorPuzzleType, type DraftContent, type DraftProblem, type DraftPuzzle, type DraftStop, type DraftTrivia,
} from '@/lib/huntDraft'
import type { HuntDraftStatus } from '@/types'

interface DraftView {
  id: string
  status: HuntDraftStatus
  live: boolean
  publishedVersion: number
  rejectionReason: string | null
  content: DraftContent
}
interface CityOption { id: string; name: string; country?: string }

const PUZZLE_LABEL: Record<CreatorPuzzleType, string> = {
  cipher: 'Cipher (coded name)',
  anagram: 'Anagram (scrambled letters)',
  reverse: 'Reversed word',
  wordplay: 'Wordplay riddle',
  logic: 'Logic puzzle',
  numbers: 'Number puzzle',
  rebus: 'Rebus / picture words',
}
const SCHEME_LABEL: Record<string, string> = {
  atbash: 'Atbash (A↔Z, B↔Y…)', a1z26: 'Numbers (A=1, B=2…)',
  'caesar:1': 'Shift by 1', 'caesar:2': 'Shift by 2', 'caesar:3': 'Shift by 3', 'caesar:4': 'Shift by 4',
  'caesar:5': 'Shift by 5', 'caesar:7': 'Shift by 7', 'caesar:13': 'Shift by 13 (ROT13)',
}
const DEFAULT_CENTER = { lat: 52.0907, lng: 5.1214 }

const newStopId = () => `s_${Math.random().toString(36).slice(2, 10)}`

/** The code a coded puzzle must show, or null. */
function codeFor(p: DraftPuzzle): string | null {
  const answer = p.answers[0]
  if (!answer) return null
  try {
    if (p.type === 'cipher' && p.scheme) return encode(p.scheme, answer)
    if (p.type === 'reverse') return encode('reverse', answer)
    if (p.type === 'anagram') return scramble(answer)
  } catch { /* invalid scheme */ }
  return null
}

export function EditorClient({ id }: { id: string }) {
  const { user, loading, signIn } = useAuth()
  const registered = !!user && !user.isAnonymous
  const [draft, setDraft] = useState<DraftView | null>(null)
  const [content, setContent] = useState<DraftContent | null>(null)
  const [problems, setProblems] = useState<DraftProblem[]>([])
  const [cities, setCities] = useState<CityOption[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<DraftContent | null>(null)
  contentRef.current = content

  useEffect(() => {
    if (!registered) return
    apiGet<{ draft: DraftView; problems: DraftProblem[] }>(`/api/studio/hunts/${id}`)
      .then(r => {
        setDraft(r.draft)
        setContent(r.draft.content)
        setProblems(r.problems)
        setSelected(r.draft.content.stops[0]?.id ?? null)
      })
      .catch(() => setNotFound(true))
    fetch('/api/cities').then(r => r.json()).then((list: CityOption[]) => setCities(Array.isArray(list) ? list : [])).catch(() => {})
  }, [registered, id])

  const persist = useCallback(async () => {
    const c = contentRef.current
    if (!c) return false
    setSave('saving')
    try {
      const res = await apiFetch(`/api/studio/hunts/${id}`, { method: 'PATCH', body: JSON.stringify(c) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError(res.status, data?.error ?? 'save_failed', data)
      setDraft(data.draft)
      setProblems(data.problems)
      setSave(s => (s === 'saving' ? 'saved' : s))
      return true
    } catch (e) {
      setSave('error')
      const code = e instanceof ApiError ? e.code : ''
      setMessage({ kind: 'error', text: code === 'text_too_long' ? 'A text is too long.' : 'Could not save. Check your connection and try again.' })
      return false
    }
  }, [id])

  // Autosave 1.5 s after the last change.
  const update = useCallback((fn: (c: DraftContent) => DraftContent) => {
    setContent(c => (c ? fn(c) : c))
    setSave('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void persist() }, 1500)
  }, [persist])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [save])

  const setStop = useCallback((stopId: string, patch: Partial<DraftStop>) => {
    update(c => ({ ...c, stops: c.stops.map(s => (s.id === stopId ? { ...s, ...patch } : s)) }))
  }, [update])

  const center = useMemo(() => {
    const placed = content?.stops.find(s => s.lat !== null && s.lng !== null)
    if (placed) return { lat: placed.lat!, lng: placed.lng! }
    return (content?.cityId && cityCenter({ id: content.cityId })) || DEFAULT_CENTER
  }, [content?.cityId, content?.stops])
  const mapStops = useMemo(() => content?.stops.map((s, i) => ({ id: s.id, n: i + 1, lat: s.lat, lng: s.lng })) ?? [], [content?.stops])
  const pick = useCallback((lat: number, lng: number) => { if (selected) setStop(selected, { lat, lng }) }, [selected, setStop])

  if (loading) return <main className="page-center"><div className="spinner" role="status" aria-label="Loading" /></main>
  if (!registered) {
    return <main className="page-center"><div className="container flow-center"><p className="flow-page-sub">Sign in with Google (or email) to edit your hunt.</p><button type="button" className="btn-primary" onClick={signIn}>Sign in</button></div></main>
  }
  if (notFound) return <main className="page-center"><div className="container flow-center"><p className="flow-page-sub">This hunt doesn’t exist or isn’t yours.</p><a className="btn-secondary" href="/studio">Back to studio</a></div></main>
  if (!draft || !content) return <main className="page-center"><div className="spinner" role="status" aria-label="Loading" /></main>

  const isTour = content.tourType === 'tour'
  const stopIndex = content.stops.findIndex(s => s.id === selected)
  const stop = stopIndex >= 0 ? content.stops[stopIndex] : null
  const huntProblems = problems.filter(p => p.where === 'hunt')
  const stopProblems = (n: number) => problems.filter(p => p.where === n)

  async function submit() {
    if (timer.current) clearTimeout(timer.current)
    if (!(await persist())) return
    try {
      await apiPost(`/api/studio/hunts/${id}/submit`, {})
      setDraft(d => (d ? { ...d, status: 'pending_review' } : d))
      setMessage({ kind: 'ok', text: 'Sent for review. We’ll email you when it’s checked, usually within a few days.' })
    } catch (e) {
      if (e instanceof ApiError && Array.isArray(e.data?.problems)) {
        setProblems(e.data.problems)
        setMessage({ kind: 'error', text: 'Almost there: fix the points listed below first.' })
      } else {
        setMessage({ kind: 'error', text: 'Could not send it for review. Please try again.' })
      }
    }
  }

  async function setLive(live: boolean) {
    try {
      await apiPost(`/api/studio/hunts/${id}/unpublish`, { live })
      setDraft(d => d ? { ...d, live, status: live ? (d.status === 'unpublished' ? 'approved' : d.status) : (d.status === 'approved' ? 'unpublished' : d.status) } : d)
      setMessage({ kind: 'ok', text: live ? 'Your hunt is listed again.' : 'Your hunt is no longer listed. Players who bought it can still play it.' })
    } catch {
      setMessage({ kind: 'error', text: 'Could not change the listing.' })
    }
  }

  async function onCover(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    try {
      const url = await uploadCreatorImage(user.uid, file, `cover-${id}`)
      update(c => ({ ...c, coverImageUrl: url }))
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message || 'Upload failed.' })
    } finally {
      setUploading(false)
    }
  }

  const addStop = () => {
    const s = emptyStop(newStopId())
    update(c => ({ ...c, stops: [...c.stops, s] }))
    setSelected(s.id)
  }
  const moveStop = (i: number, dir: -1 | 1) => update(c => {
    const stops = [...c.stops]
    const j = i + dir
    if (j < 0 || j >= stops.length) return c
    ;[stops[i], stops[j]] = [stops[j], stops[i]]
    return { ...c, stops }
  })
  const removeStop = (stopId: string) => {
    if (!window.confirm('Remove this stop?')) return
    update(c => ({ ...c, stops: c.stops.filter(s => s.id !== stopId) }))
    setSelected(null)
  }

  return (
    <main className="studio">
      <div className="container studio-wrap studio-editor">
        <header className="studio-head">
          <div>
            <a className="back-link" href="/studio">← Studio</a>
            <h1 className="studio-title">{content.title || 'Untitled hunt'}</h1>
            <p className="studio-sub">
              <span className={`studio-badge is-${draft.status}`}>{STATUS_LABEL[draft.status]}</span>
              {' '}{draft.publishedVersion > 0 && draft.live && draft.status !== 'approved' ? 'The approved version stays live while you edit. ' : ''}
              <span className={`studio-save is-${save}`}>{save === 'saving' ? 'Saving…' : save === 'dirty' ? 'Unsaved changes' : save === 'error' ? 'Not saved' : 'All changes saved'}</span>
            </p>
          </div>
          <div className="studio-inline">
            {draft.publishedVersion > 0 && (draft.live
              ? <button type="button" className="btn-secondary" onClick={() => setLive(false)}>Unpublish</button>
              : <button type="button" className="btn-secondary" onClick={() => setLive(true)}>List again</button>)}
            <button type="button" className="btn-primary" onClick={submit} disabled={draft.status === 'pending_review' || save === 'saving'}>
              {draft.status === 'pending_review' ? 'In review' : 'Send for review'}
            </button>
          </div>
        </header>

        {draft.status === 'rejected' && draft.rejectionReason && (
          <div className="studio-note is-warn"><strong>Changes needed:</strong> {draft.rejectionReason}</div>
        )}
        {message && <p className={message.kind === 'ok' ? 'studio-note is-ok' : 'creator-error'} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}

        {problems.length > 0 && (
          <details className="studio-card studio-problems" open={draft.status !== 'draft' || problems.length < 8}>
            <summary className="studio-h2">Still to do ({problems.length})</summary>
            <ul>
              {problems.slice(0, 40).map((p, i) => (
                <li key={i}>
                  {p.where === 'hunt' ? <strong>Hunt: </strong> : (
                    <button type="button" className="studio-link-btn" onClick={() => setSelected(content.stops[(p.where as number) - 1]?.id ?? null)}>Stop {p.where}:</button>
                  )}{' '}{problemText(p)}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* ── Hunt details ─────────────────────────────── */}
        <section className="studio-card" aria-labelledby="meta-h">
          <h2 id="meta-h" className="studio-h2">Hunt details</h2>
          {huntProblems.length > 0 && <p className="studio-hint">{huntProblems.map(problemText).join(' ')}</p>}
          <div className="studio-grid">
            <Field label="Written in">
              <select className="bench-add-input" value={content.sourceLang} disabled={draft.publishedVersion > 0}
                onChange={e => update(c => ({ ...c, sourceLang: e.target.value as DraftContent['sourceLang'] }))}>
                {ALL_LANGS.map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className="bench-add-input" value={content.tourType} onChange={e => update(c => ({ ...c, tourType: e.target.value === 'tour' ? 'tour' : 'hunt' }))}>
                <option value="hunt">Hunt (riddles and puzzles at every stop)</option>
                <option value="tour">Walking tour (stories, no puzzles)</option>
              </select>
            </Field>
          </div>
          <Field label="Title" hint={`${content.title.length}/${LIMITS.title[1]}`}>
            <input className="bench-add-input" maxLength={LIMITS.title[1]} value={content.title} onChange={e => update(c => ({ ...c, title: e.target.value }))} />
          </Field>
          <Field label="Description" hint="What players will see before buying. Mention the area, the mood and who it suits.">
            <textarea className="bench-add-textarea" rows={4} maxLength={LIMITS.description[1]} value={content.description} onChange={e => update(c => ({ ...c, description: e.target.value }))} />
          </Field>
          <div className="studio-grid">
            <Field label="City">
              <select className="bench-add-input" value={content.cityId ?? ''} onChange={e => update(c => ({ ...c, cityId: e.target.value || null, cityRequest: e.target.value ? null : c.cityRequest }))}>
                <option value="">My city isn’t listed</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}{c.country ? `, ${c.country}` : ''}</option>)}
              </select>
            </Field>
            {!content.cityId && (
              <Field label="Which city?" hint="We add the city when we approve your hunt.">
                <input className="bench-add-input" maxLength={80} value={content.cityRequest ?? ''} onChange={e => update(c => ({ ...c, cityRequest: e.target.value }))} />
              </Field>
            )}
            {isTour ? (
              <Field label="Category">
                <select className="bench-add-input" value={content.tourCategory} onChange={e => update(c => ({ ...c, tourCategory: e.target.value as DraftContent['tourCategory'] }))}>
                  {TOUR_CATEGORIES.map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Difficulty">
                <select className="bench-add-input" value={content.difficulty} onChange={e => update(c => ({ ...c, difficulty: e.target.value as DraftContent['difficulty'] }))}>
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
              </Field>
            )}
            <Field label="Duration (minutes)">
              <input className="bench-add-input" type="number" min={LIMITS.durationMin[0]} max={LIMITS.durationMin[1]} value={content.durationMin}
                onChange={e => update(c => ({ ...c, durationMin: clamp(Number(e.target.value), LIMITS.durationMin) }))} />
            </Field>
            <Field label="Distance (km)">
              <input className="bench-add-input" type="number" step="0.1" min={LIMITS.distanceKm[0]} max={LIMITS.distanceKm[1]} value={content.distanceKm}
                onChange={e => update(c => ({ ...c, distanceKm: clamp(Number(e.target.value), LIMITS.distanceKm) }))} />
            </Field>
          </div>
          <Field label="Cover photo (optional)" hint="Your own photo, JPG/PNG/WebP up to 5 MB.">
            <div className="studio-inline">
              {/* eslint-disable-next-line @next/next/no-img-element -- small preview of an uploaded file */}
              {content.coverImageUrl && <img src={content.coverImageUrl} alt="" className="studio-cover" />}
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => onCover(e.target.files?.[0])} />
              {content.coverImageUrl && <button type="button" className="studio-link-btn" onClick={() => update(c => ({ ...c, coverImageUrl: null }))}>Remove</button>}
            </div>
          </Field>
        </section>

        {/* ── Stops ────────────────────────────────────── */}
        <section className="studio-card" aria-labelledby="stops-h">
          <h2 id="stops-h" className="studio-h2">Stops ({content.stops.length})</h2>
          <p className="studio-hint">
            {isTour ? 'At least 3 stops.' : 'At least 5 stops; every stop needs a riddle, two hints and a puzzle.'}
            {' '}Select a stop, then click the map (or drag its pin) to place it.
          </p>
          <div className="studio-stops">
            <ol className="studio-stoplist">
              {content.stops.map((s, i) => (
                <li key={s.id} className={s.id === selected ? 'is-selected' : ''}>
                  <button type="button" className="studio-stop-btn" onClick={() => setSelected(s.id)}>
                    <span className="studio-stop-n">{i + 1}</span>
                    <span className="studio-stop-name">{s.locationName || 'New stop'}</span>
                    {stopProblems(i + 1).length > 0 && <span className="studio-stop-warn" aria-label={`${stopProblems(i + 1).length} things to fix`}>{stopProblems(i + 1).length}</span>}
                  </button>
                  <span className="studio-stop-move">
                    <button type="button" aria-label="Move up" onClick={() => moveStop(i, -1)} disabled={i === 0}>↑</button>
                    <button type="button" aria-label="Move down" onClick={() => moveStop(i, 1)} disabled={i === content.stops.length - 1}>↓</button>
                  </span>
                </li>
              ))}
              <li><button type="button" className="btn-secondary studio-add" onClick={addStop} disabled={content.stops.length >= LIMITS.stopsHunt[1]}>+ Add stop</button></li>
            </ol>
            <div className="studio-mapcol">
              <StopsMap center={center} stops={mapStops} selectedId={selected} onPick={pick} />
            </div>
          </div>

          {stop && (
            <StopEditor
              key={stop.id}
              n={stopIndex + 1}
              stop={stop}
              isTour={isTour}
              problems={stopProblems(stopIndex + 1)}
              onChange={patch => setStop(stop.id, patch)}
              onRemove={() => removeStop(stop.id)}
            />
          )}
        </section>
      </div>
    </main>
  )
}

const clamp = (n: number, [min, max]: readonly [number, number]) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min)

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="studio-field">
      <span className="bench-add-label">{label}</span>
      {children}
      {hint && <span className="studio-hint">{hint}</span>}
    </label>
  )
}

function StopEditor({ n, stop, isTour, problems, onChange, onRemove }: {
  n: number; stop: DraftStop; isTour: boolean; problems: DraftProblem[]
  onChange: (patch: Partial<DraftStop>) => void; onRemove: () => void
}) {
  const t = stop.trivia
  const p = stop.puzzle
  const setTrivia = (patch: Partial<DraftTrivia>) => onChange({ trivia: { ...(t ?? { question: '', options: ['', '', '', ''], correctIndex: 0, explain: '' }), ...patch } })
  const setPuzzle = (patch: Partial<DraftPuzzle>) => onChange({ puzzle: { ...(p ?? { type: 'wordplay', prompt: '', answers: [], hint: '', explain: '' }), ...patch } })
  const code = p ? codeFor(p) : null
  const coded = !!p && CODED_PUZZLES.includes(p.type)

  return (
    <div className="studio-stop">
      <div className="studio-stop-head">
        <h3 className="studio-h3">Stop {n}{stop.locationName ? `: ${stop.locationName}` : ''}</h3>
        <button type="button" className="studio-link-btn" onClick={onRemove}>Remove stop</button>
      </div>
      {problems.length > 0 && <p className="studio-hint is-warn">{problems.map(problemText).join(' ')}</p>}
      <p className="studio-hint">
        {stop.lat !== null && stop.lng !== null ? `Location: ${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}` : 'Not on the map yet: click the map to place this stop.'}
      </p>

      <div className="studio-grid">
        <Field label="Place name" hint="Revealed when players arrive."><input className="bench-add-input" maxLength={LIMITS.short} value={stop.locationName} onChange={e => onChange({ locationName: e.target.value })} /></Field>
        <Field label="Theme" hint="A few words, e.g. “Medieval giant”."><input className="bench-add-input" maxLength={LIMITS.short} value={stop.theme} onChange={e => onChange({ theme: e.target.value })} /></Field>
        <Field label="Icon"><input className="bench-add-input" maxLength={4} value={stop.icon} onChange={e => onChange({ icon: e.target.value })} /></Field>
        <Field label="Arrival radius (m)" hint="How close players must get. 40–200 m.">
          <input className="bench-add-input" type="number" min={LIMITS.radiusM[0]} max={LIMITS.radiusM[1]} value={stop.radiusM} onChange={e => onChange({ radiusM: clamp(Number(e.target.value), LIMITS.radiusM) })} />
        </Field>
      </div>
      <Field label={isTour ? 'Directions / intro' : 'Riddle'} hint={isTour ? 'How to get here and what to look for.' : 'Leads players to the place without naming it.'}>
        <textarea className="bench-add-textarea" rows={3} maxLength={LIMITS.long} value={stop.riddle} onChange={e => onChange({ riddle: e.target.value })} />
      </Field>
      <div className="studio-grid">
        <Field label={isTour ? 'Tip 1 (optional)' : 'Hint 1'} hint="A neighbourhood-level nudge."><textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.medium} value={stop.hint1} onChange={e => onChange({ hint1: e.target.value })} /></Field>
        <Field label={isTour ? 'Tip 2 (optional)' : 'Hint 2'} hint="Street-level: almost gives it away."><textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.medium} value={stop.hint2} onChange={e => onChange({ hint2: e.target.value })} /></Field>
      </div>
      <Field label="Fun fact / story" hint="Shown on arrival. Keep facts accurate.">
        <textarea className="bench-add-textarea" rows={3} maxLength={LIMITS.long} value={stop.funFact} onChange={e => onChange({ funFact: e.target.value })} />
      </Field>

      <fieldset className="studio-fieldset">
        <legend className="bench-add-label">
          <label className="creator-check"><input type="checkbox" checked={!!p} onChange={e => onChange({ puzzle: e.target.checked ? { type: 'wordplay', prompt: '', answers: [], hint: '', explain: '' } : null })} />
            Puzzle {isTour ? '(optional)' : '(required for hunts)'}</label>
        </legend>
        {p && <>
          <div className="studio-grid">
            <Field label="Puzzle type">
              <select className="bench-add-input" value={p.type} onChange={e => {
                const type = e.target.value as CreatorPuzzleType
                setPuzzle({ type, scheme: type === 'cipher' ? (p.scheme && p.scheme !== 'reverse' ? p.scheme : 'atbash') : type === 'reverse' ? 'reverse' : undefined })
              }}>
                {CREATOR_PUZZLE_TYPES.map(t => <option key={t} value={t}>{PUZZLE_LABEL[t]}</option>)}
              </select>
            </Field>
            {p.type === 'cipher' && (
              <Field label="Cipher">
                <select className="bench-add-input" value={p.scheme ?? 'atbash'} onChange={e => setPuzzle({ scheme: e.target.value })}>
                  {CIPHER_SCHEMES.map(s => <option key={s} value={s}>{SCHEME_LABEL[s]}</option>)}
                </select>
              </Field>
            )}
            <Field label="Answer" hint={coded ? 'Letters only, e.g. the place name.' : 'The word players type.'}>
              <input className="bench-add-input" maxLength={LIMITS.short} value={p.answers[0] ?? ''} onChange={e => setPuzzle({ answers: [e.target.value, ...p.answers.slice(1)] })} />
            </Field>
            {!coded && (
              <Field label="Other accepted answers" hint="Separate with commas.">
                <input className="bench-add-input" value={p.answers.slice(1).join(', ')} onChange={e => setPuzzle({ answers: [p.answers[0] ?? '', ...e.target.value.split(',').map(a => a.trim()).filter(Boolean)] })} />
              </Field>
            )}
          </div>
          {coded && code && (
            <p className="studio-hint">
              Code to show players: <code className="studio-code">{code}</code>{' '}
              <button type="button" className="studio-link-btn" onClick={() => setPuzzle({ prompt: p.prompt.includes(code) ? p.prompt : `${p.prompt.trim()} ${code}`.trim() })}>Generate code</button>
            </p>
          )}
          <Field label="Puzzle text" hint={coded ? 'The instruction plus the code, e.g. “Decode the name of this stop: WLNGLIVM”.' : 'The puzzle players solve.'}>
            <textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.medium} value={p.prompt} onChange={e => setPuzzle({ prompt: e.target.value })} />
          </Field>
          <div className="studio-grid">
            <Field label="Puzzle hint"><textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.medium} value={p.hint} onChange={e => setPuzzle({ hint: e.target.value })} /></Field>
            <Field label="Explanation" hint="Shown after solving."><textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.long} value={p.explain} onChange={e => setPuzzle({ explain: e.target.value })} /></Field>
          </div>
        </>}
      </fieldset>

      <fieldset className="studio-fieldset">
        <legend className="bench-add-label">
          <label className="creator-check"><input type="checkbox" checked={!!t} onChange={e => onChange({ trivia: e.target.checked ? { question: '', options: ['', '', '', ''], correctIndex: 0, explain: '' } : null })} />
            Quiz question (optional)</label>
        </legend>
        {t && <>
          <Field label="Question"><input className="bench-add-input" maxLength={LIMITS.medium} value={t.question} onChange={e => setTrivia({ question: e.target.value })} /></Field>
          <div className="studio-options">
            {t.options.map((o, i) => (
              <label key={i} className="studio-option">
                <input type="radio" name={`correct-${stop.id}`} checked={t.correctIndex === i} onChange={() => setTrivia({ correctIndex: i })} aria-label={`Option ${i + 1} is correct`} />
                <input className="bench-add-input" maxLength={LIMITS.short} placeholder={`Option ${i + 1}`} value={o}
                  onChange={e => setTrivia({ options: t.options.map((x, j) => (j === i ? e.target.value : x)) })} />
              </label>
            ))}
          </div>
          <p className="studio-hint">Select the correct option with the round button.</p>
          <Field label="Explanation"><textarea className="bench-add-textarea" rows={2} maxLength={LIMITS.long} value={t.explain} onChange={e => setTrivia({ explain: e.target.value })} /></Field>
        </>}
      </fieldset>
    </div>
  )
}
