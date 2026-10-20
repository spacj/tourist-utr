import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'

/**
 * Shared plumbing for API routes:
 *  - identity comes ONLY from a verified Firebase ID token
 *    (`Authorization: Bearer <token>`), never from the request body;
 *  - HttpError + `handle()` turn thrown errors into clean JSON responses
 *    without leaking internals;
 *  - small validators and an in-memory rate limiter.
 */

export class HttpError extends Error {
  /** `extra` fields are sent next to `error` in the JSON body (e.g. huntId, priceEuros). */
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) {
    super(code)
  }
}

export interface AuthUser {
  uid: string
  /** Guests play under a Firebase anonymous account. */
  isAnonymous: boolean
  email: string | null
  displayName: string | null
  photoURL: string | null
  /** Set via the `admin: true` custom claim (see scripts/set-admin.mjs). */
  isAdmin: boolean
}

export async function getAuthUser(req: NextRequest | Request): Promise<AuthUser | null> {
  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  try {
    const t = await adminAuth().verifyIdToken(match[1])
    return {
      uid: t.uid,
      isAnonymous: t.firebase?.sign_in_provider === 'anonymous',
      email: t.email ?? null,
      displayName: (t.name as string | undefined) ?? null,
      photoURL: (t.picture as string | undefined) ?? null,
      isAdmin: t.admin === true,
    }
  } catch {
    return null
  }
}

/**
 * Require a verified user. Anonymous (guest) accounts are allowed unless
 * `registered: true` is passed — e.g. multiplayer and purchases tied to a
 * permanent account.
 */
export async function requireUser(
  req: NextRequest | Request,
  opts: { registered?: boolean } = {},
): Promise<AuthUser> {
  const user = await getAuthUser(req)
  if (!user) throw new HttpError(401, 'unauthenticated')
  if (opts.registered && user.isAnonymous) throw new HttpError(403, 'account_required')
  return user
}

export async function requireAdmin(req: NextRequest | Request): Promise<AuthUser> {
  const user = await requireUser(req, { registered: true })
  if (!user.isAdmin) throw new HttpError(403, 'not_admin')
  return user
}

/** Parse a JSON body; malformed JSON becomes a 400 instead of a 500. */
export async function readJson<T = Record<string, unknown>>(req: NextRequest | Request): Promise<T> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object') return body as T
  } catch {}
  throw new HttpError(400, 'invalid_json')
}

// ── Validators ──────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/

/** A Firestore document id coming from the client. */
export function str(v: unknown, field: string, max = 128): string {
  if (typeof v !== 'string' || !v || v.length > max) throw new HttpError(400, `invalid_${field}`)
  return v
}

export function id(v: unknown, field: string): string {
  const s = str(v, field)
  if (!ID_RE.test(s)) throw new HttpError(400, `invalid_${field}`)
  return s
}

export function optionalId(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === '') return null
  return id(v, field)
}

export function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new HttpError(400, `invalid_${field}`)
  }
  return v
}

export function oneOf<T extends string | number>(v: unknown, field: string, allowed: readonly T[]): T {
  if (!allowed.includes(v as T)) throw new HttpError(400, `invalid_${field}`)
  return v as T
}

// ── Rate limiting ───────────────────────────────────────────────────────
// Best-effort, per server instance. Good enough to blunt brute force on
// puzzle answers and room codes; put a CDN/WAF limit in front for more.

const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    if (buckets.size > 10_000) {
      buckets.forEach((v, k) => { if (v.reset < now) buckets.delete(k) })
    }
    return
  }
  b.count++
  if (b.count > limit) throw new HttpError(429, 'rate_limited')
}

export function clientIp(req: NextRequest | Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

// ── Error boundary ──────────────────────────────────────────────────────

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>

/** Wrap a route handler: HttpError → JSON status, anything else → logged 500. */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ ...(e.extra ?? {}), error: e.code }, { status: e.status })
      }
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, e)
      return NextResponse.json({ error: 'server_error' }, { status: 500 })
    }
  }
}
