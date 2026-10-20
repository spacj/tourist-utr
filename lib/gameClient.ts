'use client'
import { normalizePuzzleAnswer } from '@/types'

/** Client helpers for the hunt game. */

export async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/**
 * Offline puzzle check against the view's answerHashes
 * (sha256 of `${huntId}:${clueId}:${normalizedAnswer}`).
 * Returns null when it can't be checked (no WebCrypto).
 */
export async function checkAnswerOffline(
  huntId: string, clueId: string, answer: string, hashes: string[],
): Promise<boolean | null> {
  const n = normalizePuzzleAnswer(answer)
  if (!n) return false
  const h = await sha256Hex(`${huntId}:${clueId}:${n}`)
  if (h === null) return null
  return hashes.includes(h)
}

/** Replace {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

/** i18n key for an API error code (fallback: generic). */
export function errorKey(code: string | undefined | null): string {
  switch (code) {
    case 'insufficient_credits': return 'errInsufficientCredits'
    case 'offline':
    case 'network': return 'errOffline'
    case 'rate_limited': return 'errRateLimited'
    case 'implausible_speed': return 'errImplausibleSpeed'
    case 'session_abandoned': return 'errGameAbandoned'
    case 'clue_not_active': return 'errClueNotActive'
    case 'no_attempts_left': return 'errNoAttemptsLeft'
    case 'unauthenticated':
    case 'forbidden': return 'errForbidden'
    case 'checkout_failed':
    case 'paypal_error': return 'errCheckout'
    default: return 'errGeneric'
  }
}

/** True when an error means "couldn't reach the server" rather than "server said no". */
export function isNetworkFailure(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)
}

export function vibrate(pattern: number | number[]) {
  try { (navigator as any).vibrate?.(pattern) } catch {}
}
