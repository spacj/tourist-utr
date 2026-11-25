import 'server-only'
import type Stripe from 'stripe'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { HttpError, type AuthUser } from '@/lib/apiAuth'
import { stripe } from '@/lib/stripe'
import { creatorRef, getCreator } from '@/lib/creators'
import { currentRates, splitSale } from '@/lib/revenueSplit'
import { huntUnlockRef } from '@/lib/huntAccess'
import { syncCreatorListings } from '@/lib/drafts'
import { link, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/site'
import { huntPriceEuros, isHouseHunt, type CreatorProfile } from '@/types'

/**
 * Creator payments on Stripe Connect (Express accounts, destination charges):
 * the player pays the platform; Stripe moves the creator's share to their
 * connected account at once and keeps the rest (VAT + payment fee +
 * commission, see lib/revenueSplit) as our application fee.
 *
 * Idempotency mirrors lib/payments.ts: one Firestore transaction `create()`s
 * payments/{checkoutSessionId} and sales/{checkoutSessionId}, so redirect +
 * webhook + retries can never grant or book a sale twice.
 */

const META_KIND = 'creator_hunt'

// ── Onboarding ────────────────────────────────────────────────────────────

/** Create the creator's Express account if needed; returns an onboarding link. */
export async function onboardingLink(user: AuthUser, creator: CreatorProfile): Promise<string> {
  let accountId = creator.stripeAccountId ?? null
  if (!accountId) {
    const account = await stripe().accounts.create({
      country: creator.country.toUpperCase(),
      email: user.email ?? undefined,
      business_profile: { product_description: 'Self-guided city hunts sold on TourHunts', url: link(`/creators/${creator.slug}`) },
      controller: {
        stripe_dashboard: { type: 'express' },
        fees: { payer: 'application' },
        losses: { payments: 'application' },
        requirement_collection: 'stripe',
      },
      capabilities: { transfers: { requested: true } },
      metadata: { uid: user.uid },
    })
    accountId = account.id
    await creatorRef(user.uid).update({ stripeAccountId: accountId, updatedAt: FieldValue.serverTimestamp() })
  }
  const linkObj = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${SITE_URL}/studio?stripe=refresh`,
    return_url: `${SITE_URL}/studio?stripe=return`,
  })
  return linkObj.url
}

/** The Stripe flags that decide whether a creator's hunts can be sold. */
export function accountFlags(a: Pick<Stripe.Account, 'capabilities' | 'payouts_enabled'>): { chargesEnabled: boolean; payoutsEnabled: boolean } {
  return {
    // Destination charges only need the transfers capability on the creator's side.
    chargesEnabled: a.capabilities?.transfers === 'active',
    payoutsEnabled: a.payouts_enabled === true,
  }
}

/** Pull the account from Stripe, store its flags, relist/unlist hunts. */
export async function syncStripeAccount(account: Stripe.Account): Promise<void> {
  const db = adminDb()
  let uid = typeof account.metadata?.uid === 'string' ? account.metadata.uid : null
  if (!uid) {
    const q = await db.collection('creators').where('stripeAccountId', '==', account.id).limit(1).get()
    uid = q.docs[0]?.id ?? null
  }
  if (!uid) return
  const snap = await creatorRef(uid).get()
  if (!snap.exists || snap.data()?.stripeAccountId !== account.id) return
  const flags = accountFlags(account)
  await creatorRef(uid).update({ ...flags, updatedAt: FieldValue.serverTimestamp() })
  await syncCreatorListings(uid)
}

export async function refreshStripeAccount(uid: string): Promise<CreatorProfile | null> {
  const creator = await getCreator(uid)
  if (!creator?.stripeAccountId) return creator
  await syncStripeAccount(await stripe().accounts.retrieve(creator.stripeAccountId))
  return getCreator(uid)
}

export async function expressDashboardLink(creator: CreatorProfile): Promise<string> {
  if (!creator.stripeAccountId) throw new HttpError(409, 'stripe_not_connected')
  return (await stripe().accounts.createLoginLink(creator.stripeAccountId)).url
}

// ── Checkout ──────────────────────────────────────────────────────────────

/** Stripe Checkout for one creator hunt. Caller already checked ownership. */
export async function createCreatorCheckout(opts: {
  uid: string
  email: string | null
  huntId: string
  hunt: Record<string, unknown>
}): Promise<string> {
  const { uid, huntId, hunt } = opts
  if (isHouseHunt(hunt)) throw new HttpError(400, 'not_a_creator_hunt')
  const creatorUid = String(hunt.ownerUid)
  const creator = await getCreator(creatorUid)
  if (!creator?.stripeAccountId || !creator.chargesEnabled || creator.status !== 'active') {
    throw new HttpError(409, 'creator_cannot_sell')
  }
  const cityId = typeof hunt.cityId === 'string' ? hunt.cityId : ''
  const grossCents = Math.round(huntPriceEuros(hunt) * 100)
  const rates = currentRates(creator)
  const split = splitSale(grossCents, rates)
  const title = typeof hunt.title === 'string' ? hunt.title.slice(0, 80) : huntId

  const metadata = {
    kind: META_KIND,
    uid,
    huntId,
    cityId,
    creatorUid,
    grossCents: String(split.grossCents),
    vatCents: String(split.vatCents),
    paymentFeeCents: String(split.paymentFeeCents),
    commissionCents: String(split.commissionCents),
    creatorCents: String(split.creatorCents),
  }

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    client_reference_id: uid,
    customer_email: opts.email ?? undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: grossCents,
        product_data: { name: `TourHunts — ${title}`, description: `By ${creator.displayName}` },
      },
    }],
    payment_intent_data: {
      application_fee_amount: split.platformFeeCents,
      transfer_data: { destination: creator.stripeAccountId },
      metadata,
      description: `TourHunts — ${title}`,
    },
    metadata,
    success_url: `${SITE_URL}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/city/${encodeURIComponent(cityId)}?paypal=cancelled&hunt=${encodeURIComponent(huntId)}`,
  })
  if (!session.url) throw new HttpError(502, 'checkout_failed')
  return session.url
}

// ── Grant + ledger ──────────────────────────────────────────────────────────

export type StripeOutcome =
  | { status: 'granted' | 'already' | 'pending' | 'refunded' | 'ignored'; huntId: string | null; cityId: string | null }

const intOf = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN)

/**
 * Turn a completed Checkout Session into a hunt unlock + a sale. Safe to call
 * from the success redirect, the webhook and retries in any order.
 */
export async function processCreatorCheckout(session: Stripe.Checkout.Session, via: 'redirect' | 'webhook'): Promise<StripeOutcome> {
  const m = session.metadata ?? {}
  const huntId = typeof m.huntId === 'string' ? m.huntId : null
  const cityId = typeof m.cityId === 'string' && m.cityId ? m.cityId : null
  if (m.kind !== META_KIND || !huntId || !m.uid || !m.creatorUid) return { status: 'ignored', huntId, cityId }
  if (session.payment_status !== 'paid') return { status: 'pending', huntId, cityId }

  const gross = intOf(m.grossCents)
  const parts = {
    vatCents: intOf(m.vatCents), paymentFeeCents: intOf(m.paymentFeeCents),
    commissionCents: intOf(m.commissionCents), creatorCents: intOf(m.creatorCents),
  }
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
  const moneyOk = session.currency === 'eur' && session.amount_total === gross && Object.values(parts).every(Number.isFinite)

  const db = adminDb()
  const paymentRef = db.collection('payments').doc(session.id)
  const saleRef = db.collection('sales').doc(session.id)
  const unlockRef = huntUnlockRef(m.uid, huntId)

  const result = await db.runTransaction(async (tx) => {
    const [payment, unlock, hunt] = await tx.getAll(paymentRef, unlockRef, db.collection('hunts').doc(huntId))
    if (payment.exists) return payment.data()?.status === 'granted' ? 'already' : 'refund-done'
    const base = {
      provider: 'stripe', kind: 'hunt_unlock', uid: m.uid, huntId, cityId, creatorUid: m.creatorUid,
      checkoutSessionId: session.id, paymentIntentId, amountCents: session.amount_total ?? null,
      currency: session.currency ?? null, grantedVia: via, createdAt: FieldValue.serverTimestamp(),
    }
    if (!moneyOk || unlock.exists) {
      tx.create(paymentRef, { ...base, status: 'rejected', rejectReason: moneyOk ? 'already_owned' : 'amount_mismatch' })
      return 'refund'
    }
    tx.create(paymentRef, { ...base, status: 'granted' })
    tx.set(unlockRef, {
      userId: m.uid, huntId, cityId, amountCents: gross,
      stripeCheckoutSessionId: session.id, stripePaymentIntentId: paymentIntentId,
      completedAt: FieldValue.serverTimestamp(), grantedVia: via,
    })
    tx.create(saleRef, {
      huntId,
      huntTitle: typeof hunt.data()?.title === 'string' ? hunt.data()?.title : huntId,
      creatorUid: m.creatorUid,
      buyerUid: m.uid,
      grossCents: gross,
      ...parts,
      platformFeeCents: gross - parts.creatorCents,
      currency: 'EUR',
      status: 'paid',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      createdAt: FieldValue.serverTimestamp(),
      refundedAt: null,
    })
    return 'granted'
  })

  if (result === 'refund' && paymentIntentId) {
    // Money mismatch or a double purchase: give the money back in full.
    try {
      await stripe().refunds.create({ payment_intent: paymentIntentId, reverse_transfer: true, refund_application_fee: true })
    } catch (e) {
      console.error('[stripe] auto-refund failed — refund by hand', session.id, e)
      await db.collection('paymentIssues').add({ reason: 'stripe_auto_refund_failed', sessionId: session.id, createdAt: FieldValue.serverTimestamp() })
    }
    return { status: 'refunded', huntId, cityId }
  }
  if (result === 'refund-done') return { status: 'refunded', huntId, cityId }
  if (result === 'granted') {
    const creator = await getCreator(m.creatorUid)
    const email = (await creatorRef(m.creatorUid).get()).data()?.email
    if (creator) {
      await sendEmail({
        to: typeof email === 'string' ? email : null,
        subject: 'You sold a hunt on TourHunts',
        text: `Someone just bought one of your hunts. Your share: €${(parts.creatorCents / 100).toFixed(2)}.\n\nSee your sales: ${link('/studio')}`,
      })
    }
  }
  return { status: result === 'granted' ? 'granted' : 'already', huntId, cityId }
}

/** Full refund or lost dispute → revoke the unlock and mark the sale refunded. */
export async function processCreatorRefund(paymentIntentId: string, full: boolean): Promise<void> {
  const db = adminDb()
  const sales = await db.collection('sales').where('stripePaymentIntentId', '==', paymentIntentId).limit(1).get()
  const saleDoc = sales.docs[0]
  if (!saleDoc) return
  if (!full) {
    await db.collection('paymentIssues').add({
      reason: 'stripe_partial_refund', saleId: saleDoc.id, paymentIntentId, createdAt: FieldValue.serverTimestamp(),
    })
    return
  }
  await db.runTransaction(async (tx) => {
    const sale = await tx.get(saleDoc.ref)
    const s = sale.data()
    if (!s || s.status === 'refunded') return
    const unlockRef = huntUnlockRef(s.buyerUid, s.huntId)
    const [unlock, payment] = await tx.getAll(unlockRef, db.collection('payments').doc(saleDoc.id))
    if (unlock.exists && unlock.data()?.stripePaymentIntentId === paymentIntentId) tx.delete(unlockRef)
    tx.update(saleDoc.ref, { status: 'refunded', refundedAt: FieldValue.serverTimestamp() })
    if (payment.exists) tx.update(payment.ref, { status: 'refunded', revokedAt: FieldValue.serverTimestamp() })
  })
}

/** Admin refund: money back to the player, the creator's share reversed. */
export async function refundSale(saleId: string): Promise<void> {
  const sale = await adminDb().collection('sales').doc(saleId).get()
  const s = sale.data()
  if (!s) throw new HttpError(404, 'sale_not_found')
  if (s.status === 'refunded') throw new HttpError(409, 'already_refunded')
  if (!s.stripePaymentIntentId) throw new HttpError(409, 'no_payment_intent')
  await stripe().refunds.create({
    payment_intent: s.stripePaymentIntentId,
    reverse_transfer: true,
    refund_application_fee: true,
  })
  // The charge.refunded webhook does the same; doing it now keeps the admin view current.
  await processCreatorRefund(s.stripePaymentIntentId, true)
}
