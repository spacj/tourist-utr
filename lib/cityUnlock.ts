import 'server-only'
import type { Transaction, DocumentData } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { CITY_UNLOCK_PRICE_EUROS } from '@/types'

export function cityUnlockId(userId: string, cityId: string): string {
  return `${userId}__${cityId}`
}

export function cityUnlockRef(userId: string, cityId: string) {
  return adminDb().collection('cityUnlocks').doc(cityUnlockId(userId, cityId))
}

export async function isCityUnlocked(userId: string | null | undefined, cityId: string | null | undefined): Promise<boolean> {
  if (!userId || !cityId) return false
  const snap = await cityUnlockRef(userId, cityId).get()
  return snap.exists
}

/**
 * The authoritative unlock price for a city, in euros. Only trusts a sane
 * number from the city doc (1–50 €); anything else falls back to the default.
 */
export function cityPriceEuros(city: DocumentData | undefined | null): number {
  const p = city?.priceEuros
  if (typeof p === 'number' && Number.isFinite(p) && p >= 1 && p <= 50) {
    return Math.round(p * 100) / 100
  }
  return CITY_UNLOCK_PRICE_EUROS
}

export async function loadCityPriceCents(cityId: string): Promise<number | null> {
  const snap = await adminDb().collection('cities').doc(cityId).get()
  if (!snap.exists) return null
  return Math.round(cityPriceEuros(snap.data()) * 100)
}

/**
 * Write a city unlock inside a caller-owned transaction (all reads must have
 * happened before this is called). Used by the shared payment grant in
 * lib/payments.ts, which wraps it with the payments/{orderId} idempotency lock.
 */
export function grantCityUnlock(
  tx: Transaction,
  opts: {
    userId: string
    cityId: string
    orderId: string
    captureId: string
    amountCents: number
    via: 'redirect' | 'webhook'
  },
): void {
  tx.set(cityUnlockRef(opts.userId, opts.cityId), {
    userId: opts.userId,
    cityId: opts.cityId,
    paypalOrderId: opts.orderId,
    paypalCaptureId: opts.captureId,
    amountCents: opts.amountCents,
    completedAt: FieldValue.serverTimestamp(),
    grantedVia: opts.via,
  })
}
