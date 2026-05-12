'use client'
import { useAuth } from '@/components/AuthProvider'

/**
 * Returns true when the signed-in user is on the admin allowlist.
 *
 * Admins are identified by email and configured via the public env var
 * `NEXT_PUBLIC_ADMIN_EMAILS` (comma-separated). For example:
 *   NEXT_PUBLIC_ADMIN_EMAILS=alice@example.com,bob@example.com
 *
 * The env var is read at build time and exposed to the client, so this
 * hook stays cheap (no network call) and works for the rare admin-only
 * UI affordances we need: dev/test buttons that should never ship to
 * normal users.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  if (!user?.email) return false
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? ''
  const allowlist = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(user.email.toLowerCase())
}
