'use client'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { useI18n } from '@/hooks/useI18n'
import { apiPost, ApiError } from '@/lib/apiFetch'
import { errorKey, fmt, vibrate } from '@/lib/gameClient'
import type { GpsFix } from '@/hooks/useGPS'
import { pickTxt, type ArrivalResponse, type Txt } from '@/types'

type CheckInReply =
  | (ArrivalResponse & { mode: 'checkin'; correct: true; bonus: number })
  | { mode: 'checkin'; arrived: false; correct: boolean; tooFar?: boolean; distanceM?: number; attemptsLeft: number }

/**
 * "I'm here": when GPS is blocked or too imprecise, the player answers the
 * stop's verified on-site question. Correct + within 300 m (or no GPS at
 * all) confirms the arrival server-side.
 */
export function CheckInDialog({
  open, onClose, sessionId, clueId, fix, onArrived,
}: {
  open: boolean
  onClose: () => void
  sessionId: string
  clueId: string
  fix: GpsFix | null
  onArrived: (r: ArrivalResponse) => void
}) {
  const { t, lang } = useI18n()
  const [question, setQuestion] = useState<Txt | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setMessage(null); setAnswer(''); setLoadError(null)
    apiPost<{ question: Txt | null; attemptsLeft: number }>('/api/onsite', { sessionId, clueId })
      .then(r => { if (!cancelled) { setQuestion(r.question); setAttemptsLeft(r.attemptsLeft) } })
      .catch(e => { if (!cancelled) setLoadError(t(errorKey(e instanceof ApiError ? e.code : 'network'))) })
    return () => { cancelled = true }
  }, [open, sessionId, clueId, t])

  const submit = async () => {
    if (busy || !answer.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await apiPost<CheckInReply>('/api/onsite', {
        sessionId, clueId, answer,
        ...(fix ? { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy } : {}),
      })
      if (r.arrived) {
        vibrate([60, 40, 60])
        onArrived(r)
        return
      }
      setAttemptsLeft(r.attemptsLeft)
      if (r.correct && r.tooFar) setMessage(fmt(t('checkInTooFar'), { m: r.distanceM ?? 0 }))
      else {
        vibrate([15, 20, 15])
        setMessage(r.attemptsLeft > 0 ? fmt(t('checkInWrong'), { n: r.attemptsLeft }) : t('checkInNoAttempts'))
      }
    } catch (e) {
      setMessage(t(errorKey(e instanceof ApiError ? e.code : 'network')))
    } finally {
      setBusy(false)
    }
  }

  const out = attemptsLeft === 0
  return (
    <Modal open={open} onClose={onClose} title={t('checkInTitle')} variant="sheet">
      <p className="confirm-body">{t('checkInIntro')}</p>
      {loadError && <p className="game-form-error" role="alert">{loadError}</p>}
      {question && (
        <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="game-checkin-form">
          <label htmlFor="checkin-answer" className="game-checkin-q">{pickTxt(question, lang)}</label>
          <input
            id="checkin-answer"
            className="puzzle-input"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
            disabled={busy || out}
          />
          {attemptsLeft !== null && !out && (
            <p className="game-hint-desc">{fmt(t('attemptsLeft'), { n: attemptsLeft })}</p>
          )}
          {message && <p className="game-form-error" role="alert">{message}</p>}
          <div className="confirm-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>{t('cancelBtn')}</button>
            <button type="submit" className="btn-primary" disabled={busy || out || !answer.trim()}>
              {busy ? '…' : t('checkInSubmit')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
