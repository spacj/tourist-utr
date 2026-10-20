import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Play with friends',
  description: 'Race your friends through the same city hunt: share a room code, solve the same clues, see who gets there first.',
  alternates: { canonical: '/multiplayer' },
}

export default function MultiplayerLayout({ children }: { children: React.ReactNode }) {
  return children
}
