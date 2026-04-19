import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { HINT_COSTS, HintTier } from '@/types'
import { doc, getDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  const { sessionId, clueId, tier } = (await req.json()) as {
    sessionId: string; clueId: string; tier: HintTier
  }

  const cost = HINT_COSTS[tier]
  const sessionRef = doc(db, 'sessions', sessionId)
  const unlockRef = doc(db, 'sessions', sessionId, 'hintUnlocks', `${clueId}_${tier}`)

  const existing = await getDoc(unlockRef)
  if (existing.exists()) return NextResponse.json({ ok: true, alreadyUnlocked: true })

  const sessionSnap = await getDoc(sessionRef)
  if (!sessionSnap.exists()) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  const session = sessionSnap.data()

  if (cost > 0 && session.credits < cost) {
    return NextResponse.json(
      { error: 'Insufficient credits', credits: session.credits, required: cost },
      { status: 402 }
    )
  }

  const batch = writeBatch(db)
  batch.set(unlockRef, {
    clueId,
    tier,
    creditCost: cost,
    unlockedAt: serverTimestamp(),
  })
  if (cost > 0) {
    batch.update(sessionRef, { credits: increment(-cost) })
  }
  await batch.commit()

  const updated = await getDoc(sessionRef)
  return NextResponse.json({ ok: true, creditsRemaining: updated.data()!.credits })
}
