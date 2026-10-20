import 'server-only'
import { randomInt } from 'node:crypto'
import type { DocumentData } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { isHuntFree } from '@/types'
import { isCityUnlocked } from '@/lib/cityUnlock'
import { CODE_ALPHABET, ROOM_CODE_LEN, normalizeCode, isRoomExpired } from '@/lib/rooms'

/**
 * Server-only multiplayer helpers.
 *
 * Collections:
 *   rooms/{roomId}                    public (signed-in read) room state
 *   rooms/{roomId}/players/{uid}      public player progress (no sessionId/email)
 *   rooms/{roomId}/private/{uid}      server-only { sessionId }
 *   roomCodes/{CODE}                  server-only { roomId, expiresAt } —
 *                                     created with create() so codes are unique
 */

export function generateRoomCode(): string {
  let out = ''
  for (let i = 0; i < ROOM_CODE_LEN; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return out
}

const roomCodeRef = (code: string) => adminDb().collection('roomCodes').doc(code)
export const roomRef = (roomId: string) => adminDb().collection('rooms').doc(roomId)
export const playerRef = (roomId: string, uid: string) => roomRef(roomId).collection('players').doc(uid)
export const privateRef = (roomId: string, uid: string) => roomRef(roomId).collection('private').doc(uid)

function isAlreadyExists(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS'
}

/** Reserve a unique code for `roomId` (atomic via create()). */
export async function allocateRoomCode(roomId: string, expiresAt: number, maxAttempts = 10): Promise<string> {
  const db = adminDb()
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode()
    const ref = roomCodeRef(code)
    try {
      await ref.create({ roomId, expiresAt, createdAt: FieldValue.serverTimestamp() })
      return code
    } catch (e) {
      if (!isAlreadyExists(e)) throw e
      // Taken — reclaim only if the holder has expired.
      const reclaimed = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref)
        const exp = s.data()?.expiresAt
        if (s.exists && typeof exp === 'number' && exp < Date.now()) {
          tx.set(ref, { roomId, expiresAt, createdAt: FieldValue.serverTimestamp() })
          return true
        }
        return false
      })
      if (reclaimed) return code
    }
  }
  throw new Error('Could not allocate unique room code')
}

/** Delete roomCodes/{code} if it still points at roomId. Best effort. */
export async function releaseRoomCode(code: string | undefined | null, roomId: string): Promise<void> {
  if (!code) return
  const ref = roomCodeRef(code)
  try {
    await adminDb().runTransaction(async (tx) => {
      const s = await tx.get(ref)
      if (s.exists && s.data()?.roomId === roomId) tx.delete(ref)
    })
  } catch (e) {
    console.error('[rooms] releaseRoomCode failed', code, e)
  }
}

/** Resolve a code to a live (non-expired) room, or null. */
export async function findRoomByCode(raw: string): Promise<{ id: string; data: DocumentData } | null> {
  const code = normalizeCode(raw)
  if (code.length !== ROOM_CODE_LEN) return null

  const codeSnap = await roomCodeRef(code).get()
  if (codeSnap.exists) {
    const roomId = String(codeSnap.data()?.roomId ?? '')
    const room = roomId ? await roomRef(roomId).get() : null
    if (!room?.exists) {
      await releaseRoomCode(code, roomId)
      return null
    }
    const data = room.data()!
    if (isRoomExpired(data)) {
      await releaseRoomCode(code, roomId)
      return null
    }
    return { id: room.id, data }
  }

  // Legacy rooms created before roomCodes existed (≤ ROOM_TTL_HOURS old).
  const legacy = await adminDb().collection('rooms').where('code', '==', code).limit(1).get()
  if (legacy.empty) return null
  const d = legacy.docs[0]
  if (isRoomExpired(d.data())) return null
  return { id: d.id, data: d.data() }
}

/** The caller's session in a room (server-only mapping, with a legacy fallback). */
export async function getPlayerSessionId(roomId: string, uid: string): Promise<string | null> {
  const priv = await privateRef(roomId, uid).get()
  const sid = priv.data()?.sessionId
  if (typeof sid === 'string') return sid
  const q = await adminDb().collection('sessions')
    .where('roomId', '==', roomId).where('userId', '==', uid).limit(1).get()
  return q.empty ? null : q.docs[0].id
}

/** Same paywall rule as start-session: free first hunt (not tours), else city unlock. */
export function huntIsFree(hunt: DocumentData): boolean {
  return isHuntFree({
    order: typeof hunt.order === 'number' ? hunt.order : 0,
    tourType: hunt.tourType === 'tour' ? 'tour' : 'hunt',
  })
}

export async function userCanPlayHunt(uid: string, hunt: DocumentData): Promise<boolean> {
  if (huntIsFree(hunt)) return true
  return isCityUnlocked(uid, typeof hunt.cityId === 'string' ? hunt.cityId : null)
}

/** Display name from the body (sanitised) → token → 'Player'. */
export function cleanDisplayName(raw: unknown, fallback: string | null): string {
  const pick = (v: unknown) =>
    typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40) : ''
  return pick(raw) || pick(fallback) || 'Player'
}

/** Only https avatar URLs (from the verified token) are stored. */
export function cleanPhotoURL(v: string | null): string | null {
  if (!v || v.length > 1000) return null
  try {
    return new URL(v).protocol === 'https:' ? v : null
  } catch {
    return null
  }
}

export function millis(v: any): number | null {
  if (typeof v === 'number') return v
  return v?.toMillis?.() ?? null
}
