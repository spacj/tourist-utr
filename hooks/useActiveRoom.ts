'use client'
import { useEffect, useState, useCallback } from 'react'
import { onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/AuthProvider'
import { apiPost } from '@/lib/apiFetch'

export type ActiveRoomState = 'lobby' | 'racing' | 'finished'

export type ActiveRoomInfo = {
  roomId: string
  code: string
  huntId: string
  huntTitle: string
  state: ActiveRoomState
  /** The caller's own session in this race (null until the race starts). */
  sessionId: string | null
  cluesDone: number
  score: number
  finishedAt: number | null
}

export type ActiveRoom = ActiveRoomInfo | null

/**
 * Real-time view of the signed-in user's active multiplayer room, from
 * `userActiveRooms/{uid}` (readable by its owner only — the server writes it
 * on create/join/start/finish). It's the only client-side source of the
 * user's race sessionId: public player docs don't carry it.
 * Guests can't be in rooms, so they always get null.
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
    let cancelled = false
    const unsub = onSnapshot(
      doc(db, 'userActiveRooms', user.uid),
      async (snap) => {
        if (!snap.exists()) {
          if (!cancelled) { setActive(null); setChecked(true) }
          return
        }
        const a = snap.data()
        // Hydrate with own progress so the banner can show "X stops · Y points".
        let cluesDone = 0
        let score = 0
        let finishedAt: number | null = null
        try {
          const playerSnap = await getDoc(doc(db, 'rooms', String(a.roomId), 'players', user.uid))
          if (!playerSnap.exists()) {
            // Player record gone (left / room closed): the pointer is stale.
            if (!cancelled) { setActive(null); setChecked(true) }
            return
          }
          const p = playerSnap.data()
          cluesDone = p.cluesDone ?? 0
          score = p.score ?? 0
          finishedAt = p.finishedAt?.toMillis?.() ?? null
        } catch {}
        if (cancelled) return
        setActive({
          roomId: String(a.roomId),
          code: String(a.code ?? ''),
          huntId: String(a.huntId ?? ''),
          huntTitle: String(a.huntTitle ?? ''),
          state: (a.state as ActiveRoomState) ?? 'lobby',
          sessionId: typeof a.sessionId === 'string' ? a.sessionId : null,
          cluesDone,
          score,
          finishedAt,
        })
        setChecked(true)
      },
      () => {
        if (!cancelled) { setActive(null); setChecked(true) }
      },
    )
    return () => { cancelled = true; unsub() }
  }, [user, loading])

  /**
   * Dismiss the active-room banner. Throws ApiError on failure.
   *  - lobby     → leave the room
   *  - finished  → clear the pointer (results stay viewable via the code)
   *  - racing    → no-op (abandoning a race is an explicit, confirmed action)
   */
  const dismiss = useCallback(async () => {
    if (!user || !active) return
    if (active.state === 'lobby') await apiPost('/api/rooms/leave', { roomId: active.roomId })
    else if (active.state === 'finished') await apiPost('/api/rooms/dismiss', {})
    // The listener picks up the deletion and clears local state.
  }, [user, active])

  return { active, checked, dismiss }
}
