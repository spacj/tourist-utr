import { redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

async function startSession(formData: FormData) {
  'use server'
  const huntId = formData.get('huntId') as string

  const huntSnap = await db.collection('hunts').doc(huntId).get()
  if (!huntSnap.exists) throw new Error('Hunt not found')

  const cluesSnap = await db.collection('hunts').doc(huntId)
    .collection('clues').orderBy('order').limit(1).get()
  if (cluesSnap.empty) throw new Error('No clues found')

  const firstClue = cluesSnap.docs[0]

  const sessionRef = db.collection('sessions').doc()
  await sessionRef.set({
    huntId,
    score: 0,
    credits: STARTING_CREDITS,
    startedAt: FieldValue.serverTimestamp(),
    completedAt: null,
  })

  await sessionRef.collection('sessionClues').doc(firstClue.id).set({
    clueId: firstClue.id,
    unlockedAt: FieldValue.serverTimestamp(),
    arrivedAt: null,
    pointsEarned: 0,
  })

  redirect(`/hunt?session=${sessionRef.id}`)
}

export default async function HomePage() {
  const huntsSnap = await db.collection('hunts').where('active', '==', true).get()
  const hunts = huntsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  return (
    <main style={{
      minHeight: '100dvh', background: '#0d0d14', color: '#eeedf8',
      fontFamily: 'system-ui, sans-serif', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 8 }}>Utrecht scavenger hunt</h1>
        <p style={{ fontSize: 14, color: '#8b8aaa', marginBottom: 32, lineHeight: 1.65 }}>
          Explore the city by solving riddles. You start with 10 free hint credits.
        </p>

        {hunts.map((hunt: any) => (
          <form key={hunt.id} action={startSession} style={{ marginBottom: 12 }}>
            <input type="hidden" name="huntId" value={hunt.id} />
            <button type="submit" style={{
              width: '100%', background: '#6c63f5', color: '#fff', border: 'none',
              borderRadius: 12, padding: '16px 20px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div>{hunt.title}</div>
                <div style={{ fontSize: 12, fontWeight: 400, opacity: .75, marginTop: 2 }}>{hunt.description}</div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </button>
          </form>
        ))}

        <p style={{ fontSize: 12, color: '#56556a', marginTop: 24 }}>
          Starts with 10 free hint credits · Explore Utrecht on foot
        </p>
      </div>
    </main>
  )
}
