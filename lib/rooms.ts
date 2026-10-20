// Shared (client + server) multiplayer constants, types and pure helpers.
// Server-only logic (code allocation, lookups) lives in lib/roomsServer.ts.

export const ROOM_CODE_LEN = 6
export const MAX_PLAYERS = 8
export const ROOM_TTL_HOURS = 24

// No I, O, 0, 1 to avoid confusion when reading aloud
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type RoomState = 'lobby' | 'racing' | 'finished'

/** Public, spoiler-free stop info stored on the room doc at race start. */
export interface RoomStop {
  /** Clue doc id — matches players/{uid}.currentClueId. */
  id: string
  order: number
  theme: string | null
  icon: string
}

/**
 * rooms/{roomId}/players/{uid} — readable by any signed-in user, so it holds
 * no sessionId and no email (the session mapping lives server-only in
 * rooms/{roomId}/private/{uid}).
 */
export interface RoomPlayer {
  userId: string
  displayName: string
  photoURL: string | null
  joinedAt: number
  isHost: boolean
  score?: number
  cluesDone?: number
  currentClueId?: string | null
  finishedAt?: number | null
  abandoned?: boolean
}

export interface Room {
  id: string
  code: string
  hostUserId: string
  huntId: string
  huntTitle: string
  cityId: string | null
  tourType?: 'hunt' | 'tour'
  state: RoomState
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  expiresAt: number
  playerCount: number
  maxPlayers?: number
  /** Set when the race starts. */
  stops?: RoomStop[]
  clueCount?: number
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LEN)
}

export function isRoomExpired(room: { expiresAt?: number; state?: string }): boolean {
  if (!room.expiresAt) return false
  return Date.now() > room.expiresAt
}
