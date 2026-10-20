import 'server-only'
import type { DocumentReference, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'
import { HttpError, type AuthUser } from '@/lib/apiAuth'

/** Shape of sessions/{id} as written by /api/start-session and rooms/start. */
export interface SessionDoc {
  huntId: string
  userId: string | null
  huntCity?: string | null
  tourType?: 'hunt' | 'tour'
  isFree?: boolean
  cityId?: string | null
  roomId?: string | null
  score?: number
  credits?: number
  streak?: number
  variant?: string
  startedAt?: Timestamp | null
  completedAt?: Timestamp | null
  abandoned?: boolean
  abandonedAt?: Timestamp | null
  /** Coordinates + time of the last confirmed arrival (teleport check). */
  lastArrival?: { clueId: string; lat: number; lng: number; atMs: number } | null
  [k: string]: unknown
}

export function isAbandoned(s: SessionDoc): boolean {
  return s.abandoned === true || !!s.abandonedAt
}

/**
 * Load a session and require that it belongs to the calling user.
 * 404 `session_not_found` / 403 `forbidden`.
 */
export async function loadOwnedSession(
  sessionId: string,
  user: AuthUser,
): Promise<{ ref: DocumentReference; data: SessionDoc }> {
  const ref = adminDb().collection('sessions').doc(sessionId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'session_not_found')
  const data = snap.data() as SessionDoc
  if (!data.userId || data.userId !== user.uid) throw new HttpError(403, 'forbidden')
  if (typeof data.huntId !== 'string' || !data.huntId) throw new HttpError(409, 'no_hunt')
  return { ref, data }
}

export function toMillis(v: unknown): number {
  if (typeof v === 'number') return v
  return (v as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? 0
}
