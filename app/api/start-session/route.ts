import { NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireUser, readJson, id, rateLimit, HttpError } from '@/lib/apiAuth'
import { isCityUnlocked } from '@/lib/cityUnlock'
import { toMillis } from '@/lib/sessionServer'
import { normalizeDifficulty } from '@/lib/clueView'
import { STARTING_CREDITS, isHuntFree } from '@/types'

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
    difficulty?: string
  }
  if (hunt.active === false) throw new HttpError(404, 'hunt_not_found')

  // ── City-unlock gate ── exactly one freebie per city (first hunt, never a
  // tour). The free hunt is complete — no stop limit.
  const tourType: 'hunt' | 'tour' = hunt.tourType === 'tour' ? 'tour' : 'hunt'
  const isFree = isHuntFree({ order: hunt.order ?? 0, tourType })
  const cityId = hunt.cityId ?? null
  if (!isFree) {
    const unlocked = cityId ? await isCityUnlocked(user.uid, cityId) : false
    if (!unlocked) {
      // Guests can't own a city unlock — tell the client to sign in first.
      return user.isAnonymous
        ? NextResponse.json({ error: 'sign_in_required', cityId }, { status: 401 })
        : NextResponse.json({ error: 'city_locked', cityId }, { status: 402 })
    }
  }

  // ── Resume an in-progress session for this user + hunt ──
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

  const sessionRef = db.collection('sessions').doc()
  const batch = db.batch()
  batch.set(sessionRef, {
    huntId,
    huntCity: hunt.city || null,
    userId: user.uid,
    tourType,
    isFree,
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
