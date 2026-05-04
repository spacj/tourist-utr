'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { ActiveLobby, getActiveLobby, clearActiveLobby } from '@/lib/activeRoom'

export type ActiveRaceInfo = {
  source: 'race'
  roomId: string
  code: string
  huntTitle: string
  state: 'racing' | 'finished'
  sessionId: string
  cluesDone: number
  score: number
  finishedAt: number | null
}

export type ActiveLobbyInfo = ActiveLobby & { source: 'lobby' }

export type ActiveRoom = ActiveRaceInfo | ActiveLobbyInfo | null

/**
 * Surface the user's active room across reloads:
 *  • A racing/finished session (server-truth via /api/rooms/active)
 *  • A lobby they joined (client-stored in localStorage)
 *
 * If both exist, the racing session wins because it's authoritative.
 */
export function useActiveRoom() {
  const { user, loading } = useAuth()
  const [active, setActive] = useState<ActiveRoom>(null)
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    if (loading) return
    if (!user) {
      setActive(null)
      setChecked(true)
      return
    }
    try {
      const res = await fetch(`/api/rooms/active?userId=${user.uid}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.active) {
        setActive({
          source: 'race',
          roomId: data.roomId,
          code: data.code,
          huntTitle: data.huntTitle,
          state: data.state,
          sessionId: data.sessionId,
          cluesDone: data.cluesDone ?? 0,
          score: data.score ?? 0,
          finishedAt: data.finishedAt ?? null,
        })
        setChecked(true)
        return
      }
    } catch {}

    // No racing session — fall back to localStorage lobby (if any).
    const lobby = getActiveLobby()
    if (lobby) {
      setActive({ source: 'lobby', ...lobby })
    } else {
      setActive(null)
    }
    setChecked(true)
  }, [user, loading])

  useEffect(() => { refresh() }, [refresh])

  const dismiss = useCallback(() => {
    clearActiveLobby()
    setActive(null)
  }, [])

  return { active, checked, refresh, dismiss }
}
