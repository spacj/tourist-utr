'use client'
import { useState, type ComponentType } from 'react'
import {
  Brain, Check, Eye, Hash, Image as ImageIcon, KeyRound, Lightbulb, ListOrdered, PenLine, Repeat,
  Shuffle, WifiOff, X, type LucideProps,
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useToast } from '@/components/Toast'
import { apiPost, ApiError } from '@/lib/apiFetch'
import { enqueue } from '@/lib/offlineQueue'
import { checkAnswerOffline, errorKey, isNetworkFailure, vibrate, fmt } from '@/lib/gameClient'
import { HINT_COSTS, SCORE, pickTxt, type ActiveClueView, type PuzzleType } from '@/types'

export interface PuzzleSolved {
  bonus: number
  totalScore?: number
  clue?: ActiveClueView | null
  offline?: boolean
}

interface Props {
  huntId: string
  sessionId: string
  clue: ActiveClueView
  /** Solved offline, waiting to sync (kept by the parent across re-renders). */
  solvedOffline: boolean
  onSolved: (r: PuzzleSolved) => void
  credits: number
  unlockingHint: boolean
  onUnlockHint: () => void
}

// One ink colour for every type — the icon and label tell them apart.
const TYPE_META: Record<PuzzleType, { Icon: ComponentType<LucideProps>; labelKey: string }> = {
  cipher:   { Icon: KeyRound,    labelKey: 'puzzleTypeCipher' },
  anagram:  { Icon: Shuffle,     labelKey: 'puzzleTypeAnagram' },
  logic:    { Icon: Brain,       labelKey: 'puzzleTypeLogic' },
  sequence: { Icon: ListOrdered, labelKey: 'puzzleTypeSequence' },
  numbers:  { Icon: Hash,        labelKey: 'puzzleTypeNumbers' },
  wordplay: { Icon: PenLine,     labelKey: 'puzzleTypeWordplay' },
  reverse:  { Icon: Repeat,      labelKey: 'puzzleTypeReverse' },
  rebus:    { Icon: ImageIcon,   labelKey: 'puzzleTypeRebus' },
  observe:  { Icon: Eye,         labelKey: 'puzzleTypeObserve' },
}

function PromptDisplay({ type, text }: { type: PuzzleType; text: string }) {
  switch (type) {
    case 'cipher':
    case 'reverse':
      return <div className="puzzle-display puzzle-display-cipher">{text}</div>
    case 'anagram': {
      const tokens = text.split(/\s+/).filter(Boolean)
      return (
        <div className="puzzle-display puzzle-display-anagram" aria-label={text}>
          {tokens.map((token, ti) => (
            <span key={ti} className="puzzle-tiles" aria-hidden>
              {token.split('').map((ch, i) => <span key={i} className="puzzle-tile">{ch}</span>)}
            </span>
          ))}
        </div>
      )
    }
    case 'sequence':
    case 'numbers':
      return <div className="puzzle-display puzzle-display-sequence">{text}</div>
    case 'observe':
      return <p className="puzzle-display puzzle-display-observe">{text}</p>
    default:
      return <p className="puzzle-display puzzle-display-prose">{text}</p>
  }
}

