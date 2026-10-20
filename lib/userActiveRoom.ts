import 'server-only'
import type { Transaction } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'

/**
 * Server-side helpers for the `userActiveRooms/{userId}` collection (readable
 * by its owner only). Source of truth for "what room is this user currently
 * in?" across devices.
 *
 * Lifecycle:
 *   create room      → upsert {state:'lobby'}
 *   join room        → upsert {state:'lobby'}
 *   host starts race → upsert {state:'racing', sessionId}
 *   user finishes    → upsert {state:'finished'}
 *   user leaves      → delete (lobby only — racing players keep the record so they can resume)
 *   user dismisses   → delete (finished only — explicit user action)
 */

export type ActiveRoomState = 'lobby' | 'racing' | 'finished'

export interface UserActiveRoomDoc {
  roomId: string
  code: string
  huntId: string
  huntTitle: string
  state: ActiveRoomState
  sessionId: string | null
  joinedAt?: any
  updatedAt?: any
}

type ActiveInput = Omit<UserActiveRoomDoc, 'updatedAt' | 'joinedAt'>

export function userActiveRoomRef(userId: string) {
  return adminDb().collection('userActiveRooms').doc(userId)
}

function payload(data: ActiveInput, setJoinedAt: boolean) {
  return {
    ...data,
    ...(setJoinedAt ? { joinedAt: FieldValue.serverTimestamp() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

export async function setUserActiveRoom(userId: string, data: ActiveInput, setJoinedAt = true): Promise<void> {
  await userActiveRoomRef(userId).set(payload(data, setJoinedAt), { merge: true })
}

/** Transaction variant (writes only — do your reads first). */
export function txSetUserActiveRoom(tx: Transaction, userId: string, data: ActiveInput, setJoinedAt = true): void {
  tx.set(userActiveRoomRef(userId), payload(data, setJoinedAt), { merge: true })
}

export async function getUserActiveRoom(userId: string): Promise<UserActiveRoomDoc | null> {
  const snap = await userActiveRoomRef(userId).get()
  if (!snap.exists) return null
  return snap.data() as UserActiveRoomDoc
}

export async function clearUserActiveRoom(userId: string): Promise<void> {
  await userActiveRoomRef(userId).delete()
}

/** Clear the pointer only if it still points at `roomId`. */
export async function clearUserActiveRoomIf(userId: string, roomId: string): Promise<void> {
  const ref = userActiveRoomRef(userId)
  await adminDb().runTransaction(async (tx) => {
    const s = await tx.get(ref)
    if (s.exists && s.data()?.roomId === roomId) tx.delete(ref)
  })
}

export async function isUserInOtherRoom(userId: string, currentRoomId?: string): Promise<UserActiveRoomDoc | null> {
  const existing = await getUserActiveRoom(userId)
  if (!existing) return null
  if (existing.roomId === currentRoomId) return null
  // Only block if the other room is still in lobby or racing — finished is fine to overwrite.
  if (existing.state === 'finished') return null
  // Stale pointer (room deleted or expired) never blocks.
  const room = await adminDb().collection('rooms').doc(existing.roomId).get()
  const expiresAt = room.data()?.expiresAt
  if (!room.exists || (typeof expiresAt === 'number' && Date.now() > expiresAt)) return null
  return existing
}
