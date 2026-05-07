import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { verifyWebhook } from '@/lib/paypal'
import { CITY_UNLOCK_PRICE_EUROS, CREDIT_PACKAGES } from '@/types'
import { cityUnlockId } from '@/lib/cityUnlock'
import { doc, getDoc, setDoc, updateDoc, increment, deleteDoc, serverTimestamp } from 'firebase/firestore'

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
  // resource.id is the refund id; resource.links contains a "up" link to the
  // original capture. PayPal also sends the captured order's metadata via
  // custom_id on most refund payloads.
  const meta = parseCustomId(resource)
  if (!meta) return

  if (meta.kind === 'city_unlock' && meta.cityId && meta.userId) {
    const unlockRef = doc(db, 'cityUnlocks', cityUnlockId(meta.userId, meta.cityId))
    const existing = await getDoc(unlockRef)
    if (existing.exists()) {
      await deleteDoc(unlockRef)
    }
    return
  }

  if (meta.kind === 'credit_pack' && meta.sessionId && meta.packageId) {
    const pkg = CREDIT_PACKAGES.find(p => p.id === meta.packageId)
    if (!pkg) return
    // Credits were spent or partially spent — we just decrement back what we
    // gave and let the balance go negative if necessary. If you want a
    // smarter rollback (e.g. revoke unused only), do it here.
    const sessionRef = doc(db, 'sessions', meta.sessionId)
    await updateDoc(sessionRef, {
      credits: increment(-pkg.credits),
    }).catch(() => {})
  }
}