/** The puzzle IS the clue: solving it reveals the story and unlocks navigation help. */
export function PuzzleCard({
  huntId, sessionId, clue, solvedOffline, onSolved, credits, unlockingHint, onUnlockHint,
}: Props) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [wrongAt, setWrongAt] = useState<number | null>(null)
  const puzzle = clue.puzzle!
  const meta = TYPE_META[puzzle.type] ?? TYPE_META.logic
  const hint = clue.hintsUnlocked.puzzle
  const hintCost = HINT_COSTS.puzzle

  const markWrong = () => {
    setWrongAt(Date.now())
    vibrate([15, 20, 15])
  }

  const solveOffline = async (): Promise<boolean> => {
    const ok = await checkAnswerOffline(huntId, clue.id, answer, puzzle.answerHashes)
    if (ok === null) { toast.error(t('errOffline')); return true }
    if (!ok) { markWrong(); return true }
    const queued = await enqueue({
      url: '/api/verify-puzzle',
      body: { sessionId, clueId: clue.id, answer },
      reconcileKey: `puzzle:${sessionId}:${clue.id}`,
    })
    if (!queued) toast.error(t('errQueueUnavailable'))
    vibrate([40, 30, 60])
    onSolved({ bonus: 0, offline: true })
    return true
  }

  const submit = async () => {
    if (submitting || !answer.trim()) return
    setSubmitting(true)
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) { await solveOffline(); return }
      const r = await apiPost<{ correct: boolean; bonus?: number; totalScore?: number; clue?: ActiveClueView | null }>(
        '/api/verify-puzzle', { sessionId, clueId: clue.id, answer },
      )
      if (!r.correct) { markWrong(); return }
      vibrate([40, 30, 60])
      onSolved({ bonus: r.bonus ?? 0, totalScore: r.totalScore, clue: r.clue ?? null })
    } catch (e) {
      if (e instanceof ApiError) toast.error(t(errorKey(e.code)))
      else if (isNetworkFailure(e)) await solveOffline()
      else toast.error(t('errGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  if (clue.puzzleSolved || solvedOffline) {
    const story = pickTxt(clue.riddle, lang)
    const explain = pickTxt(puzzle.explain, lang)
    return (
      <div className="puzzle-card puzzle-card-primary is-solved">
        <span className="stamp stamp-solved puzzle-stamp" aria-hidden>{t('sampleSolved')}</span>
        <div className="puzzle-head">
          <span className="puzzle-icon" aria-hidden><Check size={18} strokeWidth={2} /></span>
          <span className="puzzle-label puzzle-label-solved">{t('puzzleSolvedLabel')}</span>
        </div>
        {story && <p className="puzzle-story">{story}</p>}
        {explain && <div className="puzzle-explain">{explain}</div>}
        {solvedOffline && !clue.puzzleSolved && (
          <div className="puzzle-offline-note"><WifiOff size={16} strokeWidth={1.75} aria-hidden /> {t('puzzleOfflineSolved')}</div>
        )}
      </div>
    )
  }

  const theme = pickTxt(clue.theme, lang)
  return (
    <div className={`puzzle-card puzzle-card-primary puzzle-${puzzle.type}`}>
      <div className="puzzle-head">
        <span className="puzzle-icon" aria-hidden><meta.Icon size={18} strokeWidth={1.75} /></span>
        <span className="puzzle-label">{t(meta.labelKey)}</span>
        {theme && <span className="puzzle-theme">· {theme}</span>}
        <span className="puzzle-points">+{SCORE.puzzle}</span>
      </div>

      <PromptDisplay type={puzzle.type} text={pickTxt(puzzle.prompt, lang)} />

      <form className="puzzle-input-row" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <label className="sr-only" htmlFor={`puzzle-${clue.id}`}>{t('puzzlePlaceholder')}</label>
        <input
          id={`puzzle-${clue.id}`}
          type="text"
          className="puzzle-input"
          value={answer}
          onChange={(e) => { setAnswer(e.target.value); setWrongAt(null) }}
          placeholder={t('puzzlePlaceholder')}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          disabled={submitting}
          aria-invalid={wrongAt !== null}
        />
        <button type="submit" disabled={submitting || !answer.trim()} className="puzzle-submit">
          {submitting ? '…' : t('puzzleSubmit')}
        </button>
      </form>

      {puzzle.hasHint && !hint && (
        <button
          type="button"
          className="puzzle-hint-toggle"
          onClick={onUnlockHint}
          disabled={unlockingHint}
          aria-busy={unlockingHint}
        >
          <Lightbulb size={18} strokeWidth={1.75} aria-hidden />
          {unlockingHint ? '…' : fmt(t('puzzleHintCta'), { cost: hintCost })}
          {credits < hintCost && <span className="puzzle-hint-short"> · {t('notEnoughCredits')}</span>}
        </button>
      )}
      {hint && (
        <div className="puzzle-hint typewriter">
          {pickTxt(hint.text, lang)}
        </div>
      )}

      {wrongAt !== null && (
        <div className="puzzle-feedback puzzle-wrong" key={wrongAt} role="alert">
          <X size={16} strokeWidth={2} aria-hidden /> {t('puzzleTryAgain')}
        </div>
      )}
    </div>
  )
}
