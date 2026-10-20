import 'server-only'
import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { CREDIT_PACKAGES } from '@/types'
import { cityUnlockRef, grantCityUnlock, loadCityPriceCents } from '@/lib/cityUnlock'
import { freeHuntIdOf, grantHuntUnlock, huntUnlockRef, loadHuntForPayment, userRef } from '@/lib/huntAccess'
import { refundCapture, getCapture, type CaptureInfo } from '@/lib/paypal'

/**
 * Shared, idempotent payment processing for the redirect capture routes and
 * the PayPal webhook.
 *
 * Idempotency: inside ONE Firestore transaction we `create()` both
 *   payments/{paypalOrderId}          (the full record)
 *   paymentsByCapture/{captureId}     ({ orderId } — lookup for refunds)
 * and apply the grant. `create()` fails if the doc exists, so redirect +
 * refresh + webhook can never grant the same order twice.
 *
 * Trust: the grant is derived ONLY from the PayPal-verified order (custom_id,
 * amount, currency, payee), never from query params or the caller.
 */

// ── Site origin (never from request headers) ────────────────────────────

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (raw) return new URL(raw).origin
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must be set in production')
  }
  return 'http://localhost:3000'
}

/** 303 redirect to a same-site path. Used by the browser-facing capture routes. */
export function redirectTo(path: string): NextResponse {
  let origin = 'http://localhost:3000'
  try { origin = siteOrigin() } catch (e) { console.error('[payments]', e) }
  return NextResponse.redirect(new URL(path, origin), 303)
}

// ── custom_id (PayPal limit: 127 chars) ─────────────────────────────────

export type PaymentMeta =
  /** One hunt (the current pricing model). */
  | { kind: 'hunt_unlock'; uid: string; huntId: string }
  /** Legacy city pass: no longer sold, still captured/refunded for old orders. */
  | { kind: 'city_unlock'; uid: string; cityId: string }
  | { kind: 'credit_pack'; uid: string | null; sessionId: string; packageId: string }

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/
const okId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v)

export function encodeCustomId(meta: PaymentMeta): string {
  const compact = meta.kind === 'hunt_unlock'
    ? { k: 'h', u: meta.uid, h: meta.huntId }
    : meta.kind === 'city_unlock'
      ? { k: 'c', u: meta.uid, c: meta.cityId }
      : { k: 'p', u: meta.uid, s: meta.sessionId, p: meta.packageId }
  const s = JSON.stringify(compact)
  if (s.length > 127) throw new Error('custom_id too long')
  return s
}

/** Never throws. Accepts the compact format and the legacy pre-audit one. */
export function parseCustomId(raw: unknown): PaymentMeta | null {
  if (typeof raw !== 'string' || !raw || raw.length > 512) return null
  let o: any
  try { o = JSON.parse(raw) } catch { return null }
  if (!o || typeof o !== 'object') return null

  if (o.k === 'h' && okId(o.u) && okId(o.h)) return { kind: 'hunt_unlock', uid: o.u, huntId: o.h }
  if (o.k === 'c' && okId(o.u) && okId(o.c)) return { kind: 'city_unlock', uid: o.u, cityId: o.c }
  if (o.k === 'p' && okId(o.s) && okId(o.p)) {
    return { kind: 'credit_pack', uid: okId(o.u) ? o.u : null, sessionId: o.s, packageId: o.p }
  }
  // Legacy orders created before the security overhaul.
  if (o.kind === 'city_unlock' && okId(o.userId) && okId(o.cityId)) {
    return { kind: 'city_unlock', uid: o.userId, cityId: o.cityId }
  }
  if (o.kind === 'credit_pack' && okId(o.sessionId) && okId(o.packageId)) {
    return { kind: 'credit_pack', uid: null, sessionId: o.sessionId, packageId: o.packageId }
  }
  return null
}

export function toCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  return Math.round(parseFloat(value) * 100)
}

/**
 * Pure check that a capture pays exactly for what its custom_id says was
 * bought. `unlockPriceCents` is the authoritative price of the hunt (or, for
 * legacy orders, the city) — null = unknown hunt/city; `merchantId` is
 * PAYPAL_MERCHANT_ID (payee check skipped if unset).
 */
