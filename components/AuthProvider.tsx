'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  auth, onAuthStateChanged, signInWithPopup, signOut, googleProvider,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendPasswordResetEmail, signInAnonymously, linkWithPopup,
  linkWithCredential, EmailAuthProvider, type User,
} from '@/lib/auth'
import { setupAutoDrain } from '@/lib/offlineQueue'
import { db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { AuthModal } from '@/components/AuthModal'

interface AuthCtx {
  /** The signed-in (registered) user. Guests' anonymous accounts are hidden here. */
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

/**
 * Map a Firebase auth error to an i18n KEY (translated by AuthModal);
 * '' means "no message" (e.g. the user closed the Google popup).
 */
function authMessage(e: any): string {
  const code = e?.code ?? ''
  if (code.includes('email-already-in-use')) return 'authErrEmailInUse'
  if (code.includes('invalid-email')) return 'authErrInvalidEmail'
  if (code.includes('weak-password')) return 'authErrWeakPassword'
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'authErrWrongPassword'
  if (code.includes('user-not-found')) return 'authErrNoUser'
  if (code.includes('too-many-requests')) return 'authErrTooMany'
  if (code.includes('network-request-failed')) return 'errNetwork'
  if (code.includes('popup-blocked')) return 'authErrPopupBlocked'
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return ''
  return 'authErrGeneric'
}

/** Per-user API responses cached by the service worker must not survive a sign-out. */
async function clearUserCaches() {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k.startsWith('tourhunts-api')).map(k => caches.delete(k)))
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      // Guests get a silent anonymous account so every API call carries a
      // verifiable identity; signing in later upgrades (links) that account.
      if (!u) {
        signInAnonymously(auth).catch(() => setLoading(false))
        setUser(null)
        return
      }
      const registered = !u.isAnonymous
      setUser(registered ? u : null)
      setLoading(false)
      if (registered) setModalOpen(false)
      // Upsert the public profile doc so leaderboards/progression have a name
      // and avatar to show (progression fields are written server-side only).
      if (registered) {
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
  const logOut = async () => {
    await clearUserCaches()
    await signOut(auth)
  }

  /** If the current user is a guest, try to upgrade it in place (keeps progress). */
  const guest = () => (auth.currentUser?.isAnonymous ? auth.currentUser : null)

  const signInGoogle = async (): Promise<string> => {
    try {
      const g = guest()
      if (g) {
        try {
          const cred = await linkWithPopup(g, googleProvider)
          await cred.user.getIdToken(true)
          // Linking keeps the same uid, so onAuthStateChanged doesn't re-fire.
          setUser(cred.user)
          setModalOpen(false)
          await setDoc(doc(db, 'users', cred.user.uid), { displayName: cred.user.displayName ?? 'Explorer', photoURL: cred.user.photoURL ?? null, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
          return ''
        }
        catch (e: any) {
          // Google account already exists — fall back to a normal sign-in.
          if (!String(e?.code ?? '').includes('credential-already-in-use')) throw e
        }
      }
      await signInWithPopup(auth, googleProvider)
      return ''
    }
    catch (e) { return authMessage(e) }
  }
  const signInEmail = async (email: string, password: string): Promise<string> => {
    try { await signInWithEmailAndPassword(auth, email.trim(), password); return '' }
    catch (e) { return authMessage(e) }
  }
  const registerEmail = async (name: string, email: string, password: string): Promise<string> => {
    try {
      const g = guest()
      const cred = g
        ? await linkWithCredential(g, EmailAuthProvider.credential(email.trim(), password))
        : await createUserWithEmailAndPassword(auth, email.trim(), password)
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {})
      await cred.user.getIdToken(true).catch(() => {})
      // linkWithCredential doesn't re-fire onAuthStateChanged — publish the upgrade.
      setUser(cred.user)
      setModalOpen(false)
      await setDoc(doc(db, 'users', cred.user.uid), { displayName: name.trim() || 'Explorer', photoURL: null, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
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
