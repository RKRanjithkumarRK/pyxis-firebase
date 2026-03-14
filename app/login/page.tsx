'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Lock, ShieldCheck, Sparkles, Workflow, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendPasswordResetEmail } from 'firebase/auth'
import PyxisMark from '@/components/brand/PyxisMark'
import { useAuth } from '@/contexts/AuthContext'
import { auth, firebaseEnabled } from '@/lib/firebase-client'

const VALUE_PROPS = [
  'Run chat, agents, workflows, search, media, and code from one AI control plane.',
  'Bring your own providers or route across the built-in model mesh with fallback logic.',
  'Scale from solo operator mode to enterprise-ready collaboration and governance.',
]

const TRUST_STRIPS = [
  { title: 'Operational UX', icon: Sparkles, body: 'Command-center visuals designed for demos, teams, and enterprise buyers.' },
  { title: 'Workflow Depth', icon: Workflow, body: 'From prompt execution to multi-step orchestration with agent coordination.' },
  { title: 'Security Posture', icon: ShieldCheck, body: 'Identity, access, and platform hardening patterns ready for enterprise upgrades.' },
]

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
  const authUnavailable = !firebaseEnabled || !auth

  useEffect(() => {
    if (!authLoading && user) router.push('/hub')
  }, [authLoading, router, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (authUnavailable) throw new Error('Authentication is not configured for this environment.')
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
      if (authUnavailable) throw new Error('Authentication is not configured for this environment.')
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
      if (authUnavailable) throw new Error('Authentication is not configured for this environment.')
      await signInAsGuest()
      router.push('/hub')
    } catch (err: any) {
      toast.error(`Could not start guest session: ${err.message}`)
    } finally {
      setGuestLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) {
      toast.error('Enter your email first')
      return
    }
    try {
      if (!auth) throw new Error('Authentication is not configured for this environment.')
      await sendPasswordResetEmail(auth, email)
      toast.success('Password reset email sent!')
    } catch {
      toast.error('Failed to send reset email.')
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-bg px-4 py-10">
        <div className="panel flex w-full max-w-md items-center gap-4 rounded-[28px] px-6 py-5">
          <PyxisMark size={44} />
          <div>
            <p className="font-display text-xl text-text-primary">Preparing access</p>
            <p className="text-sm text-text-tertiary">Authenticating workspace state</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] min-h-[100svh] overflow-y-auto bg-bg text-text-primary">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[1600px] items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-12">
        <div className="grid w-full items-center gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,520px)] 2xl:gap-10">
          <section className="order-2 xl:order-1 relative overflow-hidden rounded-[32px] panel px-6 py-7 sm:px-8 sm:py-9 xl:px-10 xl:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(97,211,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_32%)]" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="max-w-3xl">
                <div className="pill mb-6 text-xs sm:text-sm text-text-secondary">
                  <Zap size={14} />
                  Enterprise AI workspace access
                </div>

                <div className="flex items-center gap-4">
                  <PyxisMark size={52} />
                  <div>
                    <p className="font-display text-2xl sm:text-3xl text-text-primary">Pyxis One</p>
                    <p className="text-sm text-text-tertiary">AI Operating System</p>
                  </div>
                </div>

                <h1 className="mt-8 font-display text-[clamp(1.9rem,4.2vw,3.8rem)] leading-[0.98] text-text-primary">
                  Enter a calmer, more capable workspace built to feel clear on every screen.
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">
                  This version is tuned for stronger layout balance, softer visual weight, mobile-safe inputs, and a more dependable cross-device experience without losing the premium product feel.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="glass-panel rounded-[28px] p-5 sm:p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-text-tertiary">What feels stronger now</p>
                  <div className="mt-4 space-y-3">
                    {VALUE_PROPS.map((item) => (
                      <div key={item} className="flex gap-3 rounded-2xl bg-surface-hover px-4 py-4">
                        <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} />
                        <p className="text-sm leading-7 text-text-secondary">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {TRUST_STRIPS.map((item) => (
                    <div key={item.title} className="glass-panel rounded-[24px] p-5">
                      <item.icon className="text-cyan-300" size={20} />
                      <p className="mt-4 text-sm font-semibold text-text-primary">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="order-1 xl:order-2 relative">
            <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(97,211,255,0.14),transparent_38%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.16),transparent_42%)]" />

            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="mb-5 flex items-center gap-3 xl:hidden">
                <PyxisMark size={42} />
                <div>
                  <p className="font-display text-2xl text-text-primary">Pyxis One</p>
                  <p className="text-sm text-text-tertiary">AI Operating System</p>
                </div>
              </div>

              <div className="panel rounded-[32px] p-6 sm:p-7 md:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-text-tertiary">
                      {isSignUp ? 'Create your workspace access' : 'Continue to workspace'}
                    </p>
                    <h2 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.5rem)] text-text-primary">
                      {isSignUp ? 'Create account' : 'Welcome back'}
                    </h2>
                  </div>
                  <div className="pill w-fit text-xs text-cyan-200">
                    <Lock size={12} />
                    Secure session
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {authUnavailable && (
                    <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100">
                      Authentication is unavailable in this environment until Firebase public keys are configured.
                    </div>
                  )}
                  <button
                    onClick={handleGoogle}
                    disabled={authUnavailable || googleLoading || guestLoading}
                    className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-border-light bg-white px-4 py-3 text-base font-semibold text-slate-950 transition-transform hover:scale-[1.01] disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {googleLoading ? 'Signing in...' : 'Continue with Google'}
                  </button>

                  <button
                    onClick={handleGuest}
                    disabled={authUnavailable || guestLoading || googleLoading}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-border bg-transparent px-4 py-3 text-base font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    {guestLoading ? (
                      <span className="h-4 w-4 rounded-full border-2 border-text-tertiary border-t-transparent animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {guestLoading ? 'Starting guest session...' : 'Try guest mode'}
                  </button>
                </div>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-text-tertiary">OR</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {isSignUp && (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      required
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-light"
                    />
                  )}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    disabled={authUnavailable}
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-light"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    disabled={authUnavailable}
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base text-text-primary placeholder:text-text-tertiary transition-colors focus:border-border-light"
                  />
                  <button
                    type="submit"
                    disabled={authUnavailable || loading}
                    className="w-full rounded-2xl bg-accent px-4 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.01] hover:bg-accent-hover disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Continue'}
                  </button>
                </form>

                <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-left text-accent transition-colors hover:text-accent-hover"
                  >
                    {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                  </button>
                  {!isSignUp && (
                    <button
                      onClick={handleReset}
                      className="text-left text-text-tertiary transition-colors hover:text-text-secondary sm:text-right"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <p className="mt-6 text-center text-xs leading-6 text-text-tertiary">
                  By continuing, you agree to the platform terms and privacy controls for this workspace.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
