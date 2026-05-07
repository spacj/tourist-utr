'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, onAuthStateChanged, signInWithPopup, signOut, googleProvider, type User } from '@/lib/auth'
import { setupAutoDrain } from '@/lib/offlineQueue'

interface AuthCtx {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  // Drain the offline write queue on reconnect (window 'online' event +
  // tab focus). Hint spends and clue arrivals queued while offline replay
  // here, and the server's authoritative response broadcasts back to any
  // listening hooks (useCredits, etc.) via onReplay.
  useEffect(() => {
    return setupAutoDrain()
  }, [])

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const logOut = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