export function verifyCaptureMoney(
  info: Pick<CaptureInfo, 'orderId' | 'amountValue' | 'currency' | 'payeeMerchantId'>,
  meta: PaymentMeta | null,
  unlockPriceCents: number | null,
  merchantId: string | undefined,
): { problem: string | null; expectedCents: number | null; credits: number } {
  let problem: string | null = null
  let expectedCents: number | null = null
  let credits = 0
  if (!meta) {
    problem = 'bad_custom_id'
  } else if (meta.kind === 'hunt_unlock') {
    expectedCents = unlockPriceCents
    if (expectedCents === null) problem = 'unknown_hunt'
  } else if (meta.kind === 'city_unlock') {
    expectedCents = unlockPriceCents
    if (expectedCents === null) problem = 'unknown_city'
  } else {
    const pkg = CREDIT_PACKAGES.find(p => p.id === meta.packageId)
    if (!pkg) problem = 'unknown_package'
    else { expectedCents = pkg.priceCents; credits = pkg.credits }
  }
  if (!problem && info.currency !== 'EUR') problem = 'wrong_currency'
  if (!problem && toCents(info.amountValue) !== expectedCents) problem = 'wrong_amount'
  if (!problem && merchantId) {
    if (!info.payeeMerchantId) console.warn('[payments] capture without payee merchant id', info.orderId)
    else if (info.payeeMerchantId !== merchantId) problem = 'wrong_payee'
  }
  return { problem, expectedCents, credits }
}

// ── Grant ───────────────────────────────────────────────────────────────

export type CaptureOutcome =
  /** Granted now, or already granted earlier (idempotent replay). */
  | { status: 'granted'; meta: PaymentMeta; already: boolean }
  /** Payment didn't match what we sell — refunded (or refund queued for manual review). */
  | { status: 'refunded'; meta: PaymentMeta | null }
  /** PayPal holds the money (e.g. eCheck). The webhook grants on COMPLETED. */
  | { status: 'pending'; meta: PaymentMeta | null }
  /** Capture declined/failed or the refund of a bad payment failed. */
  | { status: 'failed'; meta: PaymentMeta | null }

