'use client'
import { useState } from 'react'
import { Clue, localizeClue } from '@/types'
import { useI18n } from '@/hooks/useI18n'

interface Props {
  completedClues: Clue[]
  onClose: () => void
}

export function ClueHistory({ completedClues, onClose }: Props) {
  const { t, lang } = useI18n()
  const [openId, setOpenId] = useState<string | null>(completedClues[0]?.id ?? null)

  if (!completedClues.length) {
    return (
      <div className="history-backdrop" onClick={onClose}>
        <div className="history-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-grab" aria-hidden />
          <div className="history-header">
            <h2 className="history-title">{t('historyTitle')}</h2>
            <button className="history-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <p className="history-empty">{t('historyEmpty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-backdrop" onClick={onClose}>
      <div className="history-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2 className="history-title">{t('historyTitle')}</h2>
          <button className="history-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="history-sub">{t('historySub')}</p>
        <div className="history-list">
          {completedClues.map((raw) => {
            const c = localizeClue(raw, lang)
            const isOpen = openId === c.id
            return (
              <div key={c.id} className={`history-item ${isOpen ? 'is-open' : ''}`}>
                <button
                  className="history-item-head"
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  aria-expanded={isOpen}
                >
                  <span className="history-stop">{c.order}</span>
                  <span className="history-icon">{c.icon ?? '📍'}</span>
                  <span className="history-name">{c.locationName}</span>
                  <span className="history-chevron" aria-hidden>{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="history-item-body">
                    {c.theme && <div className="history-theme">{c.theme}</div>}
                    {c.riddle && <p className="history-riddle">{c.riddle}</p>}
                    {c.funFact && (
                      <div className="history-fact">
                        <div className="history-fact-label">{t('didYouKnow')}</div>
                        <p>{c.funFact}</p>
                      </div>
                    )}
                    {c.trivia && (
                      <div className="history-trivia">
                        <div className="history-fact-label">🎓 {t('quickQuiz')}</div>
                        <p className="history-trivia-q">{c.trivia.question}</p>
                        <p className="history-trivia-a">
                          ✓ {c.trivia.options[c.trivia.correctIndex]}
                        </p>
                        <p className="history-trivia-explain">{c.trivia.explain}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
