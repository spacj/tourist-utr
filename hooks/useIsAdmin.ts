'use client'
import { useEffect, useState } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { auth } from '@/lib/auth'

/**
 * True when the signed-in user's ID token carries the `admin: true` custom
 * claim (granted with `npm run set-admin -- you@example.com`).
 *
 * This only toggles admin UI affordances — every admin action is re-checked
 * server-side against the same verified claim (see requireAdmin in
 * lib/apiAuth.ts). After granting the claim, the user must sign out/in (or
 * wait for the hourly token refresh) for it to show up.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u || u.isAnonymous) {
        if (!cancelled) setIsAdmin(false)
        return
      }
      try {
        const res = await u.getIdTokenResult()
        if (!cancelled) setIsAdmin(res.claims.admin === true)
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    })
    return () => { cancelled = true; unsub() }
  }, [])

  return isAdmin
}
