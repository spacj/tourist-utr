'use client'
import { useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { MysterySpec, MysteryAxis, MysteryCandidate, localizeMystery } from '@/types'

interface Props {
  sessionId: string
  mystery: MysterySpec
  /** Called with the bonus when the accusation is correct (to bump the score). */
  onSolved?: (bonus: number) => void
}

type AccuseResult = { correct: boolean; solution: { suspect: string; weapon: string; place: string }; bonus: number }

/**
 * The finale of a mystery hunt: pick a suspect, weapon and place, then accuse.
 * Validated server-side (/api/accuse) so the solution never reaches the client
 * until after the guess. One accusation per session.
 */
export function MysteryAccusation({ sessionId, mystery, onSolved }: Props) {
  const { t, lang } = useI18n()
  const m = localizeMystery(mystery, lang)

  const [pick, setPick] = useState<{ suspect?: string; weapon?: string; place?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AccuseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const axes: { axis: MysteryAxis; key: 'suspect' | 'weapon' | 'place'; label: string; items: MysteryCandidate[] }[] = [
    { axis: 'suspects', key: 'suspect', label: t('caseSuspects'), items: m.suspects },
    { axis: 'weapons',  key: 'weapon',  label: t('caseWeapons'),  items: m.weapons },
    { axis: 'places',   key: 'place',   label: t('casePlaces'),   items: m.places },
  ]

  const ready = pick.suspect && pick.weapon && pick.place
  const nameOf = (items: MysteryCandidate[], id?: string) => items.find(c => c.id === id)?.name ?? '?'

  const accuse = async () => {
    if (!ready || submitting || result) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/accuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, suspect: pick.suspect, weapon: pick.weapon, place: pick.place }),
      })
      const data = await res.json()
      if (res.ok && typeof data.correct === 'boolean') {
        setResult(data)
        if (data.correct && data.bonus > 0) onSolved?.(data.bonus)
      } else {
        setError(t('loadError'))
      }
    } catch {
      setError(t('loadError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className={`accuse-card ${result.correct ? 'is-correct' : 'is-wrong'}`}>
        <div className="accuse-result-icon" aria-hidden>{result.correct ? '🕵️' : '🔚'}</div>
        <div className="accuse-result-title">
          {result.correct ? t('caseSolvedBadge') : t('caseClosedBadge')}
          {result.correct && result.bonus > 0 && <span className="accuse-bonus">+{result.bonus}</span>}
        </div>
        <p className="accuse-result-text">{result.correct ? m.solvedText : m.failedText}</p>
        <div className="accuse-solution">
          <span>{m.suspects.find(c => c.id === result.solution.suspect)?.icon} {nameOf(m.suspects, result.solution.suspect)}</span>
          <span aria-hidden>·</span>
          <span>{m.weapons.find(c => c.id === result.solution.weapon)?.icon} {nameOf(m.weapons, result.solution.weapon)}</span>
          <span aria-hidden>·</span>
          <span>{m.places.find(c => c.id === result.solution.place)?.icon} {nameOf(m.places, result.solution.place)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="accuse-card">
      <div className="accuse-head">🕵️ {m.accuseTitle}</div>
      {axes.map(col => (
        <div key={col.axis} className="accuse-axis">
          <div className="accuse-axis-label">{col.label}</div>
          <div className="accuse-axis-opts">
            {col.items.map(item => {
              const on = pick[col.key] === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`accuse-chip ${on ? 'is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setPick(p => ({ ...p, [col.key]: item.id }))}
                >
                  <span aria-hidden>{item.icon}</span> {item.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {error && <p className="bench-add-error">{error}</p>}
      <button className="btn-primary accuse-submit" onClick={accuse} disabled={!ready || submitting}>
        {submitting ? '…' : t('accuseSubmit')}
      </button>
    </div>
  )
}
