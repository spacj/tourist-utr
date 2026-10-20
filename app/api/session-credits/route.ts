import { NextResponse } from 'next/server'
import { handle, requireUser, id } from '@/lib/apiAuth'
import { loadOwnedSession } from '@/lib/sessionServer'

export const dynamic = 'force-dynamic'

/**
 * GET /api/session-credits?session=<sessionId> — Authorization: Bearer <ID token>.
 * → { credits }  (own sessions only)
 */
export const GET = handle(async (req) => {
  const user = await requireUser(req)
  const sessionId = id(req.nextUrl.searchParams.get('session'), 'session')
  const { data } = await loadOwnedSession(sessionId, user)
  return NextResponse.json({ credits: typeof data.credits === 'number' ? data.credits : 0 })
})
