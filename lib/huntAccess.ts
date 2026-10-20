import 'server-only'
import type { DocumentData, Transaction } from 'firebase-admin/firestore'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { HttpError } from '@/lib/apiAuth'
import { cityUnlockRef } from '@/lib/cityUnlock'
import { huntPriceEuros } from '@/types'

/**
 * Who may play which hunt (pricing model, see docs/GAME_DESIGN.md):
 *  - every account gets exactly ONE free hunt of its choice, in any city
 *    (hunts and walking tours alike), recorded as `users/{uid}.freeHuntId`
 *    when the player first starts a hunt they don't otherwise own;
 *  - every other hunt is bought one by one: `huntUnlocks/{uid}__{huntId}`;
 *  - legacy: a city pass bought before the change (`cityUnlocks/{uid}__{cityId}`)
 *    still opens every hunt in that city.
 * All three records are written only here / in lib/payments.ts (Admin SDK);
 * firestore.rules keeps clients away from them.
 */

export type HuntAccess = 'free-used-here' | 'purchased' | 'city-pass' | 'free-available' | 'locked'

export interface AccessState {
  huntId: string
  /** users/{uid}.freeHuntId — the hunt that used the free slot, if any. */
  freeHuntId: string | null
  /** huntUnlocks/{uid}__{huntId} exists. */
  purchased: boolean
  /** Legacy cityUnlocks/{uid}__{cityId} exists for the hunt's city. */
  cityPass: boolean
}

/** Pure access resolution (tested in tests/huntAccess.test.ts). */
export function resolveAccess(s: AccessState): HuntAccess {
  if (s.freeHuntId && s.freeHuntId === s.huntId) return 'free-used-here'
  if (s.purchased) return 'purchased'
  if (s.cityPass) return 'city-pass'
  if (!s.freeHuntId) return 'free-available'
  return 'locked'
}

/** The player already owns the hunt (no free slot or payment needed). */
export function isOwned(a: HuntAccess): boolean {
  return a === 'free-used-here' || a === 'purchased' || a === 'city-pass'
}

export function huntUnlockId(uid: string, huntId: string): string {
  return `${uid}__${huntId}`
}

export function huntUnlockRef(uid: string, huntId: string) {
  return adminDb().collection('huntUnlocks').doc(huntUnlockId(uid, huntId))
}

export function userRef(uid: string) {
  return adminDb().collection('users').doc(uid)
}

export function freeHuntIdOf(user: DocumentData | undefined): string | null {
  const v = user?.freeHuntId
  return typeof v === 'string' && v ? v : null
}

/** The bits of a hunt doc access checks need. */
export interface HuntRef {
  id: string
  cityId?: unknown
  priceEuros?: unknown
}

const cityOf = (hunt: HuntRef): string | null =>
  typeof hunt.cityId === 'string' && hunt.cityId ? hunt.cityId : null

export async function getHuntAccess(uid: string, hunt: HuntRef): Promise<HuntAccess> {
  const cityId = cityOf(hunt)
  const refs = [userRef(uid), huntUnlockRef(uid, hunt.id), ...(cityId ? [cityUnlockRef(uid, cityId)] : [])]
  const [user, unlock, pass] = await adminDb().getAll(...refs)
  return resolveAccess({
    huntId: hunt.id,
    freeHuntId: freeHuntIdOf(user.data()),
    purchased: unlock.exists,
    cityPass: !!pass?.exists,
  })
}

/** The 402 a client turns into "buy this hunt". */
export function huntLockedError(hunt: HuntRef): HttpError {
  return new HttpError(402, 'hunt_locked', {
    huntId: hunt.id,
    cityId: cityOf(hunt),
    priceEuros: huntPriceEuros(hunt),
  })
}

/**
 * Transaction-scoped claim: does all reads now and returns the access plus
 * an `apply()` that performs the free-slot write (call it after every other
 * read in the transaction). Throws hunt_locked when the player can't play.
 */
export async function txClaimHuntAccess(
  tx: Transaction,
  uid: string,
  hunt: HuntRef,
): Promise<{ access: HuntAccess; claimedFree: boolean; apply: () => void }> {
  const cityId = cityOf(hunt)
  const refs = [userRef(uid), huntUnlockRef(uid, hunt.id), ...(cityId ? [cityUnlockRef(uid, cityId)] : [])]
  const [user, unlock, pass] = await tx.getAll(...refs)
  const access = resolveAccess({
    huntId: hunt.id,
    freeHuntId: freeHuntIdOf(user.data()),
    purchased: unlock.exists,
    cityPass: !!pass?.exists,
  })
  if (access === 'locked') throw huntLockedError(hunt)
  const claimedFree = access === 'free-available'
  return {
    access: claimedFree ? 'free-used-here' : access,
    claimedFree,
    apply: () => {
      if (!claimedFree) return
      tx.set(userRef(uid), {
        freeHuntId: hunt.id,
        freeHuntClaimedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    },
  }
}

/**
 * Make sure `uid` may play `hunt`: owned → ok; free slot unused → spend it
 * on this hunt; otherwise throw HttpError(402, 'hunt_locked', { huntId, priceEuros }).
 */
export async function claimHuntAccess(
  uid: string,
  hunt: HuntRef,
): Promise<{ access: HuntAccess; claimedFree: boolean }> {
  return adminDb().runTransaction(async (tx) => {
    const r = await txClaimHuntAccess(tx, uid, hunt)
    r.apply()
    return { access: r.access, claimedFree: r.claimedFree }
  })
}

/** Price of a hunt for payment verification, plus its city (redirect target). */
export async function loadHuntForPayment(huntId: string): Promise<{ priceCents: number; cityId: string | null } | null> {
  const snap = await adminDb().collection('hunts').doc(huntId).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  return {
    priceCents: Math.round(huntPriceEuros(d) * 100),
    cityId: typeof d.cityId === 'string' ? d.cityId : null,
  }
}

/**
 * Write a hunt purchase inside a caller-owned transaction (all reads done).
 * Used by the shared, idempotent payment grant in lib/payments.ts.
 */
export function grantHuntUnlock(
  tx: Transaction,
  opts: {
    uid: string
    huntId: string
    cityId: string | null
    orderId: string
    captureId: string
    amountCents: number
    via: 'redirect' | 'webhook'
  },
): void {
  tx.set(huntUnlockRef(opts.uid, opts.huntId), {
    userId: opts.uid,
    huntId: opts.huntId,
    cityId: opts.cityId,
    paypalOrderId: opts.orderId,
    paypalCaptureId: opts.captureId,
    amountCents: opts.amountCents,
    completedAt: FieldValue.serverTimestamp(),
    grantedVia: opts.via,
  })
}
