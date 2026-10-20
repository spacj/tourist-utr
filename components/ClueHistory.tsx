'use client'
import { useState } from 'react'
import { pickTxt, type CompletedClueView } from '@/types'
import { useI18n } from '@/hooks/useI18n'
import { Modal } from '@/components/Modal'

interface Props {
  completedClues: CompletedClueView[]
  onClose: () => void
}

/** Past stops: location, story, fun fact, quiz answer and the points earned. */
export function ClueHistory({ completedClues, onClose }: Props) {
  const { t, lang } = useI18n()
  const sorted = [...completedClues].sort((a, b) => b.order - a.order)
  const [openId, setOpenId] = useState<string | null>(sorted[0]?.id ?? null)

  return (
    <Modal open onClose={onClose} title={t('historyTitle')} variant="sheet" className="history-modal">
      {!sorted.length ? (
        <p className="history-empty">{t('historyEmpty')}</p>
      ) : (
        <>
          <p className="history-sub">{t('historySub')}</p>
          <div className="history-list">
            {sorted.map((c) => {
              const isOpen = openId === c.id
              const funFact = pickTxt(c.funFact, lang)
              const riddle = pickTxt(c.riddle, lang)
              return (
                <div key={c.id} className={`history-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="history-item-head"
                    onClick={() => setOpenId(isOpen ? null : c.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="history-stop">{c.order}</span>
                    <span className="history-icon" aria-hidden>{c.icon ?? '📍'}</span>
                    <span className="history-name">{pickTxt(c.locationName, lang)}</span>
                    <span className="history-points">+{c.points}</span>
                    <span className="history-chevron" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="history-item-body">
                      {c.theme && <div className="history-theme">{pickTxt(c.theme, lang)}</div>}
                      {riddle && <p className="history-riddle">{riddle}</p>}
                      {funFact && (
                        <div className="history-fact">
                          <div className="history-fact-label">{t('didYouKnow')}</div>
                          <p>{funFact}</p>
                        </div>
                      )}
                      {c.trivia && (
                        <div className="history-trivia">
                          <div className="history-fact-label">🎓 {t('quizLabel')}</div>
                          <p className="history-trivia-q">{pickTxt(c.trivia.question, lang)}</p>
                          <p className="history-trivia-a">✓ {pickTxt(c.trivia.options[c.trivia.correctIndex], lang)}</p>
                          {c.trivia.explain && <p className="history-trivia-explain">{pickTxt(c.trivia.explain, lang)}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}
