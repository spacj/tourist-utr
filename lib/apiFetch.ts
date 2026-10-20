'use client'
import { auth } from '@/lib/auth'

/**
 * fetch() for our own /api routes. Attaches the current user's Firebase ID
 * token (guests have an anonymous account) so the server can verify who is
 * calling. Never put userId in a request body — the server ignores it.
 */
async function currentToken(): Promise<string | null> {
  // Wait for Firebase to restore the persisted session on cold start.
  await auth.authStateReady()
  const u = auth.currentUser
  if (!u) return null
  try {
    return await u.getIdToken()
  } catch {
    return null
  }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, { ...init, headers })
}

/** POST JSON and parse the JSON reply. Throws ApiError on non-2xx. */
export class ApiError extends Error {
  /** `data` is the full JSON error body (e.g. `{ error, cityId, existing }`). */
  constructor(public status: number, public code: string, public data: Record<string, any> = {}) {
    super(code)
  }
}

export async function apiPost<T = any>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(body ?? {}) })
  return parse<T>(res)
}

export async function apiGet<T = any>(url: string): Promise<T> {
  return parse<T>(await apiFetch(url))
}

async function parse<T>(res: Response): Promise<T> {
  let data: any = null
  try { data = await res.json() } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `http_${res.status}`, data ?? {})
  return data as T
}
