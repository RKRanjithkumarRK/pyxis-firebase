'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  browserLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously as firebaseSignInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db, firebaseEnabled } from '@/lib/firebase-client'

interface AuthContextType {
  user: FirebaseUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | null>(null)
const REDIRECT_FALLBACK_ERRORS = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
])

function prefersRedirectAuth() {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent || ''
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|CriOS|FxiOS/i.test(userAgent)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let unsubscribe = () => {}
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const bootstrapAuth = async () => {
      if (!firebaseEnabled || !auth) {
        if (mounted) setLoading(false)
        return
      }

      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        try {
          await setPersistence(auth, inMemoryPersistence)
        } catch {}
      }

      if (!mounted) return

      fallbackTimer = setTimeout(() => {
        if (mounted) setLoading(false)
      }, 4000)

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer)
          fallbackTimer = null
        }
        setUser(firebaseUser)
        setLoading(false)
        if (firebaseUser && db) {
          try {
            const userRef = doc(db, 'users', firebaseUser.uid)
            const userSnap = await getDoc(userRef)
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || '',
                createdAt: new Date().toISOString(),
              })
            }
          } catch (err) {
            // Non-critical: Firestore user doc sync failed (e.g. permission rules)
            console.warn('Firestore user profile sync skipped:', err)
          }
        }
      })
    }

    bootstrapAuth()

    return () => {
      mounted = false
      unsubscribe()
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Authentication is not configured for this environment.')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, name: string) => {
    if (!auth) throw new Error('Authentication is not configured for this environment.')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
  }

  const signInWithGoogle = async () => {
    if (!auth) throw new Error('Authentication is not configured for this environment.')
    const provider = new GoogleAuthProvider()
    if (prefersRedirectAuth()) {
      await signInWithRedirect(auth, provider)
      return
    }

    try {
      await signInWithPopup(auth, provider)
    } catch (err: any) {
      if (REDIRECT_FALLBACK_ERRORS.has(err?.code) || /popup|redirect/i.test(String(err?.message || ''))) {
        await signInWithRedirect(auth, provider)
        return
      }
      throw err
    }
  }

  const signInAsGuest = async () => {
    if (!auth) throw new Error('Authentication is not configured for this environment.')
    await firebaseSignInAnonymously(auth)
  }

  const signOut = async () => {
    if (!auth) return
    await firebaseSignOut(auth)
  }

  const getToken = async () => {
    if (!auth?.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signInAsGuest, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
