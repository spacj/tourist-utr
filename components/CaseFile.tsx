'use client'
import { useI18n } from '@/hooks/useI18n'
import {
  Clue, MysterySpec, MysteryAxis, MysteryCandidate,
  localizeMystery, localizeEvidenceText, accumulateEliminations,
} from '@/types'

interface Props {
  mystery: MysterySpec
  /** Clues whose evidence the player has already uncovered (arrived stops). */
  knownClues: Clue[]
  onClose: () => void
}

/**
 * The detective's case file — a deduction board shown during a mystery hunt.
 * Suspects / weapons / places ruled out by collected evidence are struck
 * through; the evidence log lists what each stop revealed. Everything is
 * derived from the clues the player has reached, so no extra state to persist.
 */
export function CaseFile({ mystery, knownClues, onClose }: Props) {
  const { t, lang } = useI18n()
  const m = localizeMystery(mystery, lang)
  const elim = accumulateEliminations(knownClues)

  const columns: { axis: MysteryAxis; label: string; items: MysteryCandidate[] }[] = [
    { axis: 'suspects', label: t('caseSuspects'), items: m.suspects },
    { axis: 'weapons',  label: t('caseWeapons'),  items: m.weapons },
    { axis: 'places',   label: t('casePlaces'),   items: m.places },
  ]

  const evidenceLog = knownClues
    .filter(c => c.evidence)
    .map(c => ({ id: c.id, text: localizeEvidenceText(c.evidence, lang) as string }))

  return (
    <div className="history-backdrop" onClick={onClose}>
      <div className="history-sheet case-file" onClick={(e) => e.stopPropagation()}>
        <div className="case-file-head">
          <div>
            <div className="case-file-eyebrow">🔍 {t('caseFile')}</div>
            <h2 className="history-title" style={{ margin: 0 }}>{m.victim}</h2>
          </div>
          <button className="history-close" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>

        <p className="case-file-intro">{m.intro}</p>

        <div className="case-grid">
          {columns.map(col => (
            <div key={col.axis} className="case-col">
              <div className="case-col-head">{col.label}</div>
              {col.items.map(item => {
                const ruledOut = (elim[col.axis] ?? []).includes(item.id)
                return (
                  <div key={item.id} className={`case-item ${ruledOut ? 'is-out' : ''}`}>
                    <span className="case-item-icon" aria-hidden>{item.icon}</span>
                    <span className="case-item-name">{item.name}</span>
                    {ruledOut && <span className="case-item-x" aria-hidden>✕</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="case-evidence">
          <div className="case-col-head">{t('caseEvidence')} · {evidenceLog.length}</div>
          {evidenceLog.length === 0 ? (
            <p className="case-evidence-empty">{t('caseNoEvidence')}</p>
          ) : (
            <ul className="case-evidence-list">
              {evidenceLog.map((e, i) => (
                <li key={e.id}><span className="case-evidence-num">{i + 1}</span> {e.text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
