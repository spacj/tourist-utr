// Client-side helpers for tracking the user's active room across page reloads.
// Used so a user who closes the app mid-lobby can be brought back to the same room.

const KEY = 'utr.activeLobby'
const TTL_MS = 6 * 60 * 60 * 1000  // 6 hours — matches lobby usefulness

export type ActiveLobby = {
  code: string
  roomId: string
  huntTitle?: string
  joinedAt: number
}

export function setActiveLobby(v: ActiveLobby): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch {}
}

export function getActiveLobby(): ActiveLobby | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveLobby
    if (!parsed || !parsed.code || !parsed.joinedAt) return null
    if (Date.now() - parsed.joinedAt > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearActiveLobby(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(KEY) } catch {}
}
