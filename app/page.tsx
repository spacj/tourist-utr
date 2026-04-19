'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Hunt } from '@/types'

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: 'Easy',   color: '#22c97a', bg: 'rgba(34,201,122,.12)' },
  medium: { label: 'Medium', color: '#f5a54a', bg: 'rgba(245,165,74,.12)' },
  hard:   { label: 'Hard',   color: '#f05252', bg: 'rgba(240,82,82,.12)' },
}

export default function HomePage() {
  const { user, loading, signIn } = useAuth()
  const [hunts, setHunts] = useState<Hunt[]>([])
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hunts').then(r => r.json()).then(setHunts).catch(() => {})
  }, [])

  const startHunt = async (huntId: string) => {
    if (!user) { signIn(); return }
    setStarting(huntId)
    const res = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ huntId, userId: user.uid }),
    })
    const { sessionId } = await res.json()
    window.location.href = `/hunt?session=${sessionId}`
  }

  if (loading) {
    return (
      <main className="page-center">
        <div className="spinner" />
      </main>
    )
  }

  return (
    <main className="page-center">
      <div className="container">
        {/* Header */}
        <div className="header">
          <div className="header-top">
            <div>
              <h1 className="title">Utrecht</h1>
              <p className="subtitle">Scavenger Hunt</p>
            </div>
            {user ? (
              <a href="/profile" className="avatar-btn">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                ) : (
                  <span className="avatar-letter">{user.displayName?.[0] || '?'}</span>
                )}
              </a>
            ) : (
              <button onClick={signIn} className="sign-in-btn">Sign in</button>
            )}
          </div>
          <p className="header-desc">
            Explore the city by solving riddles and finding landmarks. Walk through centuries of history — guided by GPS.
          </p>
        </div>

        {/* Hunts */}
        <div className="section-label">Available hunts</div>

        {hunts.length === 0 && (
          <div className="empty-card">
            <p>No hunts available yet.</p>
          </div>
        )}

        {hunts.map((hunt) => {
          const diff = DIFFICULTY_META[hunt.difficulty] || DIFFICULTY_META.medium
          return (
            <button
              key={hunt.id}
              className="hunt-card"
              onClick={() => startHunt(hunt.id)}
              disabled={starting === hunt.id}
            >
              <div className="hunt-card-top">
                <div>
                  <div className="hunt-title">{hunt.title}</div>
                  <div className="hunt-desc">{hunt.description}</div>
                </div>
                <div className="hunt-arrow">{starting === hunt.id ? '...' : '→'}</div>
              </div>

              <div className="hunt-meta">
                <span className="meta-pill" style={{ color: diff.color, background: diff.bg, border: `1px solid ${diff.color}33` }}>
                  {diff.label}
                </span>
                <span className="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {hunt.clueCount} places
                </span>
                <span className="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ~{hunt.durationMin} min
                </span>
                <span className="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  {hunt.distanceKm} km
                </span>
              </div>
            </button>
          )
        })}

        {!user && (
          <p className="footer-note">
            Sign in with Google to save your progress
          </p>
        )}
      </div>
    </main>
  )
}
