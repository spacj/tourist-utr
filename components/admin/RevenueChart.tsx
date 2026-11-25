'use client'
import { useState } from 'react'
import { eur } from '@/components/studio/studioText'

/**
 * Daily revenue, stacked: house hunts (PayPal) and creator hunts (Stripe).
 * Colours validated with the dataviz palette checker against the page
 * surface (#0E8460 / #B4381F: all checks pass). Identity never relies on
 * colour alone: legend, hover tooltip and a table view.
 */
const HOUSE = '#0E8460'
const CREATOR = '#B4381F'

export interface DayPoint { day: string; houseCents: number; creatorCents: number }

export function RevenueChart({ data }: { data: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const max = Math.max(1, ...data.map(d => d.houseCents + d.creatorCents))
  const W = 720
  const H = 200
  const padL = 48
  const padB = 22
  const plotW = W - padL - 8
  const plotH = H - padB - 8
  const slot = plotW / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(28, slot - 2))
  const y = (cents: number) => (cents / max) * plotH
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f))
  const labelEvery = Math.ceil(data.length / 8)
  const h = hover !== null ? data[hover] : null

  return (
    <figure className="admin-chart">
      <figcaption className="admin-chart-head">
        <span className="admin-chart-title">Revenue per day</span>
        <span className="admin-legend">
          <span><i style={{ background: HOUSE }} /> Your hunts</span>
          <span><i style={{ background: CREATOR }} /> Creator hunts</span>
          <button type="button" className="studio-link-btn" onClick={() => setAsTable(t => !t)}>{asTable ? 'Show chart' : 'Show table'}</button>
        </span>
      </figcaption>
      {asTable ? (
        <div className="admin-table-wrap">
          <table className="studio-table">
            <thead><tr><th>Day</th><th className="num">Your hunts</th><th className="num">Creator hunts</th><th className="num">Total</th></tr></thead>
            <tbody>
              {[...data].reverse().map(d => (
                <tr key={d.day}><td>{d.day}</td><td className="num">{eur(d.houseCents)}</td><td className="num">{eur(d.creatorCents)}</td><td className="num">{eur(d.houseCents + d.creatorCents)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-chart-plot" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue per day, stacked by your hunts and creator hunts">
            {ticks.map(t => (
              <g key={t}>
                <line x1={padL} x2={W - 8} y1={8 + plotH - y(t)} y2={8 + plotH - y(t)} className="admin-grid" />
                <text x={padL - 6} y={8 + plotH - y(t) + 4} textAnchor="end" className="admin-axis">{t === 0 ? '0' : `€${Math.round(t / 100)}`}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * slot + (slot - barW) / 2
              const hh = y(d.houseCents)
              const hc = y(d.creatorCents)
              const gap = hh > 0 && hc > 0 ? 2 : 0
              const base = 8 + plotH
              return (
                <g key={d.day} opacity={hover === null || hover === i ? 1 : 0.45}>
                  {hh > 0 && <rect x={x} y={base - hh} width={barW} height={hh} rx={Math.min(4, barW / 2)} fill={HOUSE} />}
                  {hc > 0 && <rect x={x} y={base - hh - gap - hc} width={barW} height={hc} rx={Math.min(4, barW / 2)} fill={CREATOR} />}
                  {/* Hit target: the whole column, wider than the bar. */}
                  <rect x={padL + i * slot} y={8} width={slot} height={plotH} fill="transparent"
                    onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
                    aria-label={`${d.day}: your hunts ${eur(d.houseCents)}, creator hunts ${eur(d.creatorCents)}`} />
                  {i % labelEvery === 0 && <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="admin-axis">{d.day.slice(5)}</text>}
                </g>
              )
            })}
          </svg>
          {h && hover !== null && (
            <div className="admin-tooltip" style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}>
              <strong>{h.day}</strong>
              <span><i style={{ background: HOUSE }} /> Your hunts {eur(h.houseCents)}</span>
              <span><i style={{ background: CREATOR }} /> Creator hunts {eur(h.creatorCents)}</span>
              <span>Total {eur(h.houseCents + h.creatorCents)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
