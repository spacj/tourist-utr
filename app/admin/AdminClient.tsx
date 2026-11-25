'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch, apiGet, apiPost, ApiError } from '@/lib/apiFetch'
import { RevenueChart } from '@/components/admin/RevenueChart'
import { LANG_LABEL, STATUS_LABEL, date, eur } from '@/components/studio/studioText'
import type { Overview } from '@/lib/adminStats'
import type { CreatorProfile, HuntDraftStatus } from '@/types'

type Tab = 'overview' | 'reviews' | 'creators' | 'sales' | 'issues'

interface Counts { pendingReviews: number; creators: number; creatorsSelling: number; sessionsStarted: number; sessionsCompleted: number; freeHuntsClaimed: number }
interface DraftRow { id: string; title: string; creatorName: string; cityId: string | null; cityRequest: string | null; sourceLang: string; stopCount: number; status: HuntDraftStatus; live: boolean; publishedVersion: number; submittedAt: number | null }
interface CreatorRow extends CreatorProfile { email: string | null; totals: { sales: number; grossCents: number; payoutCents: number } }
interface SaleRow { id: string; huntTitle: string; creatorName: string; status: 'paid' | 'refunded'; grossCents: number; vatCents: number; paymentFeeCents: number; commissionCents: number; creatorCents: number; createdAt: number }
interface IssueRow { id: string; reason?: string; createdAt: number; [k: string]: unknown }

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'creators', label: 'Creators' },
  { id: 'sales', label: 'Creator sales' },
  { id: 'issues', label: 'Payment issues' },
]

/** /admin — the owner's dashboard. Every request is re-checked server-side (admin claim). */
export function AdminClient() {
  const { user, loading, signIn } = useAuth()
  const registered = !!user && !user.isAnonymous
  const [tab, setTab] = useState<Tab>('overview')
  const [denied, setDenied] = useState(false)
  // Stable, so tab data hooks don't refetch on every render.
  const deny = useCallback(() => setDenied(true), [])

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    if (t && TABS.some(x => x.id === t)) setTab(t)
  }, [])
  const go = (t: Tab) => { setTab(t); window.history.replaceState(null, '', t === 'overview' ? '/admin' : `/admin?tab=${t}`) }

  if (loading) return <main className="page-center"><div className="spinner" role="status" aria-label="Loading" /></main>
  if (!registered) return <main className="page-center"><div className="container flow-center"><h1 className="flow-page-title">Dashboard</h1><button type="button" className="btn-primary" onClick={signIn}>Sign in</button></div></main>
  if (denied) return <main className="page-center"><div className="container flow-center"><h1 className="flow-page-title">Dashboard</h1><p className="flow-page-sub">This account has no admin access.</p></div></main>

  return (
    <main className="studio">
      <div className="container studio-wrap admin-wrap">
        <header className="studio-head">
          <div><p className="studio-eyebrow">TourHunts</p><h1 className="studio-title">Dashboard</h1></div>
        </header>
        <nav className="admin-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>
        {tab === 'overview' && <OverviewTab onDenied={deny} onGo={go} />}
        {tab === 'reviews' && <ReviewsTab onDenied={deny} />}
        {tab === 'creators' && <CreatorsTab onDenied={deny} />}
        {tab === 'sales' && <SalesTab onDenied={deny} />}
        {tab === 'issues' && <IssuesTab onDenied={deny} />}
      </div>
    </main>
  )
}

function useAdminData<T>(url: string, onDenied: () => void): { data: T | null; error: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const reload = useCallback(() => {
    setError(false)
    apiGet<T>(url).then(setData).catch(e => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 401)) onDenied()
      else setError(true)
    })
  }, [url, onDenied])
  useEffect(() => { reload() }, [reload])
  return { data, error, reload }
}

