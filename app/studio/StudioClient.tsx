'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiGet, apiPost, apiFetch } from '@/lib/apiFetch'
import { LANG_LABEL, STATUS_LABEL, date, eur } from '@/components/studio/studioText'
import { ALL_LANGS } from '@/lib/huntDraft'
import { CREATOR_HUNT_PRICE_EUROS, type CreatorProfile, type HuntDraftStatus, type Sale } from '@/types'

interface DraftSummary {
  id: string; title: string; cityId: string | null; tourType: string; stopCount: number
  status: HuntDraftStatus; live: boolean; publishedVersion: number; rejectionReason: string | null; updatedAt: number | null
}
type StudioSale = Omit<Sale, 'buyerUid' | 'currency' | 'stripeCheckoutSessionId' | 'stripePaymentIntentId'>

/** /studio — a creator's hunts, payout setup and earnings. */
export function StudioClient() {
  const { user, loading, signIn } = useAuth()
  const registered = !!user && !user.isAnonymous
  const [creator, setCreator] = useState<CreatorProfile | null | undefined>(undefined)
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null)
  const [sales, setSales] = useState<{ sales: StudioSale[]; totals: { sales: number; refunds: number; grossCents: number; earnedCents: number } } | null>(null)
  const [newLang, setNewLang] = useState('en')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { creator: c } = await apiGet<{ creator: CreatorProfile | null }>('/api/creator/profile')
      setCreator(c)
      if (!c) return
      const [d, s] = await Promise.all([
        apiGet<{ drafts: DraftSummary[] }>('/api/studio/hunts'),
        apiGet<NonNullable<typeof sales>>('/api/studio/sales'),
      ])
      setDrafts(d.drafts)
      setSales(s)
    } catch {
      setError('Could not load your studio. Please refresh.')
    }
  }, [])

  useEffect(() => {
    if (!registered) return
    const params = new URLSearchParams(window.location.search)
    const stripeFlag = params.get('stripe')
    ;(async () => {
      if (stripeFlag === 'return') {
        await apiPost('/api/creator/stripe', { action: 'refresh' }).catch(() => {})
      } else if (stripeFlag === 'refresh') {
        // The onboarding link expired: start a fresh one.
        try {
          const { url } = await apiPost<{ url: string }>('/api/creator/stripe', { action: 'onboard' })
          window.location.href = url
          return
        } catch { /* fall through to the studio */ }
      }
      if (stripeFlag) window.history.replaceState(null, '', '/studio')
      await load()
    })()
  }, [registered, load])

  async function stripeAction(action: 'onboard' | 'dashboard') {
    setBusy(action)
    setError(null)
    try {
      const { url } = await apiPost<{ url: string }>('/api/creator/stripe', { action })
      window.location.href = url
    } catch {
      setBusy(null)
      setError('Stripe is not available right now. Please try again later.')
    }
  }

  async function newHunt() {
    setBusy('new')
    try {
      const { id } = await apiPost<{ id: string }>('/api/studio/hunts', { sourceLang: newLang })
      window.location.href = `/studio/hunts/${id}`
    } catch {
      setBusy(null)
      setError('Could not create a new hunt.')
    }
  }

  async function removeDraft(id: string) {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    const res = await apiFetch(`/api/studio/hunts/${id}`, { method: 'DELETE' })
    if (res.ok) setDrafts(d => d?.filter(x => x.id !== id) ?? null)
  }

  if (loading || (registered && creator === undefined)) {
    return <main className="page-center" aria-busy="true"><div className="spinner" role="status" aria-label="Loading" /></main>
  }
  if (!registered) {
    return (
      <main className="page-center">
        <div className="container flow-center">
          <h1 className="flow-page-title">Creator studio</h1>
          <p className="flow-page-sub">Sign in to build and sell your own hunts.</p>
          <button type="button" className="btn-primary" onClick={signIn}>Sign in</button>
        </div>
      </main>
    )
  }
  if (!creator) {
    return (
      <main className="page-center">
        <div className="container flow-center">
          <h1 className="flow-page-title">Creator studio</h1>
          <p className="flow-page-sub">Set up your creator profile first.</p>
          <a className="btn-primary" href="/create">Become a creator</a>
        </div>
      </main>
    )
  }

  const payoutState = !creator.stripeAccountId ? 'none' : creator.chargesEnabled ? 'ready' : 'incomplete'

  return (
    <main className="studio">
      <div className="container studio-wrap">
        <header className="studio-head">
          <div>
            <p className="studio-eyebrow">Creator studio</p>
            <h1 className="studio-title">{creator.displayName}</h1>
            <p className="studio-sub">
              Creator hunts sell for {eur(CREATOR_HUNT_PRICE_EUROS * 100)}. You get the price excluding VAT, minus our 20% commission and a 3% payment fee.
              {' '}<a href="/create">Edit profile</a> · <a href={`/creators/${creator.slug}`}>Public page</a>
            </p>
          </div>
          <div className="studio-new">
            <label className="studio-label" htmlFor="new-lang">Write a new hunt in</label>
            <div className="studio-inline">
              <select id="new-lang" className="bench-add-input" value={newLang} onChange={e => setNewLang(e.target.value)}>
                {ALL_LANGS.map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
              <button type="button" className="btn-primary" onClick={newHunt} disabled={busy === 'new'}>New hunt</button>
            </div>
          </div>
        </header>

        {error && <p className="creator-error" role="alert">{error}</p>}

        <section className={`studio-card studio-payouts is-${payoutState}`} aria-labelledby="payouts-h">
          <h2 id="payouts-h" className="studio-h2">Payouts</h2>
          {payoutState === 'none' && <>
            <p>Connect a Stripe account so players can buy your hunts and your share reaches your bank account. Approved hunts are only listed once this is done.</p>
            <button type="button" className="btn-primary" onClick={() => stripeAction('onboard')} disabled={!!busy}>Set up payouts</button>
          </>}
          {payoutState === 'incomplete' && <>
            <p>Stripe still needs some details before you can be paid. Your approved hunts stay hidden until then.</p>
            <button type="button" className="btn-primary" onClick={() => stripeAction('onboard')} disabled={!!busy}>Finish payout setup</button>
          </>}
          {payoutState === 'ready' && <>
            <p>Payouts are active{creator.payoutsEnabled ? '' : ' (Stripe is still verifying your bank account)'}. Your share of each sale goes straight to your Stripe account.</p>
            <button type="button" className="btn-secondary" onClick={() => stripeAction('dashboard')} disabled={!!busy}>Open Stripe dashboard</button>
          </>}
        </section>

        <section className="studio-card" aria-labelledby="earn-h">
          <h2 id="earn-h" className="studio-h2">Earnings</h2>
          <div className="studio-tiles">
            <div className="studio-tile"><span className="studio-tile-n">{eur(sales?.totals.earnedCents ?? 0)}</span><span className="studio-tile-l">Your share</span></div>
            <div className="studio-tile"><span className="studio-tile-n">{sales?.totals.sales ?? 0}</span><span className="studio-tile-l">Sales</span></div>
            <div className="studio-tile"><span className="studio-tile-n">{eur(sales?.totals.grossCents ?? 0)}</span><span className="studio-tile-l">Paid by players</span></div>
          </div>
          {sales && sales.sales.length > 0 ? (
            <table className="studio-table">
              <thead><tr><th>Date</th><th>Hunt</th><th className="num">Price</th><th className="num">Your share</th><th>Status</th></tr></thead>
              <tbody>
                {sales.sales.slice(0, 25).map(s => (
                  <tr key={s.id}>
                    <td>{date(s.createdAt)}</td>
                    <td>{s.huntTitle}</td>
                    <td className="num">{eur(s.grossCents)}</td>
                    <td className="num">{s.status === 'refunded' ? '—' : eur(s.creatorCents)}</td>
                    <td>{s.status === 'refunded' ? 'Refunded' : 'Paid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="studio-empty">No sales yet.</p>}
        </section>

        <section className="studio-card" aria-labelledby="hunts-h">
          <h2 id="hunts-h" className="studio-h2">Your hunts</h2>
          {drafts && drafts.length > 0 ? (
            <ul className="studio-list">
              {drafts.map(d => (
                <li key={d.id} className="studio-item">
                  <div className="studio-item-main">
                    <a className="studio-item-title" href={`/studio/hunts/${d.id}`}>{d.title || 'Untitled hunt'}</a>
                    <span className="studio-item-meta">
                      {d.tourType === 'tour' ? 'Walking tour' : 'Hunt'} · {d.stopCount} stops · edited {date(d.updatedAt)}
                      {d.publishedVersion > 0 && d.status !== 'approved' && d.live ? ' · published version is live' : ''}
                    </span>
                    {d.status === 'rejected' && d.rejectionReason && <span className="studio-item-note">{d.rejectionReason}</span>}
                  </div>
                  <span className={`studio-badge is-${d.status}`}>{STATUS_LABEL[d.status]}</span>
                  {!d.publishedVersion && <button type="button" className="studio-link-btn" onClick={() => removeDraft(d.id)}>Delete</button>}
                </li>
              ))}
            </ul>
          ) : <p className="studio-empty">No hunts yet. Start one above.</p>}
        </section>
      </div>
    </main>
  )
}
