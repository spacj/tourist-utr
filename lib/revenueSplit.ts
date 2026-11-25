import { DEFAULT_COMMISSION_BPS, DEFAULT_PAYMENT_FEE_BPS } from '@/types'

/**
 * How one creator-hunt sale is divided. Pure, integer cents only (tested in
 * tests/revenueSplit.test.ts).
 *
 * The platform sells creator hunts in its own name (EU deemed-supplier rule
 * for digital services sold through a platform), so it collects and remits
 * the VAT on the full price. From the price the player pays:
 *   1. VAT is taken out (prices are VAT-inclusive);
 *   2. a payment fee of PAYMENT_FEE_BPS (3%) of the price paid, which covers Stripe;
 *   3. the platform commission of PLATFORM_COMMISSION_BPS (20%) of the
 *      price excluding VAT;
 *   the rest goes to the creator. The creator's share is rounded down to the
 *   cent; the parts always add up to the price exactly.
 *
 *   gross 500 (€5.00), VAT 21%, fee 3%, commission 20%
 *   net        = round(500 / 1.21)                  = 413   vat = 87
 *   creator    = floor(413 × 0.80 − 500 × 0.03)      = 315
 *   paymentFee = round(500 × 0.03)                   = 15
 *   commission = 413 − 15 − 315                      = 83
 *   platformFee (Stripe application_fee) = 500 − 315 = 185
 *
 * VAT is a single configured rate for now (NL 21%); per-buyer-country OSS
 * rates are a later step.
 */

export const DEFAULT_VAT_RATE_BPS = 2100

export interface RevenueSplit {
  grossCents: number
  vatCents: number
  /** gross − VAT. */
  netCents: number
  /** The payment-processing share (3% of gross). */
  paymentFeeCents: number
  /** The platform commission (20% of net). */
  commissionCents: number
  /** Paid to the creator's Stripe account. */
  creatorCents: number
  /** Kept by the platform = VAT + payment fee + commission (Stripe `application_fee_amount`). */
  platformFeeCents: number
}

export interface SplitRates {
  commissionBps: number
  vatBps: number
  paymentFeeBps: number
}

function bps(v: unknown, fallback: number): number {
  // Number('') is 0: an empty env var must mean "default", never 0%.
  const n = typeof v === 'string' ? (v.trim() ? Number(v) : NaN) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 10_000 ? n : fallback
}

/** PLATFORM_COMMISSION_BPS (default 2000 = 20% of the price excl. VAT). */
export function defaultCommissionBps(): number {
  return bps(process.env.PLATFORM_COMMISSION_BPS, DEFAULT_COMMISSION_BPS)
}

/** PAYMENT_FEE_BPS (default 300 = 3% of the price paid). */
export function paymentFeeBps(): number {
  return bps(process.env.PAYMENT_FEE_BPS, DEFAULT_PAYMENT_FEE_BPS)
}

/** VAT_RATE_BPS (default 2100 = 21%). */
export function vatRateBps(): number {
  return bps(process.env.VAT_RATE_BPS, DEFAULT_VAT_RATE_BPS)
}

/** A creator's commission override if it is a sane value, else the default. */
export function commissionBpsFor(creator: { commissionBps?: unknown } | null | undefined): number {
  return bps(creator?.commissionBps, defaultCommissionBps())
}

/** The rates that apply to a sale by this creator right now. */
export function currentRates(creator: { commissionBps?: unknown } | null | undefined): SplitRates {
  return { commissionBps: commissionBpsFor(creator), vatBps: vatRateBps(), paymentFeeBps: paymentFeeBps() }
}

const isBps = (n: number) => Number.isInteger(n) && n >= 0 && n <= 10_000

export function splitSale(grossCents: number, rates: SplitRates): RevenueSplit {
  const { commissionBps, vatBps, paymentFeeBps: feeBps } = rates
  if (!Number.isInteger(grossCents) || grossCents < 0) throw new Error('grossCents must be a non-negative integer')
  if (!isBps(commissionBps) || !isBps(vatBps) || !isBps(feeBps)) throw new Error('invalid rate')
  const netCents = Math.round((grossCents * 10_000) / (10_000 + vatBps))
  const vatCents = grossCents - netCents
  const paymentFeeCents = Math.round((grossCents * feeBps) / 10_000)
  const creatorCents = Math.max(0, Math.floor((netCents * (10_000 - commissionBps) - grossCents * feeBps) / 10_000))
  const commissionCents = Math.max(0, netCents - paymentFeeCents - creatorCents)
  return {
    grossCents,
    vatCents,
    netCents,
    paymentFeeCents,
    commissionCents,
    creatorCents,
    platformFeeCents: grossCents - creatorCents,
  }
}
