'use client'
import { ArrowLeft, ArrowRight, Lock, Users } from 'lucide-react'
import { AchievementIcon } from '@/components/AchievementIcon'
import { RankMark } from '@/components/StopIcon'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useI18n } from '@/hooks/useI18n'
import { ResumeRaceBanner } from '@/components/ResumeRaceBanner'
import { apiGet } from '@/lib/apiFetch'
import { fmt } from '@/lib/i18n/fmt'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { ACHIEVEMENTS_DEF, levelFromXp, type PlayerProfile } from '@/types'
import { Avatar } from '@/components/Avatar'

interface Session {
  id: string
  huntId: string
  huntTitle: string
  huntI18n: Record<string, { title?: string }> | null
  score: number
  totalClues: number
  cluesCompleted: number
  completedAt: number | null
  startedAt: number
  multiplayer: {
    roomCode: string
    playerCount: number
    rank: number
    totalPlayers: number
  } | null
}

export default function ProfilePage() {
  const { user, loading, signIn, logOut } = useAuth()
  const { t, lang } = useI18n()
  const [sessions, setSessions] = useState<Session[]>([])
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [profile, setProfile] = useState<Partial<PlayerProfile> | null>(null)
  const [profileError, setProfileError] = useState(false)
  const uid = user?.uid ?? null

  const loadHistory = useCallback(() => {
    setHistoryState('loading')
    apiGet<Session[]>('/api/user-history')
      .then(d => { setSessions(Array.isArray(d) ? d : []); setHistoryState('ready') })
      .catch(() => setHistoryState('error'))
  }, [])

  const loadProfile = useCallback(() => {
    if (!uid) return
    setProfileError(false)
    getDoc(doc(db, 'users', uid))
      .then(s => { if (s.exists()) setProfile(s.data() as Partial<PlayerProfile>) })
      .catch(() => setProfileError(true))
  }, [uid])

  useEffect(() => {
    if (!uid) return
    loadHistory()
    loadProfile()
  }, [uid, loadHistory, loadProfile])

  if (loading) {
    return <main className="page-center" aria-busy="true"><div className="spinner" role="status" aria-label={t('loading')} /></main>
  }

  if (!user) {
    return (
      <main className="page-center">
        <div className="container flow-center">
          <h1 className="flow-page-title">{t('profileTitle')}</h1>
          <p className="flow-page-sub">{t('profileSignInHint')}</p>
          <button type="button" className="btn-primary" onClick={signIn}>{t('signIn')}</button>
          <a href="/" className="btn-secondary flow-btn flow-mt-12">{t('home')}</a>
        </div>
      </main>
    )
  }

  const titleOf = (s: Session) => (lang !== 'en' && s.huntI18n?.[lang]?.title) || s.huntTitle
  const solo = sessions.filter(s => !s.multiplayer)
  const completed = sessions.filter(s => s.completedAt)
  const totalScore = sessions.reduce((a, s) => a + s.score, 0)
  const totalClues = sessions.reduce((a, s) => a + s.cluesCompleted, 0)
  const mpRaces = sessions.filter(s => s.multiplayer && s.completedAt)

  const xp = profile?.xp ?? 0
  const { level, intoLevel, toNext } = levelFromXp(xp)
  const levelTitle = t(`levelTitle${level}`)
  const pct = toNext === 0 ? 100 : Math.round((intoLevel / (intoLevel + toNext)) * 100)

  return (
    <main className="page-center">
      <div className="container">
        <a href="/" className="topbar-back">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          <span>{t('home')}</span>
        </a>

        <div className="profile-header fade-in-up">
          <div className="profile-avatar">
            {user.photoURL
              ? <Avatar src={user.photoURL} size={72} />
              : <div className="profile-avatar-letter" aria-hidden>{user.displayName?.[0] || '?'}</div>}
          </div>
          <div>
            <h1 className="profile-name">{user.displayName || t('playerFallback')}</h1>
            <div className="profile-email">{user.email}</div>
          </div>
        </div>

        {/* Level + XP progress */}
        <div className="level-card fade-in-up">
          <div className="level-card-row">
            <span className="level-badge" aria-label={`${t('levelLabel')} ${level}`}>{level}</span>
            <div className="level-meta">
              <div className="level-title">{levelTitle}</div>
              <div className="level-xp">{xp} XP{toNext > 0 ? ` · ${toNext} ${t('toNextLevel')}` : ` · ${t('maxLevel')}`}</div>
            </div>
          </div>
          <div className="level-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('levelLabel')}>
            <div className="level-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {profileError && (
          <p className="flow-error-text" role="alert">
            {t('loadError')} <button type="button" className="flow-link-btn" onClick={loadProfile}>{t('retry')}</button>
          </p>
        )}

        <h2 className="section-label flow-mt-18">{t('achievementsTitle')}</h2>
        <ul className="badge-gallery flow-plain-list">
          {ACHIEVEMENTS_DEF.map(a => {
            const earned = !!profile?.achievements?.[a.id]
            return (
              <li key={a.id} className={`badge-cell ${earned ? 'is-earned' : 'is-locked'}`} title={t(`achDesc_${a.id}`)}>
                <span className="badge-cell-icon" aria-hidden>{earned ? <AchievementIcon id={a.id} /> : <Lock size={20} strokeWidth={1.75} />}</span>
                <span className="badge-cell-label">{t(`ach_${a.id}`)}</span>
                <span className="flow-sr-only">{earned ? t('badgeEarned') : t('locked')}: {t(`achDesc_${a.id}`)}</span>
              </li>
            )
          })}
        </ul>

        <ResumeRaceBanner />

        <a href="/multiplayer" className="mp-home-cta flow-mp-cta">
          <div className="mp-home-cta-icon" aria-hidden><Users size={22} strokeWidth={1.75} /></div>
          <div className="mp-home-cta-body">
            <div className="mp-home-cta-title">{t('playWithFriends')}</div>
            <div className="mp-home-cta-desc">{t('shareRoomCode')}</div>
          </div>
          <div className="mp-home-cta-arrow" aria-hidden><ArrowRight size={20} strokeWidth={2} /></div>
        </a>

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
            <div className="stat-value">{totalScore}</div>
            <div className="stat-label">{t('totalScore')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{mpRaces.length}</div>
            <div className="stat-label">{t('histMpRaces')}</div>
          </div>
        </div>

        {mpRaces.length > 0 && (
          <>
            <h2 className="section-label">{t('histMpRaces')}</h2>
            {mpRaces.map((s) => (
              <div key={`mp-${s.id}`} className="history-item history-item-mp">
                <div className="history-mp-body">
                  <div className="history-title">{titleOf(s)}</div>
                  <div className="history-detail">
                    {s.multiplayer?.roomCode && (
                      <span className="history-mp-code">{fmt(t('roomLabel'), { code: s.multiplayer.roomCode })}</span>
                    )}
                    <span>· {s.multiplayer?.rank}/{s.multiplayer?.totalPlayers}</span>
                    {s.multiplayer?.rank === 1 && <span className="history-mp-medal"><RankMark rank={1} label={t('mpMedalGold')} /></span>}
                  </div>
                </div>
                <div className="history-score">{s.score}</div>
              </div>
            ))}
          </>
        )}

        <h2 className={`section-label ${mpRaces.length > 0 ? 'flow-mt-20' : ''}`}>
          {t('huntHistory')}
          {solo.length > 0 && <span className="history-count">{solo.length}</span>}
        </h2>

        {historyState === 'loading' && (
          <div aria-busy="true">
            <span className="flow-sr-only" role="status">{t('loading')}</span>
            <span className="skel skel-line" />
            <span className="skel skel-line" />
          </div>
        )}

        {historyState === 'error' && (
          <div className="empty-card" role="alert">
            <p>{t('loadError')}</p>
            <button type="button" className="btn-primary flow-retry" onClick={loadHistory}>{t('retry')}</button>
          </div>
        )}

        {historyState === 'ready' && solo.length === 0 && mpRaces.length === 0 && (
          <div className="empty-card"><p>{t('noHuntsPlayed')}</p></div>
        )}

        {historyState === 'ready' && solo.map((s) => (
          <div key={s.id} className="history-item">
            <div>
              <div className="history-title">{titleOf(s)}</div>
              <div className="history-detail">
                {s.cluesCompleted}/{s.totalClues} {t('places')}
                {s.completedAt ? ` · ${t('ctaCompleted')}` : ` · ${t('inProgress')}`}
              </div>
            </div>
            <div className="history-score">{s.score}</div>
          </div>
        ))}

        <div className="flow-actions-row">
          <a href="/" className="btn-primary flow-btn">{t('playHunt')}</a>
        </div>
        <button type="button" className="btn-secondary flow-mt-8" onClick={logOut}>{t('signOut')}</button>
      </div>
    </main>
  )
}
