import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { verifyWebhook } from '@/lib/paypal'
import { CITY_UNLOCK_PRICE_EUROS, CREDIT_PACKAGES } from '@/types'
import { cityUnlockId } from '@/lib/cityUnlock'
import { doc, getDoc, setDoc, updateDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'

/**
 * PayPal webhook handler.
 *
 * Subscribed events (configured in PayPal Developer dashboard):
 *   PAYMENT.CAPTURE.COMPLETED  — finalize the unlock / credit pack even if
 *                                 the user closed the tab between paying
 *                                 and the redirect back to /api/.../capture
 *   PAYMENT.CAPTURE.REFUNDED   — revoke an unlock or roll back credits
 *
 * The redirect-based capture routes (/api/city-unlocks/capture and
 * /api/purchases/capture) are kept for the happy path; the webhook is
 * the safety net for users who never make it back. Both paths write the
 * same Firestore docs and check existence before writing, so they're
 * idempotent and order-independent.
 */
export async function POST(req: NextRequest) {
  // We need the raw body for both signature verification and JSON parsing.
  const raw = await req.text()
  let event: any
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const headers: Record<string, string | null> = {
    'paypal-transmission-id':   req.headers.get('paypal-transmission-id'),
    'paypal-transmission-time': req.headers.get('paypal-transmission-time'),
    'paypal-transmission-sig':  req.headers.get('paypal-transmission-sig'),
    'paypal-cert-url':          req.headers.get('paypal-cert-url'),
    'paypal-auth-algo':         req.headers.get('paypal-auth-algo'),
  }

  const verified = await verifyWebhook(headers, event).catch(() => false)
  if (!verified) {
    return NextResponse.json({ error: 'unverified' }, { status: 401 })
  }

  try {
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      await handleCaptureCompleted(event.resource)
    } else if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      await handleCaptureRefunded(event.resource)
    }
    // Other events: acknowledge so PayPal stops retrying.
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Return 500 so PayPal retries.
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }
}

function parseCustomId(resource: any): Record<string, string> | null {
  const raw = resource?.custom_id
    ?? resource?.purchase_units?.[0]?.custom_id
    ?? null
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function handleCaptureCompleted(resource: any) {
  const meta = parseCustomId(resource)
  if (!meta) return
  const captureId = resource.id

  if (meta.kind === 'city_unlock' && meta.cityId && meta.userId) {
    const unlockRef = doc(db, 'cityUnlocks', cityUnlockId(meta.userId, meta.cityId))
    const existing = await getDoc(unlockRef)
    // Idempotent: redirect-based capture may have written this already.
    if (existing.exists()) return

    const citySnap = await getDoc(doc(db, 'cities', meta.cityId))
    const priceEuros = (citySnap.data() as { priceEuros?: number } | undefined)?.priceEuros ?? CITY_UNLOCK_PRICE_EUROS
    await setDoc(unlockRef, {
      userId: meta.userId,
      cityId: meta.cityId,
      paypalCaptureId: captureId,
      amountCents: Math.round(priceEuros * 100),
      completedAt: serverTimestamp(),
      grantedVia: 'webhook',
    })
    return
  }

  if (meta.kind === 'credit_pack' && meta.sessionId && meta.packageId) {
    const pkg = CREDIT_PACKAGES.find(p => p.id === meta.packageId)
    if (!pkg) return

    // Key the purchase doc by capture id so we don't double-credit if the
    // redirect-capture and webhook both fire.
    const purchaseRef = doc(db, 'sessions', meta.sessionId, 'purchases', captureId)
    const existing = await getDoc(purchaseRef)
    if (existing.exists()) return

    await setDoc(purchaseRef, {
      packageId: meta.packageId,
      creditsAdded: pkg.credits,
      amountCents: pkg.priceCents,
      paypalCaptureId: captureId,
      completedAt: serverTimestamp(),
      grantedVia: 'webhook',
    })
    await updateDoc(doc(db, 'sessions', meta.sessionId), {
      credits: increment(pkg.credits),
    })
  }
}

async function handleCaptureRefunded(resource: any) {
  // resource.id is the refund id. PayPal can deliver the same refund event
  // more than once, so every rollback is guarded by a paypalRefunds/{refundId}
  // marker written in the SAME transaction as the mutation — making the whole
  // handler idempotent (a duplicate webhook is a no-op, no double-decrement).
  const meta = parseCustomId(resource)
  if (!meta) return
  const refundId = resource?.id
  if (!refundId) return
  const refundRef = doc(db, 'paypalRefunds', String(refundId))

  if (meta.kind === 'city_unlock' && meta.cityId && meta.userId) {
    const unlockRef = doc(db, 'cityUnlocks', cityUnlockId(meta.userId, meta.cityId))
    await runTransaction(db, async (tx) => {
      const processed = await tx.get(refundRef)
      if (processed.exists()) return
      const unlock = await tx.get(unlockRef)
      tx.set(refundRef, { refundId: String(refundId), kind: 'city_unlock', processedAt: serverTimestamp() })
      if (unlock.exists()) tx.delete(unlockRef)
    }).catch(() => {})
    return
  }

  if (meta.kind === 'credit_pack' && meta.sessionId && meta.packageId) {
    const pkg = CREDIT_PACKAGES.find(p => p.id === meta.packageId)
    if (!pkg) return
    const sessionRef = doc(db, 'sessions', meta.sessionId)
    await runTransaction(db, async (tx) => {
      const processed = await tx.get(refundRef)
      if (processed.exists()) return
      tx.set(refundRef, { refundId: String(refundId), kind: 'credit_pack', processedAt: serverTimestamp() })
      // Roll back the credits we granted; balance may go negative if spent.
      tx.update(sessionRef, { credits: increment(-pkg.credits) })
    }).catch(() => {})
  }
}
