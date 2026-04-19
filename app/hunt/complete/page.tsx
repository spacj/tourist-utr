import { notFound } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection } from 'firebase/firestore'

export const dynamic = 'force-dynamic'

export default async function CompletePage({
  searchParams,
}: {
  searchParams: { session?: string }
}) {
  const sessionId = searchParams.session
  if (!sessionId) notFound()

  const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
  if (!sessionSnap.exists()) notFound()
  const session = sessionSnap.data()

  const huntSnap = await getDoc(doc(db, 'hunts', session.huntId))
  const hunt = huntSnap.data()!

  const scSnap = await getDocs(collection(db, 'sessions', sessionId, 'sessionClues'))
  const hintsSnap = await getDocs(collection(db, 'sessions', sessionId, 'hintUnlocks'))

  const clues = await Promise.all(
    scSnap.docs.map(async (scDoc) => {
      const sc = scDoc.data()
      const clueSnap = await getDoc(doc(db, 'hunts', session.huntId, 'clues', scDoc.id))
      const clue = clueSnap.data()!
      return {
        id: scDoc.id,
        locationName: clue.locationName,
        order: clue.order,
        arrivedAt: sc.arrivedAt,
        pointsEarned: sc.pointsEarned,
      }
    })
  )
  clues.sort((a, b) => a.order - b.order)

  const totalClues = clues.length
  const cluesArrived = clues.filter(c => c.arrivedAt).length
  const hintsUsed = hintsSnap.size
  const creditsSpent = hintsSnap.docs.reduce((s, d) => s + (d.data().creditCost || 0), 0)

  return (
    <main style={{
      minHeight: '100dvh', background: '#0d0d14', color: '#eeedf8',
      fontFamily: 'system-ui, sans-serif', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(245,165,74,.12)', border: '1px solid rgba(245,165,74,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 34,
        }}>
          🏆
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 6 }}>Hunt complete!</h1>
        <p style={{ fontSize: 14, color: '#8b8aaa', marginBottom: 28 }}>{hunt.title}</p>

        <div style={{
          background: '#161622', border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 14, padding: '22px 20px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: '#56556a', marginBottom: 6 }}>Final score</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#6c63f5', lineHeight: 1 }}>
            {session.score}
          </div>
          <div style={{ fontSize: 12, color: '#8b8aaa', marginTop: 4 }}>points</div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28,
        }}>
          {[
            { label: 'Locations', value: `${cluesArrived}/${totalClues}` },
            { label: 'Hints used', value: hintsUsed },
            { label: 'Credits spent', value: creditsSpent },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#161622', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, padding: '14px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b8aaa', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: '#161622', border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 24,
        }}>
          {clues.map((sc, i) => (
            <div key={sc.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 16px',
              borderBottom: i < clues.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: sc.arrivedAt ? 'rgba(34,201,122,.12)' : 'rgba(255,255,255,.06)',
                  border: `1px solid ${sc.arrivedAt ? 'rgba(34,201,122,.3)' : 'rgba(255,255,255,.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: sc.arrivedAt ? '#22c97a' : '#56556a',
                }}>
                  {sc.arrivedAt ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 13 }}>{sc.locationName}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: sc.arrivedAt ? '#eeedf8' : '#56556a' }}>
                {sc.arrivedAt ? `+${sc.pointsEarned}` : '—'}
              </span>
            </div>
          ))}
        </div>

        <a href="/" style={{
          display: 'block', background: '#6c63f5', color: '#fff',
          borderRadius: 10, padding: 14, fontSize: 14, fontWeight: 600,
          textDecoration: 'none', textAlign: 'center',
        }}>
          Play again
        </a>
      </div>
    </main>
  )
}
