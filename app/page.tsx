import { redirect } from 'next/navigation'
import { db } from '@/lib/firebase'
import { STARTING_CREDITS } from '@/types'
import {
  collection, doc, getDocs, getDoc, setDoc, query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore'

export const dynamic = 'force-dynamic'

async function startSession(formData: FormData) {
  'use server'
  const huntId = formData.get('huntId') as string

  const huntSnap = await getDoc(doc(db, 'hunts', huntId))
  if (!huntSnap.exists()) throw new Error('Hunt not found')

  const cluesSnap = await getDocs(
    query(collection(db, 'hunts', huntId, 'clues'), orderBy('order'), limit(1))
  )
  if (cluesSnap.empty) throw new Error('No clues found')

  const firstClue = cluesSnap.docs[0]
  const sessionRef = doc(collection(db, 'sessions'))

  await setDoc(sessionRef, {
    huntId,
    score: 0,
    credits: STARTING_CREDITS,
    startedAt: serverTimestamp(),
    completedAt: null,
  })

  await setDoc(doc(db, 'sessions', sessionRef.id, 'sessionClues', firstClue.id), {
    clueId: firstClue.id,
    unlockedAt: serverTimestamp(),
    arrivedAt: null,
    pointsEarned: 0,
  })

  redirect(`/hunt?session=${sessionRef.id}`)
}

export default async function HomePage() {
  let hunts: any[] = []
  try {
    const huntsSnap = await getDocs(query(collection(db, 'hunts'), where('active', '==', true)))
    hunts = huntsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    // Firestore not reachable or no data seeded yet
  }

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

        {hunts.length === 0 && (
          <div style={{
            background: '#161622', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 12, padding: '20px 16px', marginBottom: 12,
          }}>
            <p style={{ fontSize: 14, color: '#8b8aaa', lineHeight: 1.65, margin: 0 }}>
              No hunts available yet. Run <code style={{ background: '#1c1c2a', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>npm run seed</code> to load the Utrecht hunt data.
            </p>
          </div>
        )}

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
