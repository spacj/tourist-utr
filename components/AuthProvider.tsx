'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  auth, onAuthStateChanged, signInWithPopup, signOut, googleProvider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendPasswordResetEmail, type User,
} from '@/lib/auth'
import { setupAutoDrain } from '@/lib/offlineQueue'
import { db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { AuthModal } from '@/components/AuthModal'

interface AuthCtx {
  user: User | null
  loading: boolean
  /** Opens the sign-in modal (Google + email/password). */
  signIn: () => void
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn: () => {},
  logOut: async () => {},
})

/** Map a Firebase auth error to a short, human message. */
function authMessage(e: any): string {
  const code = e?.code ?? ''
  if (code.includes('email-already-in-use')) return 'That email is already registered — try signing in.'
  if (code.includes('invalid-email')) return 'That email address looks invalid.'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.'
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Wrong email or password.'
  if (code.includes('user-not-found')) return 'No account with that email — register instead.'
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again in a minute.'
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return ''
  return 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) setModalOpen(false)
      // Upsert the public profile doc so leaderboards/progression have a name
      // and avatar to show (progression fields are written server-side).
      if (u) {
        setDoc(
          doc(db, 'users', u.uid),
          { displayName: u.displayName ?? 'Explorer', photoURL: u.photoURL ?? null, updatedAt: serverTimestamp() },
          { merge: true },
        ).catch(() => {})
      }
    })
  }, [])

  // Drain the offline write queue on reconnect (window 'online' + tab focus).
  useEffect(() => setupAutoDrain(), [])

  const signIn = () => setModalOpen(true)
  const logOut = async () => { await signOut(auth) }

  const signInGoogle = async (): Promise<string> => {
    try { await signInWithPopup(auth, googleProvider); return '' }
    catch (e) { return authMessage(e) }
  }
  const signInEmail = async (email: string, password: string): Promise<string> => {
    try { await signInWithEmailAndPassword(auth, email.trim(), password); return '' }
    catch (e) { return authMessage(e) }
  }
  const registerEmail = async (name: string, email: string, password: string): Promise<string> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {})
      // Re-write the profile doc with the chosen name (onAuthStateChanged may
      // have fired before displayName was set).
      await setDoc(doc(db, 'users', cred.user.uid), { displayName: name.trim() || 'Explorer', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
      return ''
    } catch (e) { return authMessage(e) }
  }
  const resetPassword = async (email: string): Promise<string> => {
    try { await sendPasswordResetEmail(auth, email.trim()); return '' }
    catch (e) { return authMessage(e) }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut }}>
      {children}
      {modalOpen && !user && (
        <AuthModal
          onClose={() => setModalOpen(false)}
          onGoogle={signInGoogle}
          onEmailSignIn={signInEmail}
          onEmailRegister={registerEmail}
          onResetPassword={resetPassword}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
