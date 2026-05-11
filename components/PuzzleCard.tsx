'use client'
import { useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { Puzzle } from '@/types'

interface Props {
  puzzle: Puzzle
  sessionId: string
  clueId: string
  /** Called once the player solves the puzzle (or confirms a re-submit). */
  onSolved?: (bonus: number) => void
}

const TYPE_ICON: Record<Puzzle['type'], string> = {
  cipher:   '🔐',
  anagram:  '🔤',
  logic:    '🧠',
  sequence: '🔢',
  wordplay: '✍️',
}

export function PuzzleCard({ puzzle, sessionId, clueId, onSolved }: Props) {
  const { t } = useI18n()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [solved, setSolved] = useState(false)
  const [wrongTryAt, setWrongTryAt] = useState<number | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const [bonus, setBonus] = useState(0)

  const submit = async () => {
    if (submitting || solved || !answer.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/verify-puzzle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, clueId, answer }),
      })
      const data = await res.json()
      if (data.correct) {
        setSolved(true)
        setBonus(data.bonus ?? 0)
        if (data.bonus > 0) {
          onSolved?.(data.bonus)
          try { (navigator as any).vibrate?.(40) } catch {}
        }
      } else {
        setWrongTryAt(Date.now())
        try { (navigator as any).vibrate?.([15, 20, 15]) } catch {}
      }
    } catch {
      setWrongTryAt(Date.now())
    } finally {
      setSubmitting(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={`puzzle-card puzzle-${puzzle.type} ${solved ? 'is-solved' : ''}`}>
      <div className="puzzle-head">
        <span className="puzzle-icon" aria-hidden>{TYPE_ICON[puzzle.type]}</span>
        <span className="puzzle-label">{t('puzzleTitle')}</span>
      </div>
      <p className="puzzle-prompt">{puzzle.prompt}</p>

      {!solved && (
        <>
          <div className="puzzle-input-row">
            <input
              type="text"
              className="puzzle-input"
              value={answer}
              onChange={(e) => { setAnswer(e.target.value); setWrongTryAt(null) }}
              onKeyDown={onKeyDown}
              placeholder={t('puzzlePlaceholder')}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !answer.trim()}
              className="puzzle-submit"
            >
              {submitting ? '…' : t('puzzleSubmit')}
            </button>
          </div>

          {puzzle.hint && !hintShown && (
            <button
              type="button"
              className="puzzle-hint-toggle"
              onClick={() => setHintShown(true)}
            >
              💡 {t('puzzleShowHint')}
            </button>
          )}
          {puzzle.hint && hintShown && (
            <div className="puzzle-hint">{puzzle.hint}</div>
          )}

          {wrongTryAt !== null && (
            <div className="puzzle-feedback puzzle-wrong" key={wrongTryAt}>
              ✗ {t('puzzleTryAgain')}
            </div>
          )}
        </>
      )}

      {solved && (
        <div className="puzzle-solved">
          <div className="puzzle-solved-line">
            ✓ {bonus > 0 ? t('puzzleCorrect') : t('correct')}
          </div>
          {puzzle.explain && (
            <div className="puzzle-explain">{puzzle.explain}</div>
          )}
        </div>
      )}
    </div>
  )
}
