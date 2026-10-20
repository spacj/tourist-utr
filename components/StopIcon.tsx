import { MapPin } from 'lucide-react'

/**
 * A stop's `icon` comes from content data (an emoji chosen per place). It is
 * shown inside a neutral ink-ruled badge and toned down to a stamp so it sits
 * in the notebook look instead of shouting. Missing icons fall back to a pin.
 */
export function StopIcon({ icon, size = 'md', className = '' }: { icon?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={`stop-icon stop-icon-${size} ${className}`} aria-hidden>
      {icon ? <span className="stop-icon-glyph">{icon}</span> : <MapPin size={size === 'lg' ? 26 : 18} strokeWidth={1.75} />}
    </span>
  )
}

/** Styled rank number used instead of medal emoji in leaderboards and results. */
export function RankMark({ rank, label }: { rank: number; label?: string }) {
  return (
    <span className={`rank-mark ${rank <= 3 ? `rank-mark-${rank}` : ''}`} aria-label={label ?? `#${rank}`} role="img">
      {rank}
    </span>
  )
}
