'use client'
import { useState } from 'react'
import { useI18n } from '@/hooks/useI18n'

interface Props {
  onClose: () => void
  onGoogle: () => Promise<string>
  onEmailSignIn: (email: string, password: string) => Promise<string>
  onEmailRegister: (name: string, email: string, password: string) => Promise<string>
  onResetPassword: (email: string) => Promise<string>
}

/**
 * Unified sign-in modal: Continue with Google, or email/password with a
 * login ⇄ register toggle and a password reset. Opened by AuthProvider.signIn().
 * Each handler resolves to an error string ('' = success); on success the auth
 * state listener closes the modal.
 */
export function AuthModal({ onClose, onGoogle, onEmailSignIn, onEmailRegister, onResetPassword }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (fn: () => Promise<string>) => {
    if (busy) return
    setBusy(true); setError(null); setNotice(null)
    const err = await fn()
    setBusy(false)
    if (err) setError(err)
    // success → AuthProvider's onAuthStateChanged closes the modal.
  }

  const submitEmail = () => {
    if (!email.trim() || !password) { setError(t('authFillFields')); return }
    run(() => mode === 'signin'
      ? onEmailSignIn(email, password)
      : onEmailRegister(name, email, password))
  }

  const forgot = async () => {
    if (!email.trim()) { setError(t('authEnterEmailFirst')); return }
    setBusy(true); setError(null); setNotice(null)
    const err = await onResetPassword(email)
    setBusy(false)
    if (err) setError(err); else setNotice(t('authResetSent'))
  }

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label={t('close')}>✕</button>

        <div className="auth-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'signin'} className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`} onClick={() => { setMode('signin'); setError(null); setNotice(null) }}>
            {t('authSignInTab')}
          </button>
          <button role="tab" aria-selected={mode === 'register'} className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`} onClick={() => { setMode('register'); setError(null); setNotice(null) }}>
            {t('authRegisterTab')}
          </button>
        </div>

        <button className="auth-google" onClick={() => run(onGoogle)} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.3-.1-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.4 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
          {t('authContinueGoogle')}
        </button>

        <div className="auth-or"><span>{t('authOr')}</span></div>

        {mode === 'register' && (
          <input className="auth-input" type="text" autoComplete="name" placeholder={t('authNameLabel')} value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="auth-input" type="email" autoComplete="email" inputMode="email" placeholder={t('authEmailLabel')} value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="auth-input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder={t('authPasswordLabel')} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitEmail() }} />

        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}

        <button className="btn-primary auth-submit" onClick={submitEmail} disabled={busy}>
          {busy ? '…' : (mode === 'signin' ? t('authSubmitSignIn') : t('authSubmitRegister'))}
        </button>

        {mode === 'signin' && (
          <button className="auth-link" onClick={forgot} disabled={busy}>{t('authForgot')}</button>
        )}
      </div>
    </div>
  )
}
