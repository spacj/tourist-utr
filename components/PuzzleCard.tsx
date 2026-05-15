'use client'
import { useState } from 'react'
import { useI18n } from '@/hooks/useI18n'
import { Puzzle, HINT_COSTS, normalizePuzzleAnswer, SCORE } from '@/types'
import { enqueue } from '@/lib/offlineQueue'

interface Props {
  puzzle: Puzzle
  sessionId: string
  clueId: string
  /** Prose flavor text revealed once the puzzle is solved (the original riddle). */
  storyOnSolve?: string
  /** Theme label shown in the header (e.g. "Medieval giant"). */
  theme?: string
  /** Called once the player solves the puzzle. */
  onSolved?: (bonus: number) => void
  /** Live credit balance, for showing the hint price and gating affordability. */
  credits: number
  /** Spends credits and unlocks the puzzle hint; resolves true if unlocked. */
  onUnlockHint: () => Promise<boolean>
  /** Opens the credit shop when the player can't afford the hint. */
  onOpenShop: () => void
}

// Icon + accent color per puzzle type. The label is translated via i18n
// keys (puzzleTypeCipher, puzzleTypeAnagram, …) and resolved at render time.
const TYPE_META: Record<Puzzle['type'], { icon: string; labelKey: string; color: string }> = {
  cipher:   { icon: '🔐', labelKey: 'puzzleTypeCipher',   color: '#6366f1' },
  anagram:  { icon: '🔤', labelKey: 'puzzleTypeAnagram',  color: '#a855f7' },
  logic:    { icon: '🧠', labelKey: 'puzzleTypeLogic',    color: '#0891b2' },
  sequence: { icon: '🔢', labelKey: 'puzzleTypeSequence', color: '#16a34a' },
  wordplay: { icon: '✍️', labelKey: 'puzzleTypeWordplay', color: '#db2777' },
  reverse:  { icon: '🔁', labelKey: 'puzzleTypeReverse',  color: '#7c3aed' },
  observe:  { icon: '👀', labelKey: 'puzzleTypeObserve',  color: '#0d9488' },
}

/** First successful display of the puzzle prompt — styled per type. */
function PromptDisplay({ puzzle }: { puzzle: Puzzle }) {
  const text = puzzle.prompt

  switch (puzzle.type) {
    case 'cipher':
    case 'reverse':
      // Monospace, letter-spaced "ciphertext" look
      return <div className="puzzle-display puzzle-display-cipher">{text}</div>

    case 'anagram': {
      // Render each non-space character as a tile, preserving word breaks
      const tokens = text.split(/\s+/).filter(Boolean)
      return (
        <div className="puzzle-display puzzle-display-anagram">
          {tokens.map((token, ti) => (
            <span key={ti} className="puzzle-tiles">
              {token.split('').map((ch, i) => (
                <span key={i} className="puzzle-tile">{ch}</span>
              ))}
            </span>
          ))}
        </div>
      )
    }

    case 'sequence':
      return <div className="puzzle-display puzzle-display-sequence">{text}</div>

    case 'observe':
      // "Stand here and look for X" — styled as an on-site instruction card.
      return <p className="puzzle-display puzzle-display-observe">{text}</p>

    case 'logic':
    case 'wordplay':
    default:
      return <p className="puzzle-display puzzle-display-prose">{text}</p>
  }
}

