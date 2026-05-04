import { db } from '@/lib/firebase'
import {
  collection, doc, getDoc, getDocs, query, where, limit, serverTimestamp,
} from 'firebase/firestore'

export const ROOM_CODE_LEN = 6
export const MAX_PLAYERS = 8
export const ROOM_TTL_HOURS = 24

// No I, O, 0, 1 to avoid confusion when reading aloud
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type RoomState = 'lobby' | 'racing' | 'finished'

export interface RoomPlayer {
  userId: string
  displayName: string
  photoURL: string | null
  joinedAt: number
  isHost: boolean
  sessionId?: string | null
  score?: number
  cluesDone?: number
  finishedAt?: number | null
}

export interface Room {
  id: string
  code: string
  hostUserId: string
  huntId: string
  huntTitle: string
  cityId: string | null
  state: RoomState
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  expiresAt: number
  playerCount: number
}

export function generateRoomCode(): string {
  let out = ''
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LEN)
}

export async function findRoomByCode(code: string): Promise<{ id: string; data: any } | null> {
  const norm = normalizeCode(code)
  if (norm.length !== ROOM_CODE_LEN) return null
  const snap = await getDocs(
    query(collection(db, 'rooms'), where('code', '==', norm), limit(1))
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, data: d.data() }
}

export async function generateUniqueCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode()
    const existing = await findRoomByCode(code)
    if (!existing) return code
  }
  throw new Error('Could not allocate unique room code')
}

export function isRoomExpired(room: { expiresAt?: number; state?: string }): boolean {
  if (!room.expiresAt) return false
  return Date.now() > room.expiresAt
}
