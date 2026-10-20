import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { claimHuntAccess } from '@/lib/huntAccess'
import { toMillis } from '@/lib/sessionServer'
import { normalizeDifficulty } from '@/lib/clueView'
import { STARTING_CREDITS } from '@/types'

/**
 * POST /api/start-session  — Authorization: Bearer <ID token> (guests = anonymous)
 * Body: { huntId }
 * → { sessionId, resumed, tourType }
 */
export const POST = handle(async (req) => {
  const user = await requireUser(req)
  rateLimit(`start-session:${user.uid}`, 10, 60_000)
  const body = await readJson(req)
  const huntId = id(body.huntId, 'huntId')
  const db = adminDb()

  const huntSnap = await db.collection('hunts').doc(huntId).get()
  if (!huntSnap.exists) throw new HttpError(404, 'hunt_not_found')
  const hunt = huntSnap.data() as {
    cityId?: string; city?: string; order?: number; tourType?: 'hunt' | 'tour'; active?: boolean
    difficulty?: string; priceEuros?: unknown
  }
  if (hunt.active === false) throw new HttpError(404, 'hunt_not_found')

  const tourType: 'hunt' | 'tour' = hunt.tourType === 'tour' ? 'tour' : 'hunt'
  const cityId = hunt.cityId ?? null

  // ── Resume an in-progress session for this user + hunt ── checked before
  // the paywall: resuming never spends the free hunt or asks for payment
  // (also keeps sessions started under the old per-city model working).
  const existing = await db.collection('sessions')
    .where('userId', '==', user.uid)
    .where('huntId', '==', huntId)
    .get()
  const inProgress = existing.docs
    .filter(d => {
      const s = d.data()
      return !s.completedAt && s.abandoned !== true && !s.abandonedAt && !s.roomId
    })
    .sort((a, b) => toMillis(b.data().startedAt) - toMillis(a.data().startedAt))
  if (inProgress.length) {
    return NextResponse.json({ sessionId: inProgress[0].id, resumed: true, tourType })
  }

  const cluesSnap = await db.collection('hunts').doc(huntId).collection('clues')
    .orderBy('order').limit(1).get()
  if (cluesSnap.empty) throw new HttpError(404, 'no_clues')
  const firstClue = cluesSnap.docs[0]

  // ── Paywall ── owned (bought / free hunt spent here / legacy city pass),
  // else spend the account's one free hunt on this one, else 402.
  let claimedFree = false
  try {
    claimedFree = (await claimHuntAccess(user.uid, { id: huntId, cityId, priceEuros: hunt.priceEuros })).claimedFree
  } catch (e) {
    // Guests can't buy — tell the client to sign in first.
    if (e instanceof HttpError && e.code === 'hunt_locked' && user.isAnonymous) {
      throw new HttpError(401, 'sign_in_required', e.extra)
    }
    throw e
  }

  const sessionRef = db.collection('sessions').doc()
  const batch = db.batch()
  batch.set(sessionRef, {
    huntId,
    huntCity: hunt.city || null,
    userId: user.uid,
    tourType,
    // This play-through spent the account's one free hunt.
    isFree: claimedFree,
    cityId,
    difficulty: normalizeDifficulty(hunt.difficulty),
    score: 0,
    credits: tourType === 'tour' ? 0 : STARTING_CREDITS,
    startedAt: FieldValue.serverTimestamp(),
    completedAt: null,
    lastArrival: null,
  })
  batch.set(sessionRef.collection('sessionClues').doc(firstClue.id), {
    clueId: firstClue.id,
    unlockedAt: FieldValue.serverTimestamp(),
    arrivedAt: null,
    pointsEarned: 0,
  })
  await batch.commit()

  return NextResponse.json({ sessionId: sessionRef.id, resumed: false, tourType })
})
