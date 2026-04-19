'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

interface Session {
  id: string
  huntTitle: string
  score: number
  totalClues: number
  cluesCompleted: number
  completedAt: any
}

export default function ProfilePage() {
  const { user, loading, signIn, logOut } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user) { setFetching(false); return }
    fetch(`/api/user-history?userId=${user.uid}`)
      .then(r => r.json())
      .then(setSessions)
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [user])

  if (loading) {
    return <main className="page-center"><div className="spinner" /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Your profile</h1>
          <p style={{ fontSize: 14, color: '#8b8aaa', marginBottom: 24 }}>
            Sign in to track your progress across hunts.
          </p>
          <button className="btn-primary" onClick={signIn}>Sign in with Google</button>
          <a href="/" className="btn-secondary" style={{ marginTop: 10, display: 'block', textDecoration: 'none' }}>
            ← Back to hunts
          </a>
        </div>
      </main>
    )
  }

  const completed = sessions.filter(s => s.completedAt)
  const totalScore = sessions.reduce((a, s) => a + s.score, 0)
  const totalClues = sessions.reduce((a, s) => a + s.cluesCompleted, 0)

  return (
    <main className="page-center">
      <div className="container">
        <div className="profile-header">
          <div className="profile-avatar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1c2a', fontSize: 20, fontWeight: 600, color: '#6c63f5' }}>
                {user.displayName?.[0] || '?'}
              </div>
            )}
          </div>
          <div>
            <div className="profile-name">{user.displayName}</div>
            <div className="profile-email">{user.email}</div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{completed.length}</div>
            <div className="stat-label">Hunts done</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalClues}</div>
            <div className="stat-label">Places found</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#6c63f5' }}>{totalScore}</div>
            <div className="stat-label">Total score</div>
          </div>
        </div>

        <div className="section-label">Hunt history</div>

        {fetching && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}

        {!fetching && sessions.length === 0 && (
          <div className="empty-card">
            <p>No hunts played yet. Go explore!</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="history-item">
            <div>
              <div className="history-title">{s.huntTitle}</div>
              <div className="history-detail">
                {s.cluesCompleted}/{s.totalClues} places
                {s.completedAt ? ' · Completed' : ' · In progress'}
              </div>
            </div>
            <div className="history-score">{s.score}</div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <a href="/" className="btn-primary" style={{ textDecoration: 'none' }}>Play a hunt</a>
        </div>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={logOut}>Sign out</button>
      </div>
    </main>
  )
}
