import { describe, it, expect, vi } from 'vitest'
import { encodeCustomId, parseCustomId, toCents, verifyCaptureMoney, siteOrigin, type PaymentMeta } from '@/lib/payments'
import { paypalMode, PayPalError } from '@/lib/paypal'
import { cityPriceEuros, cityUnlockId } from '@/lib/cityUnlock'
import { CREDIT_PACKAGES, CITY_UNLOCK_PRICE_EUROS } from '@/types'

const city: PaymentMeta = { kind: 'city_unlock', uid: 'uidABC123', cityId: 'utrecht' }
const hunt: PaymentMeta = { kind: 'hunt_unlock', uid: 'uidABC123', huntId: 'utrecht_classic' }
const pack: PaymentMeta = { kind: 'credit_pack', uid: 'uidABC123', sessionId: 'sess_42', packageId: 'medium' }
const guestPack: PaymentMeta = { kind: 'credit_pack', uid: null, sessionId: 'sess_42', packageId: 'small' }

describe('custom_id encode / parse', () => {
  it('round-trips every kind', () => {
    for (const m of [hunt, city, pack, guestPack]) expect(parseCustomId(encodeCustomId(m))).toEqual(m)
  })

  it('fits PayPal\'s 127-char limit for max-length Firebase uids', () => {
    const m: PaymentMeta = { kind: 'credit_pack', uid: 'u'.repeat(28), sessionId: 's'.repeat(20), packageId: 'medium' }
    expect(encodeCustomId(m).length).toBeLessThanOrEqual(127)
    const h: PaymentMeta = { kind: 'hunt_unlock', uid: 'u'.repeat(28), huntId: 'h'.repeat(60) }
    expect(encodeCustomId(h).length).toBeLessThanOrEqual(127)
  })

  it('refuses to encode oversize ids', () => {
    expect(() => encodeCustomId({ kind: 'city_unlock', uid: 'u'.repeat(120), cityId: 'utrecht' })).toThrow()
    expect(() => encodeCustomId({ kind: 'hunt_unlock', uid: 'u'.repeat(120), huntId: 'h1' })).toThrow()
  })

  it('rejects tampered / malformed values without throwing', () => {
    const bad: unknown[] = [
      undefined, null, 42, '', 'not json', '[]', 'null', '{}',
      JSON.stringify({ k: 'x', u: 'a', c: 'b' }),                        // unknown kind
      JSON.stringify({ k: 'c', u: 'a/b', c: 'utrecht' }),                // path in uid
      JSON.stringify({ k: 'c', u: 'uid', c: '../cities/x' }),            // path in cityId
      JSON.stringify({ k: 'c', u: 'uid' }),                              // missing city
      JSON.stringify({ k: 'h', u: 'uid' }),                              // missing hunt
      JSON.stringify({ k: 'h', u: 'uid', h: '../hunts/x' }),             // path in huntId
      JSON.stringify({ k: 'h', u: 'a b', h: 'h1' }),                     // bad uid
      JSON.stringify({ k: 'p', u: 'uid', s: 'sess', p: 7 }),             // non-string package
      JSON.stringify({ k: 'p', u: 'uid', s: 'a b', p: 'small' }),        // space in session
      JSON.stringify({ k: 'c', u: 'uid', c: 'x'.repeat(129) }),          // too long
      'x'.repeat(600),
    ]
    for (const b of bad) expect(parseCustomId(b), String(b)).toBeNull()
  })

  it('a credit pack with an invalid uid falls back to a guest (uid null)', () => {
    expect(parseCustomId(JSON.stringify({ k: 'p', u: 'bad uid', s: 'sess', p: 'small' })))
      .toEqual({ kind: 'credit_pack', uid: null, sessionId: 'sess', packageId: 'small' })
  })

  it('accepts the legacy pre-overhaul format', () => {
    expect(parseCustomId(JSON.stringify({ kind: 'city_unlock', userId: 'u1', cityId: 'utrecht' })))
      .toEqual({ kind: 'city_unlock', uid: 'u1', cityId: 'utrecht' })
    expect(parseCustomId(JSON.stringify({ kind: 'credit_pack', sessionId: 's1', packageId: 'large', userId: 'u1' })))
      .toEqual({ kind: 'credit_pack', uid: null, sessionId: 's1', packageId: 'large' })
  })
})

describe('toCents', () => {
  it('parses PayPal decimal strings exactly', () => {
    expect(toCents('5.00')).toBe(500)
    expect(toCents('5')).toBe(500)
    expect(toCents('2.49')).toBe(249)
    expect(toCents('0.99')).toBe(99)
    expect(toCents('4.9')).toBe(490)
  })
  it('rejects anything that is not a plain non-negative amount', () => {
    for (const v of ['', '-5.00', '5.001', '5,00', '1e3', ' 5.00', 'abc', '.5']) expect(toCents(v), v).toBeNull()
  })
})

