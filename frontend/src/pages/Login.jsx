import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Chrome, UserRound, Mail, Lock, Eye, EyeOff, ArrowLeft, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// ── Static sub-components (defined outside Login to prevent remount on re-render) ──
function Logo() {
  return (
    <div className="text-center mb-8">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-primary) 10%, transparent))' }}
      >
        <Sparkles className="w-7 h-7" style={{ color: 'var(--color-primary-light)' }} />
      </div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Pyxis One</h1>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your AI-powered workspace</p>
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
      or
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
    </div>
  )
}

// mode: 'options' | 'signin' | 'signup' | 'reset'
export default function Login() {
  const { signInWithGoogle, signInAsGuest, signInWithEmail, signUpWithEmail, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const [mode, setMode]       = useState('options')
  const [showPw, setShowPw]   = useState(false)
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')

  const handle = async (type, fn) => {
    setLoading(type)
    try {
      await fn()
      navigate('/hub')
    } catch (err) {
      const msg = err.code === 'auth/user-not-found'       ? 'No account with this email'
                : err.code === 'auth/wrong-password'        ? 'Incorrect password'
                : err.code === 'auth/email-already-in-use'  ? 'Email already registered — sign in instead'
                : err.code === 'auth/weak-password'         ? 'Password must be at least 6 characters'
                : err.code === 'auth/invalid-email'         ? 'Invalid email address'
                : err.code === 'auth/invalid-credential'    ? 'Incorrect email or password'
                : err.message || 'Sign-in failed'
      toast.error(msg)
    } finally {
      setLoading(null)
    }
  }

  const handleReset = async () => {
    if (!email.trim()) { toast.error('Enter your email first'); return }
    setLoading('reset')
    try {
      await resetPassword(email.trim())
      toast.success('Password reset email sent!')
      setMode('signin')
    } catch (err) {
      toast.error(err.code === 'auth/user-not-found' ? 'No account with this email' : err.message)
    } finally {
      setLoading(null)
    }
  }

  const backToOptions = () => { setMode('options'); setPassword('') }

  // ── Options screen ──────────────────────────────────────────────────────
  if (mode === 'options') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <Logo />
        <Card>
          {/* Google */}
          <button
            onClick={() => handle('google', signInWithGoogle)}
            disabled={loading !== null}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {loading === 'google'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Chrome className="w-4 h-4" />}
            Continue with Google
          </button>

          {/* Email */}
          <button
            onClick={() => setMode('signin')}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Mail className="w-4 h-4" />
            Continue with Email
          </button>

          <Divider />

          {/* Guest */}
          <button
            onClick={() => handle('guest', signInAsGuest)}
            disabled={loading !== null}
            className="btn-ghost w-full justify-center py-3 rounded-xl border"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {loading === 'guest'
              ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)' }} />
              : <UserRound className="w-4 h-4" />}
            Continue as Guest
          </button>
        </Card>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  )

  // ── Email sign-in ───────────────────────────────────────────────────────
  if (mode === 'signin') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <Logo />
        <Card>
          <button
            onClick={backToOptions}
            className="flex items-center gap-1.5 text-xs mb-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in with email</h2>

          {/* Email field */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle('email', () => signInWithEmail(email, password))}
              placeholder="Email address"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          {/* Password field */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle('email', () => signInWithEmail(email, password))}
              placeholder="Password"
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => handle('email', () => signInWithEmail(email, password))}
            disabled={!email.trim() || !password || loading !== null}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'email'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : null}
            Sign In
          </button>

          <div className="flex justify-between text-xs pt-1">
            <button
              onClick={() => setMode('reset')}
              style={{ color: 'var(--color-primary-light)' }}
              className="hover:underline"
            >
              Forgot password?
            </button>
            <button
              onClick={() => { setMode('signup'); setPassword('') }}
              style={{ color: 'var(--color-primary-light)' }}
              className="hover:underline"
            >
              Create account
            </button>
          </div>
        </Card>
      </div>
    </div>
  )

  // ── Email sign-up ───────────────────────────────────────────────────────
  if (mode === 'signup') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <Logo />
        <Card>
          <button
            onClick={backToOptions}
            className="flex items-center gap-1.5 text-xs mb-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create your account</h2>

          {/* Name */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name (optional)"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle('signup', () => signUpWithEmail(email, password, name))}
              placeholder="Password (min 6 characters)"
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={() => handle('signup', () => signUpWithEmail(email, password, name))}
            disabled={!email.trim() || password.length < 6 || loading !== null}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'signup'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : null}
            Create Account
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <button onClick={() => { setMode('signin'); setPassword('') }} style={{ color: 'var(--color-primary-light)' }} className="hover:underline">
              Sign in
            </button>
          </p>
        </Card>
      </div>
    </div>
  )

  // ── Password reset ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <Logo />
        <Card>
          <button
            onClick={backToOptions}
            className="flex items-center gap-1.5 text-xs mb-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reset password</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Enter your email and we'll send you a reset link.
          </p>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
              placeholder="Email address"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              autoFocus
            />
          </div>
          <button
            onClick={handleReset}
            disabled={!email.trim() || loading === 'reset'}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'reset'
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : null}
            Send Reset Link
          </button>
        </Card>
      </div>
    </div>
  )
}
