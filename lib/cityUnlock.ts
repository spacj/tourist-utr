import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export function cityUnlockId(userId: string, cityId: string): string {
  return `${userId}__${cityId}`
}

export async function isCityUnlocked(userId: string | null | undefined, cityId: string): Promise<boolean> {
  if (!userId) return false
  const snap = await getDoc(doc(db, 'cityUnlocks', cityUnlockId(userId, cityId)))
  return snap.exists()
}