describe('verifyCaptureMoney (expected amount)', () => {
  const info = (amountValue: string, over: Partial<{ currency: string; payeeMerchantId: string | null }> = {}) => ({
    orderId: 'ORDER1', amountValue, currency: 'EUR', payeeMerchantId: null, ...over,
  })

  it('hunt unlock: must pay exactly the hunt price', () => {
    expect(verifyCaptureMoney(info('5.00'), hunt, 500, undefined)).toEqual({ problem: null, expectedCents: 500, credits: 0 })
    expect(verifyCaptureMoney(info('4.99'), hunt, 500, undefined).problem).toBe('wrong_amount')
    expect(verifyCaptureMoney(info('0.00'), hunt, 500, undefined).problem).toBe('wrong_amount')
    expect(verifyCaptureMoney(info('7.50'), hunt, 750, undefined).problem).toBeNull()
    expect(verifyCaptureMoney(info('5.00', { currency: 'USD' }), hunt, 500, undefined).problem).toBe('wrong_currency')
  })

  it('hunt unlock for an unknown hunt is rejected', () => {
    expect(verifyCaptureMoney(info('5.00'), hunt, null, undefined).problem).toBe('unknown_hunt')
  })

  it('legacy city unlock: must pay exactly the city price', () => {
    expect(verifyCaptureMoney(info('5.00'), city, 500, undefined)).toEqual({ problem: null, expectedCents: 500, credits: 0 })
    expect(verifyCaptureMoney(info('4.99'), city, 500, undefined).problem).toBe('wrong_amount')
    expect(verifyCaptureMoney(info('50.00'), city, 500, undefined).problem).toBe('wrong_amount')
    expect(verifyCaptureMoney(info('7.50'), city, 750, undefined).problem).toBeNull()
  })

  it('city unlock for an unknown city is rejected', () => {
    expect(verifyCaptureMoney(info('5.00'), city, null, undefined).problem).toBe('unknown_city')
  })

  it('credit packs: price and credits come from CREDIT_PACKAGES', () => {
    for (const pkg of CREDIT_PACKAGES) {
      const meta: PaymentMeta = { kind: 'credit_pack', uid: null, sessionId: 's', packageId: pkg.id }
      const r = verifyCaptureMoney(info((pkg.priceCents / 100).toFixed(2)), meta, null, undefined)
      expect(r).toEqual({ problem: null, expectedCents: pkg.priceCents, credits: pkg.credits })
    }
  })

  it('unknown package / missing meta are rejected', () => {
    const meta: PaymentMeta = { kind: 'credit_pack', uid: null, sessionId: 's', packageId: 'mega' }
    expect(verifyCaptureMoney(info('0.99'), meta, null, undefined).problem).toBe('unknown_package')
    expect(verifyCaptureMoney(info('5.00'), null, 500, undefined).problem).toBe('bad_custom_id')
  })

  it('wrong currency is rejected', () => {
    expect(verifyCaptureMoney(info('5.00', { currency: 'USD' }), city, 500, undefined).problem).toBe('wrong_currency')
  })

  it('payee check only when PAYPAL_MERCHANT_ID is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(verifyCaptureMoney(info('5.00', { payeeMerchantId: 'OTHER' }), city, 500, undefined).problem).toBeNull()
    expect(verifyCaptureMoney(info('5.00', { payeeMerchantId: 'OTHER' }), city, 500, 'ME').problem).toBe('wrong_payee')
    expect(verifyCaptureMoney(info('5.00', { payeeMerchantId: 'ME' }), city, 500, 'ME').problem).toBeNull()
    // Missing payee id: allowed but logged.
    expect(verifyCaptureMoney(info('5.00'), city, 500, 'ME').problem).toBeNull()
    expect(warn).toHaveBeenCalled()
  })
})

describe('cityPriceEuros (legacy city passes)', () => {
  it('trusts sane prices from the city doc', () => {
    expect(cityPriceEuros({ priceEuros: 7.5 })).toBe(7.5)
    expect(cityPriceEuros({ priceEuros: 1 })).toBe(1)
    expect(cityPriceEuros({ priceEuros: 50 })).toBe(50)
    expect(cityPriceEuros({ priceEuros: 4.999 })).toBe(5)
  })
  it('falls back to the default for missing or absurd prices', () => {
    for (const p of [undefined, null, 0, 0.5, -5, 51, 1e9, NaN, Infinity, '5']) {
      expect(cityPriceEuros({ priceEuros: p })).toBe(CITY_UNLOCK_PRICE_EUROS)
    }
    expect(cityPriceEuros(undefined)).toBe(CITY_UNLOCK_PRICE_EUROS)
  })
  it('unlock doc id combines user and city', () => {
    expect(cityUnlockId('u1', 'utrecht')).toBe('u1__utrecht')
  })
})

describe('paypalMode', () => {
  it('accepts live and sandbox outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('PAYPAL_MODE', 'sandbox')
    expect(paypalMode()).toBe('sandbox')
    vi.stubEnv('PAYPAL_MODE', 'live')
    expect(paypalMode()).toBe('live')
  })
  it('rejects missing or misspelled modes', () => {
    vi.stubEnv('NODE_ENV', 'development')
    for (const m of ['', 'Live', 'production', 'sandbox ']) {
      vi.stubEnv('PAYPAL_MODE', m)
      expect(() => paypalMode()).toThrow(PayPalError)
    }
  })
  it('production requires live …', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYPAL_ALLOW_SANDBOX', '')
    vi.stubEnv('PAYPAL_MODE', 'sandbox')
    expect(() => paypalMode()).toThrow(/sandbox PayPal refused/)
    vi.stubEnv('PAYPAL_MODE', 'live')
    expect(paypalMode()).toBe('live')
  })
  it('… unless PAYPAL_ALLOW_SANDBOX=true (staging)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYPAL_MODE', 'sandbox')
    vi.stubEnv('PAYPAL_ALLOW_SANDBOX', 'true')
    expect(paypalMode()).toBe('sandbox')
    vi.stubEnv('PAYPAL_ALLOW_SANDBOX', '1')
    expect(() => paypalMode()).toThrow(PayPalError)
  })
})

describe('siteOrigin', () => {
  it('uses NEXT_PUBLIC_SITE_URL origin only', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://tourhunts.example/some/path?x=1')
    expect(siteOrigin()).toBe('https://tourhunts.example')
  })
  it('throws in production when unset, localhost in dev', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => siteOrigin()).toThrow()
    vi.stubEnv('NODE_ENV', 'development')
    expect(siteOrigin()).toBe('http://localhost:3000')
  })
})
