import type { ComponentType } from 'react'
import {
  Award, Brain, Compass, Gem, GraduationCap, Megaphone, Star, Timer, Zap, type LucideProps,
} from 'lucide-react'

/** Achievement id → line icon (replaces the emoji in ACHIEVEMENTS_DEF for UI). */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  explorer: Compass,
  speed_demon: Timer,
  no_hints: Brain,
  perfect_hunt: Gem,
  streak_3: Zap,
  full_score: Star,
  trivia_ace: GraduationCap,
  social: Megaphone,
}

export function AchievementIcon({ id, size = 22 }: { id: string; size?: number }) {
  const Icon = ICONS[id] ?? Award
  return <Icon size={size} strokeWidth={1.75} aria-hidden />
}
