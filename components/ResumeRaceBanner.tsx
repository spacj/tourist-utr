'use client'
import { useActiveRoom } from '@/hooks/useActiveRoom'
import { useI18n } from '@/hooks/useI18n'

export function ResumeRaceBanner() {
  const { active, dismiss } = useActiveRoom()
  const { t } = useI18n()

  if (!active) return null

  // Build the resume URL based on what's active.
  let href = ''
  let title = ''
  let desc = ''
  let badge = ''
  let onDismiss: (() => void) | null = null

  if (active.source === 'race') {
    if (active.state === 'racing') {
      href = `/hunt?session=${active.sessionId}`
      title = t('resumeRaceTitle')
      desc = `${active.huntTitle} · ${active.cluesDone} ${t('stopsCompleted')} · ${active.score} ${t('points')}`
      badge = t('inRoomBadge')
    } else if (active.state === 'finished') {
      href = `/multiplayer/${active.code}`
      title = t('viewRaceResults')
      desc = `${active.huntTitle} · ${active.score} ${t('points')}`
      badge = t('raceFinished')
    }
  } else {
    href = `/multiplayer/${active.code}`
    title = t('rejoinLobbyTitle')
    desc = active.huntTitle ? `${active.huntTitle} · ${active.code}` : active.code
    badge = t('lobby')
    onDismiss = dismiss
  }

  if (!href) return null

  return (
    <div className="resume-race-banner" role="region" aria-label={title}>
      <a href={href} className="resume-race-link">
        <div className="resume-race-icon" aria-hidden>
          {active.source === 'race' && active.state === 'racing' ? '🏃' : active.source === 'race' ? '🏁' : '👥'}
        </div>
        <div className="resume-race-body">
          <div className="resume-race-badge">{badge}</div>
          <div className="resume-race-title">{title}</div>
          <div className="resume-race-desc">{desc}</div>
        </div>
        <div className="resume-race-arrow" aria-hidden>→</div>
      </a>
      {onDismiss && (
        <button
          type="button"
          className="resume-race-dismiss"
          onClick={onDismiss}
          aria-label={t('dismiss')}
        >
          ×
        </button>
      )}
    </div>
  )
}
