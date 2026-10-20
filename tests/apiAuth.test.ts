import { describe, it, expect, vi } from 'vitest'
import { HttpError, id, optionalId, num, oneOf, str, readJson, rateLimit, clientIp } from '@/lib/apiAuth'

function expectHttp(fn: () => unknown, status: number, code: string) {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError)
    expect((e as HttpError).status).toBe(status)
    expect((e as HttpError).code).toBe(code)
    return
  }
  throw new Error('expected HttpError to be thrown')
}

describe('validators', () => {
  it('str accepts non-empty strings within max', () => {
    expect(str('hello', 'name')).toBe('hello')
    expect(str('a'.repeat(10), 'name', 10)).toBe('a'.repeat(10))
  })
  it('str rejects empty, too long and non-strings', () => {
    expectHttp(() => str('', 'name'), 400, 'invalid_name')
    expectHttp(() => str('a'.repeat(11), 'name', 10), 400, 'invalid_name')
    expectHttp(() => str(42, 'name'), 400, 'invalid_name')
    expectHttp(() => str(null, 'name'), 400, 'invalid_name')
  })

  it('id accepts Firestore-safe ids', () => {
    expect(id('utrecht-01_A', 'huntId')).toBe('utrecht-01_A')
  })
  it('id rejects path traversal, slashes, spaces and oversize ids', () => {
    for (const bad of ['a/b', '../x', 'a b', 'é', '', 'x'.repeat(129), 7, undefined, {}]) {
      expectHttp(() => id(bad, 'huntId'), 400, 'invalid_huntId')
    }
  })
  it('optionalId maps empty to null', () => {
    expect(optionalId(undefined, 'roomId')).toBeNull()
    expect(optionalId(null, 'roomId')).toBeNull()
    expect(optionalId('', 'roomId')).toBeNull()
    expect(optionalId('abc', 'roomId')).toBe('abc')
    expectHttp(() => optionalId('a/b', 'roomId'), 400, 'invalid_roomId')
  })

  it('num enforces finite numbers within range', () => {
    expect(num(52.09, 'lat', -90, 90)).toBe(52.09)
    expect(num(-90, 'lat', -90, 90)).toBe(-90)
    for (const bad of [91, -91, NaN, Infinity, '52', null]) {
      expectHttp(() => num(bad, 'lat', -90, 90), 400, 'invalid_lat')
    }
  })

  it('oneOf only allows listed values', () => {
    expect(oneOf(2, 'tier', [1, 2, 3] as const)).toBe(2)
    expect(oneOf('puzzle', 'tier', [1, 2, 3, 'puzzle'] as const)).toBe('puzzle')
    expectHttp(() => oneOf('2', 'tier', [1, 2, 3] as const), 400, 'invalid_tier')
    expectHttp(() => oneOf(undefined, 'tier', [1, 2, 3] as const), 400, 'invalid_tier')
  })
})

describe('readJson', () => {
  const req = (body: string) => new Request('http://x/api', { method: 'POST', body })

  it('parses JSON objects', async () => {
    await expect(readJson(req('{"a":1}'))).resolves.toEqual({ a: 1 })
  })
  it('malformed JSON → 400 invalid_json', async () => {
    await expect(readJson(req('{not json'))).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
  })
  it('non-object JSON → 400 invalid_json', async () => {
    await expect(readJson(req('null'))).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
    await expect(readJson(req('42'))).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
    await expect(readJson(req('"str"'))).rejects.toMatchObject({ status: 400, code: 'invalid_json' })
  })
  it('empty body → 400', async () => {
    await expect(readJson(req(''))).rejects.toMatchObject({ status: 400 })
  })
})

describe('rateLimit', () => {
  it('allows `limit` calls per window then throws 429', () => {
    const key = `test:${Math.random()}`
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000)
    expectHttp(() => rateLimit(key, 3, 60_000), 429, 'rate_limited')
  })
  it('keys are independent', () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    rateLimit(a, 1, 60_000)
    expect(() => rateLimit(b, 1, 60_000)).not.toThrow()
    expect(() => rateLimit(a, 1, 60_000)).toThrow(HttpError)
  })
  it('window resets after it expires', () => {
    vi.useFakeTimers()
    try {
      const key = `reset:${Math.random()}`
      rateLimit(key, 1, 1000)
      expect(() => rateLimit(key, 1, 1000)).toThrow(HttpError)
      vi.advanceTimersByTime(1001)
      expect(() => rateLimit(key, 1, 1000)).not.toThrow()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('clientIp', () => {
  it('takes the first x-forwarded-for hop', () => {
    const r = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })
    expect(clientIp(r)).toBe('1.2.3.4')
    expect(clientIp(new Request('http://x'))).toBe('unknown')
  })
})
