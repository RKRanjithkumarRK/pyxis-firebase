import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as fbSignOut,
} from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [role, setRole]       = useState('user')
  const [plan, setPlan]       = useState('free')
  const [loading, setLoading] = useState(true)

  const fetchUserMeta = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return
    try {
      // Role from Firebase custom claims (fastest path)
      const idTokenResult = await firebaseUser.getIdTokenResult()
      const claimRole = idTokenResult.claims?.role
      if (claimRole) setRole(claimRole)
    } catch (e) {
      // Non-critical — defaults remain
    }
  }, [])

  useEffect(() => {
    // Handle Google redirect result — fires after user returns from Google sign-in page
    getRedirectResult(auth).catch(() => {})
    return onAuthStateChanged(auth, async u => {
      setUser(u)
      if (u) await fetchUserMeta(u)
      else { setRole('user'); setPlan('free') }
      setLoading(false)
    })
  }, [fetchUserMeta])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    try {
      // Popup works on real domains; faster UX than redirect
      return await signInWithPopup(auth, provider)
    } catch (err) {
      // Popup blocked (iframe / strict browser) → fall back to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        return signInWithRedirect(auth, provider)
      }
      throw err
    }
  }

  const signInAsGuest = async () => {
    const res = await fetch('/api/guest', { method: 'POST' })
    if (!res.ok) throw new Error('Failed to get guest token')
    const { token } = await res.json()
    return signInWithCustomToken(auth, token)
  }

  /** Sign in with email + password */
  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  /** Create a new account with email + password, optionally set displayName */
  const signUpWithEmail = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() })
    }
    return cred
  }

  /** Send password-reset email */
  const resetPassword = (email) =>
    sendPasswordResetEmail(auth, email)

  const signOut = () => fbSignOut(auth)

  return (
    <AuthContext.Provider value={{
      user, loading, role, plan,
      isAdmin: role === 'admin',
      signInWithGoogle, signInAsGuest,
      signInWithEmail, signUpWithEmail, resetPassword,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