export async function processCapture(info: CaptureInfo, via: 'redirect' | 'webhook'): Promise<CaptureOutcome> {
  const meta = parseCustomId(info.customId)

  if (info.status === 'PENDING') return { status: 'pending', meta }
  if (info.status !== 'COMPLETED') return { status: 'failed', meta }

  // ── Verify the money matches what the custom_id says was bought ──
  const hunt = meta?.kind === 'hunt_unlock' ? await loadHuntForPayment(meta.huntId) : null
  const unlockPriceCents = meta?.kind === 'hunt_unlock'
    ? (hunt?.priceCents ?? null)
    : meta?.kind === 'city_unlock' ? await loadCityPriceCents(meta.cityId) : null
  const { problem, expectedCents, credits } = verifyCaptureMoney(
    info, meta, unlockPriceCents, process.env.PAYPAL_MERCHANT_ID,
  )
  const huntCityId = hunt?.cityId ?? null

  const db = adminDb()
  const paymentRef = db.collection('payments').doc(info.orderId)
  const captureRef = db.collection('paymentsByCapture').doc(info.captureId)

  const txResult = await db.runTransaction(async (tx) => {
    const [p, c] = await tx.getAll(paymentRef, captureRef)
    if (p.exists || c.exists) {
      let prior = p.exists ? p.data() : undefined
      if (!prior && c.exists) {
        const other = await tx.get(db.collection('payments').doc(String(c.data()?.orderId)))
        prior = other.data()
      }
      return { already: true as const, rejected: prior?.status === 'rejected' }
    }

    let reject = problem
    if (!reject && meta?.kind === 'city_unlock') {
      const unlock = await tx.get(cityUnlockRef(meta.uid, meta.cityId))
      // Paid twice (two tabs) — keep the first unlock, refund this one.
      if (unlock.exists && unlock.data()?.paypalOrderId !== info.orderId) reject = 'already_unlocked'
    }
    if (!reject && meta?.kind === 'hunt_unlock') {
      const reads = [userRef(meta.uid), huntUnlockRef(meta.uid, meta.huntId),
        ...(huntCityId ? [cityUnlockRef(meta.uid, huntCityId)] : [])]
      const [u, unlock, pass] = await tx.getAll(...reads)
      // Paid twice (two tabs), or already owned via the free slot / a legacy
      // city pass — keep what they have, refund this one.
      if (unlock.exists && unlock.data()?.paypalOrderId !== info.orderId) reject = 'already_unlocked'
      else if (freeHuntIdOf(u.data()) === meta.huntId) reject = 'already_unlocked'
      else if (pass?.exists) reject = 'already_unlocked'
    }
    if (!reject && meta?.kind === 'credit_pack') {
      const s = await tx.get(db.collection('sessions').doc(meta.sessionId))
      if (!s.exists) reject = 'session_not_found'
      else if (meta.uid && s.data()?.userId && s.data()?.userId !== meta.uid) reject = 'session_owner_mismatch'
    }

    tx.create(paymentRef, {
      orderId: info.orderId,
      captureId: info.captureId,
      kind: meta?.kind ?? 'unknown',
      uid: meta?.uid ?? null,
      cityId: meta?.kind === 'city_unlock' ? meta.cityId : meta?.kind === 'hunt_unlock' ? huntCityId : null,
      huntId: meta?.kind === 'hunt_unlock' ? meta.huntId : null,
      sessionId: meta?.kind === 'credit_pack' ? meta.sessionId : null,
      packageId: meta?.kind === 'credit_pack' ? meta.packageId : null,
      credits: meta?.kind === 'credit_pack' ? credits : null,
      amountValue: info.amountValue,
      currency: info.currency,
      payeeMerchantId: info.payeeMerchantId,
      expectedCents,
      status: reject ? 'rejected' : 'granted',
      rejectReason: reject,
      grantedVia: via,
      createdAt: FieldValue.serverTimestamp(),
    })
    tx.create(captureRef, { orderId: info.orderId, createdAt: FieldValue.serverTimestamp() })

    if (!reject && meta) {
      if (meta.kind === 'hunt_unlock') {
        grantHuntUnlock(tx, {
          uid: meta.uid,
          huntId: meta.huntId,
          cityId: huntCityId,
          orderId: info.orderId,
          captureId: info.captureId,
          amountCents: expectedCents ?? 0,
          via,
        })
      } else if (meta.kind === 'city_unlock') {
        grantCityUnlock(tx, {
          userId: meta.uid,
          cityId: meta.cityId,
          orderId: info.orderId,
          captureId: info.captureId,
          amountCents: expectedCents ?? 0,
          via,
        })
      } else {
        const sessionRef = db.collection('sessions').doc(meta.sessionId)
        tx.update(sessionRef, { credits: FieldValue.increment(credits) })
        tx.set(sessionRef.collection('purchases').doc(info.orderId), {
          packageId: meta.packageId,
          creditsAdded: credits,
          amountCents: expectedCents,
          paypalOrderId: info.orderId,
          paypalCaptureId: info.captureId,
          completedAt: FieldValue.serverTimestamp(),
          grantedVia: via,
        })
      }
    }
    return { already: false as const, reject }
  })

  if (txResult.already) {
    if (txResult.rejected) return { status: 'refunded', meta }
    return meta ? { status: 'granted', meta, already: true } : { status: 'failed', meta }
  }
  if (!txResult.reject && meta) return { status: 'granted', meta, already: false }

  // ── Rejected: refund automatically and leave a trail for review ──
  const reason = txResult.reject ?? 'rejected'
  console.error('[payments] rejecting capture', info.orderId, info.captureId, reason)
  let refundId: string | null = null
  let refundError: string | null = null
  try {
    refundId = (await refundCapture(info.captureId, 'TourHunts could not apply this payment and refunded it automatically.')).refundId
  } catch (e) {
    refundError = e instanceof Error ? e.message : String(e)
    console.error('[payments] automatic refund FAILED — refund manually', info.captureId, e)
  }
  await db.collection('paymentIssues').add({
    orderId: info.orderId,
    captureId: info.captureId,
    reason,
    customId: info.customId,
    amountValue: info.amountValue,
    currency: info.currency,
    payeeMerchantId: info.payeeMerchantId,
    expectedCents,
    refundId,
    refundError,
    via,
    createdAt: FieldValue.serverTimestamp(),
  }).catch(e => console.error('[payments] could not record paymentIssue', e))
  await paymentRef.update({ refundId, refundError }).catch(e => console.error('[payments] update failed', e))

  return refundError ? { status: 'failed', meta } : { status: 'refunded', meta }
}

