import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { HINT_COSTS, HintTier } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  const { sessionId, clueId, tier } = (await req.json()) as {
    sessionId: string; clueId: string; tier: HintTier
  }

  const cost = HINT_COSTS[tier]
  const sessionRef = db.collection('sessions').doc(sessionId)
  const unlockId = `${clueId}_${tier}`
  const unlockRef = sessionRef.collection('hintUnlocks').doc(unlockId)

  const existing = await unlockRef.get()
  if (existing.exists) return NextResponse.json({ ok: true, alreadyUnlocked: true })

  const sessionSnap = await sessionRef.get()
  if (!sessionSnap.exists) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const session = sessionSnap.data()!

  if (cost > 0 && session.credits < cost) {
    return NextResponse.json(
      { error: 'Insufficient credits', credits: session.credits, required: cost },
      { status: 402 }
    )
  }

  const batch = db.batch()
  batch.set(unlockRef, {
    clueId,
    tier,
    creditCost: cost,
    unlockedAt: FieldValue.serverTimestamp(),
  })
  if (cost > 0) {
    batch.update(sessionRef, { credits: FieldValue.increment(-cost) })
  }
  await batch.commit()

  const updated = await sessionRef.get()
  return NextResponse.json({ ok: true, creditsRemaining: updated.data()!.credits })
}
