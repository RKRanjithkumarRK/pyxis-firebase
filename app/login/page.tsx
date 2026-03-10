'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const router = useRouter()
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth()

  useEffect(() => {
    if (!authLoading && user) router.push('/hub')
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password, name)
        toast.success('Account created!')
      } else {
        await signIn(email, password)
        toast.success('Welcome back!')
      }
      router.push('/hub')
    } catch (err: any) {
      const msg =
        err.code === 'auth/user-not-found' ? 'No account found. Sign up first.' :
        err.code === 'auth/wrong-password' ? 'Wrong password.' :
        err.code === 'auth/email-already-in-use' ? 'Email already registered.' :
        err.code === 'auth/weak-password' ? 'Password must be 6+ characters.' :
        err.code === 'auth/invalid-credential' ? 'Invalid email or password.' :
        err.message
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      router.push('/hub')
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message)
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGuest = async () => {
    setGuestLoading(true)
    try {
      await signInAsGuest()
      router.push('/hub')
    } catch (err: any) {
      toast.error('Could not start guest session: ' + err.message)
    } finally {
      setGuestLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success('Password reset email sent!')
    } catch {
      toast.error('Failed to send reset email.')
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[340px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Pyxis</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        {/* Card */}
        <div className="space-y-4">
          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || guestLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Guest */}
          <button
            onClick={handleGuest}
            disabled={guestLoading || googleLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border bg-transparent hover:bg-surface-hover text-text-secondary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {guestLoading ? (
              <span className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
            {guestLoading ? 'Starting guest session...' : 'Try as Guest — no sign up needed'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-tertiary">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary text-sm placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary text-sm placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary text-sm placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Continue'}
            </button>
          </form>

          {/* Links */}
          <div className="flex justify-between text-xs">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-accent hover:underline bg-transparent border-none cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </button>
            {!isSignUp && (
              <button
                onClick={handleReset}
                className="text-text-tertiary hover:text-text-secondary bg-transparent border-none cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-8">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