export function PuzzleCard({ puzzle, sessionId, clueId, storyOnSolve, theme, onSolved, credits, onUnlockHint, onOpenShop }: Props) {
  const { t } = useI18n()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [solved, setSolved] = useState(false)
  const [solvedAnswer, setSolvedAnswer] = useState<string | null>(null)
  const [wrongTryAt, setWrongTryAt] = useState<number | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const [unlockingHint, setUnlockingHint] = useState(false)
  const [bonus, setBonus] = useState(0)
  const [solvedOffline, setSolvedOffline] = useState(false)

  const meta = TYPE_META[puzzle.type]
  const hintCost = HINT_COSTS.puzzle
  const canAffordHint = credits >= hintCost

  const requestHint = async () => {
    if (hintShown || unlockingHint) return
    if (!canAffordHint) { onOpenShop(); return }
    setUnlockingHint(true)
    const ok = await onUnlockHint()
    setUnlockingHint(false)
    if (ok) setHintShown(true)
  }

  // Local check using the same normalization the server applies. Used as the
  // single source of truth for the offline fallback (and as a cheap optimism
  // if the network is reachable but slow — we still confirm with the server).
  const isLocallyCorrect = (raw: string): boolean => {
    const accepted = puzzle.answer.split('|').map(normalizePuzzleAnswer).filter(Boolean)
    const submitted = normalizePuzzleAnswer(raw)
    return submitted.length > 0 && accepted.includes(submitted)
  }

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
        setSolvedAnswer(answer.trim())
        setBonus(data.bonus ?? 0)
        if (data.bonus > 0) {
          onSolved?.(data.bonus)
          try { (navigator as any).vibrate?.([40, 30, 60]) } catch {}
        }
      } else {
        setWrongTryAt(Date.now())
        try { (navigator as any).vibrate?.([15, 20, 15]) } catch {}
      }
    } catch {
      // Network failed — fall back to client-side verification. The puzzle's
      // accepted-answers list is part of the Clue payload (already on-device
      // from the initial seed/cache), so we can verify locally and queue the
      // claim for replay when the network returns. The server-side route is
      // idempotent (puzzleClaims/{clueId}), so a successful replay credits
      // the bonus exactly once.
      if (isLocallyCorrect(answer)) {
        const optimisticBonus = puzzle.bonus ?? SCORE.puzzleBonus
        await enqueue({
          url: '/api/verify-puzzle',
          body: { sessionId, clueId, answer },
          reconcileKey: `puzzle:${sessionId}:${clueId}`,
        })
        setSolved(true)
        setSolvedOffline(true)
        setSolvedAnswer(answer.trim())
        setBonus(optimisticBonus)
        onSolved?.(optimisticBonus)
        try { (navigator as any).vibrate?.([40, 30, 60]) } catch {}
      } else {
        setWrongTryAt(Date.now())
        try { (navigator as any).vibrate?.([15, 20, 15]) } catch {}
      }
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

  // Solved state: show the decoded answer + story reveal
  if (solved) {
    return (
      <div className="puzzle-card puzzle-card-primary is-solved" style={{ borderColor: '#22c97a' }}>
        <div className="puzzle-head">
          <span className="puzzle-icon" aria-hidden>✓</span>
          <span className="puzzle-label" style={{ color: '#22c97a' }}>
            {bonus > 0 ? `${t('puzzleCorrect')}` : t('correct')}
          </span>
        </div>
        <div className="puzzle-reveal">
          <div className="puzzle-reveal-label">{t('yourClue')}</div>
          <div className="puzzle-reveal-answer">{(solvedAnswer ?? '').toUpperCase()}</div>
        </div>
        {storyOnSolve && (
          <p className="puzzle-story">{storyOnSolve}</p>
        )}
        {puzzle.explain && (
          <div className="puzzle-explain">{puzzle.explain}</div>
        )}
        {solvedOffline && (
          <div className="puzzle-offline-note">📡 {t('puzzleOfflineSolved')}</div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`puzzle-card puzzle-card-primary puzzle-${puzzle.type}`}
      style={{ borderColor: `${meta.color}40` }}
    >
      <div className="puzzle-head">
        <span className="puzzle-icon" aria-hidden>{meta.icon}</span>
        <span className="puzzle-label" style={{ color: meta.color }}>
          {t(meta.labelKey)}
        </span>
        {theme && <span className="puzzle-theme">· {theme}</span>}
      </div>

      <PromptDisplay puzzle={puzzle} />

      <div className="puzzle-input-row">
        <input
          type="text"
          className="puzzle-input"
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); setWrongTryAt(null) }}
          onKeyDown={onKeyDown}
          placeholder={t('puzzlePlaceholder')}
          autoCapitalize="characters"
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
          style={{ background: meta.color }}
        >
          {submitting ? '…' : t('puzzleSubmit')}
        </button>
      </div>

      {puzzle.hint && !hintShown && (
        <button
          type="button"
          className="puzzle-hint-toggle"
          onClick={requestHint}
          disabled={unlockingHint}
          style={{ borderColor: `${meta.color}66`, color: meta.color }}
        >
          💡 {unlockingHint ? '…' : `${t('puzzleShowHint')} · 💎 ${hintCost}`}
        </button>
      )}
      {puzzle.hint && hintShown && (
        <div className="puzzle-hint" style={{ borderLeftColor: meta.color, background: `${meta.color}14` }}>
          {puzzle.hint}
        </div>
      )}

      {wrongTryAt !== null && (
        <div className="puzzle-feedback puzzle-wrong" key={wrongTryAt}>
          ✗ {t('puzzleTryAgain')}
        </div>
      )}
    </div>
  )
}
