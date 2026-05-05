import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Server-side helpers for the `userActiveRooms/{userId}` collection.
 * This is the source of truth for "what room is this user currently in?"
 * across devices — replacing the per-device localStorage approach.
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

export async function setUserActiveRoom(
  userId: string,
  data: Omit<UserActiveRoomDoc, 'updatedAt' | 'joinedAt'> & { joinedAt?: number }
): Promise<void> {
  await setDoc(
    doc(db, 'userActiveRooms', userId),
    {
      ...data,
      joinedAt: data.joinedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function getUserActiveRoom(userId: string): Promise<UserActiveRoomDoc | null> {
  const snap = await getDoc(doc(db, 'userActiveRooms', userId))
  if (!snap.exists()) return null
  return snap.data() as UserActiveRoomDoc
}

export async function clearUserActiveRoom(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'userActiveRooms', userId))
}

export async function isUserInOtherRoom(userId: string, currentRoomId?: string): Promise<UserActiveRoomDoc | null> {
  const existing = await getUserActiveRoom(userId)
  if (!existing) return null
  if (existing.roomId === currentRoomId) return null
  // Only block if the other room is still in lobby or racing — finished is fine to overwrite.
  if (existing.state === 'finished') return null
  return existing
}
