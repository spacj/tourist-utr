'use client'
import { useEffect, useState, useCallback } from 'react'
import { onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'

export type ActiveRoomState = 'lobby' | 'racing' | 'finished'

export type ActiveRoomInfo = {
  roomId: string
  code: string
  huntId: string
  huntTitle: string
  state: ActiveRoomState
  sessionId: string | null
  cluesDone: number
  score: number
  finishedAt: number | null
}

export type ActiveRoom = ActiveRoomInfo | null

/**
 * Real-time view of the user's active multiplayer room.
 *
 * Subscribes to `userActiveRooms/{userId}` so the resume banner updates
 * the moment the host starts the race, the player finishes, or another
 * device leaves the room. Works across tabs and devices.
 */
export function useActiveRoom() {
  const { user, loading } = useAuth()
  const [active, setActive] = useState<ActiveRoom>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) {
      setActive(null)
      setChecked(true)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'userActiveRooms', user.uid),
      async (snap) => {
        if (!snap.exists()) {
          setActive(null)
          setChecked(true)
          return
        }
        const a = snap.data()

        // Hydrate with player progress so the banner can show "X stops · Y points".
        let cluesDone = 0
        let score = 0
        let finishedAt: number | null = null
        try {
          const playerSnap = await getDoc(doc(db, 'rooms', a.roomId, 'players', user.uid))
          if (playerSnap.exists()) {
            const p = playerSnap.data()
            cluesDone = p.cluesDone ?? 0
            score = p.score ?? 0
            finishedAt = p.finishedAt?.toMillis?.() ?? null
          } else {
            // Player record was deleted (left room). Resume pointer is stale.
            setActive(null)
            setChecked(true)
            return
          }
        } catch {}

        setActive({
          roomId: a.roomId,
          code: a.code,
          huntId: a.huntId,
          huntTitle: a.huntTitle,
          state: a.state as ActiveRoomState,
          sessionId: a.sessionId ?? null,
          cluesDone,
          score,
          finishedAt,
        })
        setChecked(true)
      },
      () => {
        setActive(null)
        setChecked(true)
      }
    )
    return () => unsub()
  }, [user, loading])

  /**
   * Dismiss the active-room banner.
   *  - lobby     → leave the room (player record + pointer removed)
   *  - finished  → just clear the pointer (results stay viewable via room code)
   *  - racing    → noop (use abandon to actually quit a race)
   */
  const dismiss = useCallback(async () => {
    if (!user || !active) return
    try {
      if (active.state === 'lobby') {
        await fetch('/api/rooms/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, roomId: active.roomId }),
        })
      } else if (active.state === 'finished') {
        await fetch('/api/rooms/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        })
      }
    } catch {}
    // Listener will pick up the deletion and clear local state.
  }, [user, active])

  return { active, checked, dismiss }
}