/** A previously processed order (redirect refresh) — avoids re-calling PayPal. */
export async function priorPayment(orderId: string): Promise<{
  status: 'granted' | 'refunded' | 'failed'
  cityId: string | null
  huntId: string | null
  sessionId: string | null
} | null> {
  const snap = await adminDb().collection('payments').doc(orderId).get()
  if (!snap.exists) return null
  const p = snap.data() ?? {}
  return {
    status: p.status === 'rejected' ? (p.refundError ? 'failed' : 'refunded') : 'granted',
    cityId: typeof p.cityId === 'string' ? p.cityId : null,
    huntId: typeof p.huntId === 'string' ? p.huntId : null,
    sessionId: typeof p.sessionId === 'string' ? p.sessionId : null,
  }
}

// ── Refunds / reversals (webhook)───────────────────────────────────────

/** Capture id a refund resource belongs to (from its `up` link). */
function captureIdOfRefund(resource: any): string | null {
  const links: any[] = Array.isArray(resource?.links) ? resource.links : []
  for (const l of links) {
    const m = typeof l?.href === 'string' ? l.href.match(/\/v2\/payments\/captures\/([A-Za-z0-9]+)/) : null
    if (m && (l.rel === 'up' || !links.some(x => x?.rel === 'up'))) return m[1]
  }
  return null
}

/**
 * PAYMENT.CAPTURE.REFUNDED / REVERSED. Looks the payment up by capture id
 * (custom_id is not reliably present on refund resources). Only a FULL
 * refund/reversal revokes the grant; partial refunds are logged for review.
 * Throws on failure so the webhook answers 500 and PayPal retries.
 */
export async function processRefund(resource: any, eventType: string): Promise<void> {
  const refundId = typeof resource?.id === 'string' ? resource.id : null
  const captureId = captureIdOfRefund(resource) ?? (eventType === 'PAYMENT.CAPTURE.REVERSED' ? refundId : null)
  if (!refundId || !captureId) {
    console.error('[payments] refund event without refund/capture id', eventType, refundId)
    return
  }

  const db = adminDb()
  const map = await db.collection('paymentsByCapture').doc(captureId).get()
  if (!map.exists) {
    console.error('[payments] refund for unknown capture — handle manually', captureId, refundId)
    await db.collection('paymentIssues').add({
      reason: 'refund_unknown_capture', captureId, refundId, eventType, createdAt: FieldValue.serverTimestamp(),
    })
    return
  }
  const orderId = String(map.data()?.orderId)

  const capture = await getCapture(captureId)
  const full = capture.status === 'REFUNDED' || capture.status === 'REVERSED'
  if (!full) {
    console.warn('[payments] partial refund — grant kept', captureId, refundId, capture.status)
    await db.collection('paymentIssues').add({
      reason: 'partial_refund', orderId, captureId, refundId, captureStatus: capture.status,
      refundAmount: resource?.amount?.value ?? null, createdAt: FieldValue.serverTimestamp(),
    })
    return
  }

  const paymentRef = db.collection('payments').doc(orderId)
  const markerRef = db.collection('paypalRefunds').doc(refundId)
  await db.runTransaction(async (tx) => {
    const [marker, payment] = await tx.getAll(markerRef, paymentRef)
    if (marker.exists) return
    const p = payment.data()
    const markerData = { refundId, captureId, orderId, eventType, processedAt: FieldValue.serverTimestamp() }
    if (!p || p.status !== 'granted') {
      // Our own automatic refund of a rejected payment, or already revoked.
      tx.set(markerRef, { ...markerData, revoked: false })
      return
    }

    if (p.kind === 'hunt_unlock' && p.uid && p.huntId) {
      const unlockRef = huntUnlockRef(p.uid, p.huntId)
      const unlock = await tx.get(unlockRef)
      if (unlock.exists && unlock.data()?.paypalOrderId === orderId) tx.delete(unlockRef)
    } else if (p.kind === 'city_unlock' && p.uid && p.cityId) {
      const unlockRef = cityUnlockRef(p.uid, p.cityId)
      const unlock = await tx.get(unlockRef)
      if (unlock.exists && unlock.data()?.paypalOrderId === orderId) tx.delete(unlockRef)
    } else if (p.kind === 'credit_pack' && p.sessionId && typeof p.credits === 'number') {
      const sessionRef = db.collection('sessions').doc(p.sessionId)
      const s = await tx.get(sessionRef)
      // Balance may go negative if the credits were already spent.
      if (s.exists) tx.update(sessionRef, { credits: FieldValue.increment(-p.credits) })
    }
    tx.update(paymentRef, { status: 'refunded_by_paypal', revokedAt: FieldValue.serverTimestamp(), refundId })
    tx.set(markerRef, { ...markerData, revoked: true })
  })
}
