'use client'
import { useActiveRoom } from '@/hooks/useActiveRoom'
import { useI18n } from '@/hooks/useI18n'

export function ResumeRaceBanner() {
  const { active, dismiss } = useActiveRoom()
  const { t } = useI18n()

  if (!active) return null

  let href = ''
  let title = ''
  let desc = ''
  let badge = ''
  let icon = '👥'
  let canDismiss = false

  if (active.state === 'racing' && active.sessionId) {
    href = `/hunt?session=${active.sessionId}`
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
    // lobby
    href = `/multiplayer/${active.code}`
    title = t('rejoinLobbyTitle')
    desc = active.huntTitle ? `${active.huntTitle} · ${active.code}` : active.code
    badge = t('lobby')
    icon = '👥'
    canDismiss = true
  }

  if (!href) return null

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
          onClick={dismiss}
          aria-label={t('dismiss')}
        >
          ×
        </button>
      )}
    </div>
  )
}
