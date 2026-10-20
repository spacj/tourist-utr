'use client'
import { useState } from 'react'
import { useActiveRoom } from '@/hooks/useActiveRoom'
import { useI18n } from '@/hooks/useI18n'
import { useToast } from '@/components/Toast'
import { errorKey } from '@/lib/apiErrors'

export function ResumeRaceBanner() {
  const { active, dismiss } = useActiveRoom()
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  if (!active) return null

  let href: string
  let title: string
  let desc: string
  let badge: string
  let icon: string
  let canDismiss = false

  if (active.state === 'racing' && active.sessionId) {
    href = `/hunt?session=${encodeURIComponent(active.sessionId)}`
    title = t('resumeRaceTitle')
    desc = `${active.huntTitle} · ${active.cluesDone} ${t('stopsCompleted')} · ${active.score} ${t('points')}`
    badge = t('inRoomBadge')
    icon = '🏃'
  } else if (active.state === 'finished') {
    href = `/multiplayer/${active.code}`
    title = t('viewRaceResults')
    desc = `${active.huntTitle} · ${active.score} ${t('points')}`
    badge = t('raceFinished')
    icon = '🏁'
    canDismiss = true
  } else {
    href = `/multiplayer/${active.code}`
    title = active.state === 'racing' ? t('resumeRaceTitle') : t('rejoinLobbyTitle')
    desc = active.huntTitle ? `${active.huntTitle} · ${active.code}` : active.code
    badge = active.state === 'racing' ? t('inRoomBadge') : t('lobby')
    icon = '👥'
    canDismiss = active.state === 'lobby'
  }

  const onDismiss = async () => {
    if (busy) return
    setBusy(true)
    try { await dismiss() }
    catch (e) { toast.error(t(errorKey(e))) }
    finally { setBusy(false) }
  }

  return (
    <div className="resume-race-banner" role="region" aria-label={title}>
      <a href={href} className="resume-race-link">
        <div className="resume-race-icon" aria-hidden>{icon}</div>
        <div className="resume-race-body">
          <div className="resume-race-badge">{badge}</div>
          <div className="resume-race-title">{title}</div>
          <div className="resume-race-desc">{desc}</div>
        </div>
        <div className="resume-race-arrow" aria-hidden>→</div>
      </a>
      {canDismiss && (
        <button
          type="button"
          className="resume-race-dismiss"
          onClick={onDismiss}
          disabled={busy}
          aria-label={active.state === 'lobby' ? t('leaveRoom') : t('dismiss')}
        >
          ×
        </button>
      )}
    </div>
  )
}
