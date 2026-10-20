'use client'
import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
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
 * sign-in ⇄ register toggle and a password reset. Opened by AuthProvider.signIn().
 * Each handler resolves to an i18n error KEY ('' = success / nothing to say);
 * on success the auth state listener closes the modal.
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

  const switchMode = (m: 'signin' | 'register') => { setMode(m); setError(null); setNotice(null) }

  const run = async (fn: () => Promise<string>) => {
    if (busy) return
    setBusy(true); setError(null); setNotice(null)
    const errKey = await fn()
    setBusy(false)
    if (errKey) setError(t(errKey))
  }

  const submitEmail = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError(t('authFillFields')); return }
    run(() => mode === 'signin' ? onEmailSignIn(email, password) : onEmailRegister(name, email, password))
  }

  const forgot = async () => {
    if (!email.trim()) { setError(t('authEnterEmailFirst')); return }
    if (busy) return
    setBusy(true); setError(null); setNotice(null)
    const errKey = await onResetPassword(email)
    setBusy(false)
    if (errKey) setError(t(errKey)); else setNotice(t('authResetSent'))
  }

  return (
    <Modal open onClose={onClose} title={mode === 'signin' ? t('authTitleSignIn') : t('authTitleRegister')} className="auth-panel">
      <p className="auth-why">{t('authWhy')}</p>

      <div className="auth-tabs" role="group" aria-label={t('authModeLabel')}>
        <button type="button" aria-pressed={mode === 'signin'} className={`auth-tab ${mode === 'signin' ? 'is-active' : ''}`} onClick={() => switchMode('signin')}>
          {t('authSignInTab')}
        </button>
        <button type="button" aria-pressed={mode === 'register'} className={`auth-tab ${mode === 'register' ? 'is-active' : ''}`} onClick={() => switchMode('register')}>
          {t('authRegisterTab')}
        </button>
      </div>

      <button type="button" className="auth-google" onClick={() => run(onGoogle)} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.3-.1-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 16 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 36.4 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
        {t('authContinueGoogle')}
      </button>

      <div className="auth-or" aria-hidden><span>{t('authOr')}</span></div>

      <form onSubmit={submitEmail} noValidate>
        {mode === 'register' && (
          <div className="auth-field">
            <label htmlFor="auth-name" className="auth-label">{t('authNameLabel')}</label>
            <input id="auth-name" className="auth-input" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
        )}
        <div className="auth-field">
          <label htmlFor="auth-email" className="auth-label">{t('authEmailLabel')}</label>
          <input id="auth-email" className="auth-input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby="auth-status" />
        </div>
        <div className="auth-field">
          <label htmlFor="auth-password" className="auth-label">{t('authPasswordLabel')}</label>
          <input id="auth-password" className="auth-input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} aria-describedby="auth-status" />
        </div>

        <div id="auth-status" aria-live="polite" className="auth-status">
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}
        </div>

        <button type="submit" className="btn-primary auth-submit" disabled={busy} aria-busy={busy}>
          {busy ? '…' : (mode === 'signin' ? t('authSubmitSignIn') : t('authSubmitRegister'))}
        </button>
      </form>

      {mode === 'signin' && (
        <button type="button" className="auth-link" onClick={forgot} disabled={busy}>{t('authForgot')}</button>
      )}
    </Modal>
  )
}
