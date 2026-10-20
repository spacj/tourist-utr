'use client'
import { apiFetch } from '@/lib/apiFetch'

/**
 * POST to a rooms endpoint and keep the full JSON body on errors —
 * create/join put extra fields next to `error` (`existing`; for hunt_locked
 * `huntId`, `cityId`, `priceEuros`).
 * Network failures resolve to { ok:false, status:0, error:'network' }.
 */
export async function roomPost<T = any>(url: string, body: unknown): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: string; data: any }
> {
  try {
    const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(body ?? {}) })
    let data: any = null
    try { data = await res.json() } catch {}
    if (res.ok) return { ok: true, data: data as T }
    return { ok: false, status: res.status, error: data?.error ?? `http_${res.status}`, data }
  } catch {
    return { ok: false, status: 0, error: 'network', data: null }
  }
}

/** i18n key for a create/join/get failure code. */
export function roomErrorKey(error: string, status = 0): string {
  switch (error) {
    case 'invalid_code':
    case 'not_found': return 'invalidRoomCode'
    case 'room_full': return 'roomFull'
    case 'race_started': return 'errRaceStarted'
    case 'hunt_not_found':
    case 'no_clues': return 'huntUnavailable'
    case 'hunt_locked': return 'errHuntLockedRoom'
    case 'account_required':
    case 'unauthenticated': return 'signInToPlayMp'
    case 'network': return 'errNetwork'
    default: return status === 429 ? 'errTooMany' : 'errGeneric'
  }
}
