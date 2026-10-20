'use client'
import { Search, X } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { Modal } from '@/components/Modal'
import {
  ClueEvidence, MysterySpec, MysteryAxis, MysteryCandidate,
  localizeMystery, localizeEvidenceText, accumulateEliminations,
} from '@/types'

interface Props {
  mystery: MysterySpec
  /** Clues whose evidence the player has already uncovered (arrived stops). */
  knownClues: { id: string; evidence?: ClueEvidence | null }[]
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
  const elim = accumulateEliminations(knownClues.map(c => ({ evidence: c.evidence ?? undefined })))

  const columns: { axis: MysteryAxis; label: string; items: MysteryCandidate[] }[] = [
    { axis: 'suspects', label: t('caseSuspects'), items: m.suspects },
    { axis: 'weapons',  label: t('caseWeapons'),  items: m.weapons },
    { axis: 'places',   label: t('casePlaces'),   items: m.places },
  ]

  const evidenceLog = knownClues
    .filter(c => c.evidence)
    .map(c => ({ id: c.id, text: localizeEvidenceText(c.evidence ?? undefined, lang) as string }))

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      className="case-file"
      title={<><span className="case-file-eyebrow"><Search size={16} strokeWidth={1.75} aria-hidden /> {t('caseFile')}</span>{m.victim}</>}
    >
      <p className="case-file-intro typewriter">{m.intro}</p>

      <div className="case-grid">
        {columns.map(col => (
          <div key={col.axis} className="case-col">
            <h3 className="case-col-head">{col.label}</h3>
            <ul className="flow-plain-list">
              {col.items.map(item => {
                const ruledOut = (elim[col.axis] ?? []).includes(item.id)
                return (
                  <li key={item.id} className={`case-item ${ruledOut ? 'is-out' : ''}`}>
                    <span className="case-item-icon" aria-hidden>{item.icon}</span>
                    <span className="case-item-name">{ruledOut ? <s>{item.name}</s> : item.name}</span>
                    {ruledOut && <X className="case-item-x" size={16} strokeWidth={2.25} aria-hidden />}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="case-evidence">
        <h3 className="case-col-head">{t('caseEvidence')} · {evidenceLog.length}</h3>
        {evidenceLog.length === 0 ? (
          <p className="case-evidence-empty">{t('caseNoEvidence')}</p>
        ) : (
          <ol className="case-evidence-list">
            {evidenceLog.map((e, i) => (
              <li key={e.id} className="typewriter"><span className="case-evidence-num" aria-hidden>{i + 1}</span> {e.text}</li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  )
}
