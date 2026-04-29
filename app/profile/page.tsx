'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'

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
  const { t } = useI18n()
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
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>{t('profileTitle')}</h1>
          <p style={{ fontSize: 14, color: '#8b8aaa', marginBottom: 24 }}>
            {t('profileSignInHint')}
          </p>
          <button className="btn-primary" onClick={signIn}>{t('signInGoogle')}</button>
          <a href="/" className="btn-secondary" style={{ marginTop: 10, display: 'block', textDecoration: 'none' }}>
            {t('backToHunts')}
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
        <a href="/" className="topbar-back" aria-label={t('home')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>{t('home')}</span>
        </a>

        <div className="profile-header fade-in-up">
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
            <div className="stat-label">{t('huntsDone')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalClues}</div>
            <div className="stat-label">{t('placesFound')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#6c63f5' }}>{totalScore}</div>
            <div className="stat-label">{t('totalScore')}</div>
          </div>
        </div>

        <div className="section-label">{t('huntHistory')}</div>

        {fetching && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}

        {!fetching && sessions.length === 0 && (
          <div className="empty-card">
            <p>{t('noHuntsPlayed')}</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="history-item">
            <div>
              <div className="history-title">{s.huntTitle}</div>
              <div className="history-detail">
                {s.cluesCompleted}/{s.totalClues} {t('places')}
                {s.completedAt ? ` · ${t('ctaCompleted')}` : ` · ${t('inProgress')}`}
              </div>
            </div>
            <div className="history-score">{s.score}</div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <a href="/" className="btn-primary" style={{ textDecoration: 'none' }}>{t('playHunt')}</a>
        </div>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={logOut}>{t('signOut')}</button>
      </div>
    </main>
  )
}