const Loading = ({ error }: { error: boolean }) =>
  error ? <p className="creator-error" role="alert">Could not load this. Refresh to try again.</p> : <div className="spinner" role="status" aria-label="Loading" />

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="studio-tile">
      <span className="studio-tile-n">{value}</span>
      <span className="studio-tile-l">{label}</span>
      {sub && <span className="studio-tile-s">{sub}</span>}
    </div>
  )
}

function OverviewTab({ onDenied, onGo }: { onDenied: () => void; onGo: (t: Tab) => void }) {
  const [days, setDays] = useState(30)
  const { data, error } = useAdminData<{ overview: Overview; counts: Counts }>(`/api/admin/data?view=overview&days=${days}`, onDenied)
  const [year, setYear] = useState(new Date().getFullYear())

  async function exportYear() {
    const res = await apiFetch(`/api/admin/export?year=${year}`)
    if (!res.ok) return
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `tourhunts-creator-earnings-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="admin-filters">
        <label className="studio-label" htmlFor="range">Period</label>
        <select id="range" className="bench-add-input" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>
      {!data ? <Loading error={error} /> : (() => {
        const { overview: o, counts: c } = data
        return (
          <>
            {c.pendingReviews > 0 && (
              <button type="button" className="studio-note is-warn admin-callout" onClick={() => onGo('reviews')}>
                {c.pendingReviews} hunt{c.pendingReviews === 1 ? '' : 's'} waiting for your review →
              </button>
            )}
            <section className="studio-tiles admin-kpis" aria-label="Key figures">
              <Tile label="Your income" value={eur(o.platformNetCents)} sub="excl. VAT and creator payouts, before payment fees" />
              <Tile label="Paid by players" value={eur(o.grossCents)} sub="all sales incl. VAT" />
              <Tile label="VAT to pay" value={eur(o.vatCents)} sub="estimate" />
              <Tile label="Paid to creators" value={eur(o.creatorPayoutCents)} />
            </section>
            <section className="studio-card">
              <RevenueChart data={o.daily} />
            </section>
            <div className="admin-two">
              <section className="studio-card">
                <h2 className="studio-h2">Your hunts</h2>
                <dl className="admin-dl">
                  <dt>Hunts sold</dt><dd>{o.house.huntSales} · {eur(o.house.huntCents)}</dd>
                  <dt>Hint credits</dt><dd>{o.house.creditSales} · {eur(o.house.creditCents)}</dd>
                  {o.house.otherCents > 0 && <><dt>Other (city passes)</dt><dd>{eur(o.house.otherCents)}</dd></>}
                  <dt>Free first hunts used</dt><dd>{c.freeHuntsClaimed}</dd>
                </dl>
              </section>
              <section className="studio-card">
                <h2 className="studio-h2">Creator marketplace</h2>
                <dl className="admin-dl">
                  <dt>Creator hunts sold</dt><dd>{o.creators.sales} · {eur(o.creators.grossCents)}</dd>
                  <dt>Your commission</dt><dd>{eur(o.creators.commissionCents)}</dd>
                  <dt>Payment fees kept</dt><dd>{eur(o.creators.paymentFeeCents)}</dd>
                  <dt>Refunds</dt><dd>{o.creators.refunds}</dd>
                  <dt>Creators</dt><dd>{c.creators} ({c.creatorsSelling} can sell)</dd>
                </dl>
              </section>
              <section className="studio-card">
                <h2 className="studio-h2">Players</h2>
                <dl className="admin-dl">
                  <dt>Hunts started</dt><dd>{c.sessionsStarted}</dd>
                  <dt>Hunts finished</dt><dd>{c.sessionsCompleted}</dd>
                  <dt>Finish rate</dt><dd>{c.sessionsStarted ? `${Math.round((c.sessionsCompleted / c.sessionsStarted) * 100)}%` : '—'}</dd>
                </dl>
              </section>
            </div>
            <section className="studio-card">
              <h2 className="studio-h2">Best-selling hunts</h2>
              {o.topHunts.length === 0 ? <p className="studio-empty">No sales in this period.</p> : (
                <table className="studio-table">
                  <thead><tr><th>Hunt</th><th>By</th><th className="num">Sales</th><th className="num">Revenue</th></tr></thead>
                  <tbody>{o.topHunts.map(h => (
                    <tr key={h.huntId}><td>{h.title}</td><td>{h.creator ? 'Creator' : 'You'}</td><td className="num">{h.sales}</td><td className="num">{eur(h.grossCents)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </section>
            <section className="studio-card">
              <h2 className="studio-h2">Yearly creator earnings (DAC7)</h2>
              <p className="studio-hint">What each creator earned in a calendar year, for your accountant and the yearly DAC7 report.</p>
              <div className="studio-inline">
                <input className="bench-add-input admin-year" type="number" min={2024} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year" />
                <button type="button" className="btn-secondary" onClick={exportYear}>Download CSV</button>
              </div>
            </section>
          </>
        )
      })()}
    </>
  )
}

function ReviewsTab({ onDenied }: { onDenied: () => void }) {
  const [status, setStatus] = useState<'pending_review' | 'all'>('pending_review')
  const { data, error } = useAdminData<{ drafts: DraftRow[] }>(`/api/admin/data?view=reviews&status=${status}`, onDenied)
  return (
    <section className="studio-card">
      <div className="admin-filters">
        <label className="studio-label" htmlFor="rstatus">Show</label>
        <select id="rstatus" className="bench-add-input" value={status} onChange={e => setStatus(e.target.value as 'pending_review' | 'all')}>
          <option value="pending_review">Waiting for review</option>
          <option value="all">All creator hunts</option>
        </select>
      </div>
      {!data ? <Loading error={error} /> : data.drafts.length === 0 ? <p className="studio-empty">Nothing to review.</p> : (
        <table className="studio-table">
          <thead><tr><th>Hunt</th><th>Creator</th><th>City</th><th>Language</th><th className="num">Stops</th><th>Status</th><th>Sent</th></tr></thead>
          <tbody>{data.drafts.map(d => (
            <tr key={d.id}>
              <td><a href={`/admin/review/${d.id}`}>{d.title || 'Untitled'}</a></td>
              <td>{d.creatorName}</td>
              <td>{d.cityId ?? <em>new: {d.cityRequest}</em>}</td>
              <td>{LANG_LABEL[d.sourceLang] ?? d.sourceLang}</td>
              <td className="num">{d.stopCount}</td>
              <td><span className={`studio-badge is-${d.status}`}>{STATUS_LABEL[d.status]}</span></td>
              <td>{date(d.submittedAt)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}

function CreatorsTab({ onDenied }: { onDenied: () => void }) {
  const { data, error, reload } = useAdminData<{ creators: CreatorRow[] }>('/api/admin/data?view=creators', onDenied)
  async function patch(uid: string, body: Record<string, unknown>) {
    try {
      await apiFetch('/api/admin/creators', { method: 'PATCH', body: JSON.stringify({ uid, ...body }) })
      reload()
    } catch { /* reload shows current state */ }
  }
  return (
    <section className="studio-card">
      {!data ? <Loading error={error} /> : data.creators.length === 0 ? <p className="studio-empty">No creators yet.</p> : (
        <table className="studio-table">
          <thead><tr><th>Creator</th><th>Email</th><th>Country</th><th>Stripe</th><th className="num">Sales</th><th className="num">Paid to them</th><th className="num">Commission</th><th>Status</th></tr></thead>
          <tbody>{data.creators.map(c => (
            <tr key={c.uid}>
              <td><a href={`/creators/${c.slug}`}>{c.displayName}</a></td>
              <td>{c.email ?? '—'}</td>
              <td>{c.country.toUpperCase()}</td>
              <td>{!c.stripeAccountId ? 'Not set up' : c.chargesEnabled ? 'Can sell' : 'Incomplete'}</td>
              <td className="num">{c.totals.sales}</td>
              <td className="num">{eur(c.totals.payoutCents)}</td>
              <td className="num">
                <select className="admin-mini" value={c.commissionBps} aria-label={`Commission for ${c.displayName}`}
                  onChange={e => patch(c.uid, { commissionBps: Number(e.target.value) })}>
                  {[1000, 1500, 2000, 2500, 3000].map(b => <option key={b} value={b}>{b / 100}%</option>)}
                  {![1000, 1500, 2000, 2500, 3000].includes(c.commissionBps) && <option value={c.commissionBps}>{c.commissionBps / 100}%</option>}
                </select>
              </td>
              <td>
                <button type="button" className="studio-link-btn" onClick={() => {
                  const next = c.status === 'active' ? 'suspended' : 'active'
                  if (next === 'active' || window.confirm(`Suspend ${c.displayName}? Their hunts are unlisted; buyers keep access.`)) patch(c.uid, { status: next })
                }}>{c.status === 'active' ? 'Active · suspend' : 'Suspended · restore'}</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}

function SalesTab({ onDenied }: { onDenied: () => void }) {
  const { data, error, reload } = useAdminData<{ sales: SaleRow[] }>('/api/admin/data?view=sales', onDenied)
  const [busy, setBusy] = useState<string | null>(null)
  async function refund(s: SaleRow) {
    if (!window.confirm(`Refund ${eur(s.grossCents)} for "${s.huntTitle}"? The player loses access and the creator's share is taken back.`)) return
    setBusy(s.id)
    try { await apiPost(`/api/admin/sales/${s.id}/refund`, {}) } catch { window.alert('Refund failed. Check the Stripe dashboard.') }
    setBusy(null)
    reload()
  }
  return (
    <section className="studio-card">
      {!data ? <Loading error={error} /> : data.sales.length === 0 ? <p className="studio-empty">No creator sales yet.</p> : (
        <div className="admin-table-wrap">
          <table className="studio-table">
            <thead><tr><th>Date</th><th>Hunt</th><th>Creator</th><th className="num">Price</th><th className="num">VAT</th><th className="num">Fee</th><th className="num">Commission</th><th className="num">Creator</th><th /></tr></thead>
            <tbody>{data.sales.map(s => (
              <tr key={s.id} className={s.status === 'refunded' ? 'is-muted' : ''}>
                <td>{date(s.createdAt)}</td><td>{s.huntTitle}</td><td>{s.creatorName}</td>
                <td className="num">{eur(s.grossCents)}</td><td className="num">{eur(s.vatCents)}</td><td className="num">{eur(s.paymentFeeCents)}</td>
                <td className="num">{eur(s.commissionCents)}</td><td className="num">{eur(s.creatorCents)}</td>
                <td>{s.status === 'refunded' ? 'Refunded' : <button type="button" className="studio-link-btn" disabled={busy === s.id} onClick={() => refund(s)}>Refund</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function IssuesTab({ onDenied }: { onDenied: () => void }) {
  const { data, error } = useAdminData<{ issues: IssueRow[] }>('/api/admin/data?view=issues', onDenied)
  return (
    <section className="studio-card">
      <p className="studio-hint">Payments that need a look: refunds that failed, partial refunds, unknown captures.</p>
      {!data ? <Loading error={error} /> : data.issues.length === 0 ? <p className="studio-empty">No issues. 🎉</p> : (
        <table className="studio-table">
          <thead><tr><th>Date</th><th>Reason</th><th>Details</th></tr></thead>
          <tbody>{data.issues.map(i => {
            const { id, reason, createdAt, ...rest } = i
            return <tr key={id}><td>{date(createdAt)}</td><td>{reason ?? '—'}</td><td><code className="admin-json">{JSON.stringify(rest)}</code></td></tr>
          })}</tbody>
        </table>
      )}
    </section>
  )
}
