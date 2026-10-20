import { ApiError } from '@/lib/apiFetch'

/** Error code of a failed api call ('network' when the request never got a reply). */
export function errorCode(e: unknown): string {
  if (e instanceof ApiError) return e.code
  return 'network'
}

/**
 * i18n key for a generic, user-facing message about a failed api call.
 * Callers handle the flow-specific codes themselves and fall back to this.
 */
export function errorKey(e: unknown): string {
  if (!(e instanceof ApiError)) return 'errNetwork'
  if (e.status === 429) return 'errTooMany'
  if (e.code === 'unauthenticated' || e.code === 'sign_in_required' || e.code === 'account_required') return 'errSignIn'
  if (e.status === 404) return 'errNotFound'
  return 'errGeneric'
}
