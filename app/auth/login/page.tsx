'use client'
import { useState } from 'react'
import { auth } from '@/lib/firebase-client'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
        toast.success('Account created! Welcome to PYXIS 🎉')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        toast.success('Welcome back!')
      }
      router.push('/chat')
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' ? 'No account found. Sign up first!' :
                  err.code === 'auth/wrong-password' ? 'Wrong password.' :
                  err.code === 'auth/email-already-in-use' ? 'Email already registered. Sign in!' :
                  err.code === 'auth/weak-password' ? 'Password must be 6+ characters.' :
                  err.message
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      toast.success('Signed in with Google!')
      router.push('/chat')
    } catch (err: any) {
      toast.error(err.message)
    } finally { setGoogleLoading(false) }
  }

  const handleReset = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    await sendPasswordResetEmail(auth, email)
    toast.success('Password reset email sent!')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      {/* Glow BG */}
      <div style={{ position:'absolute', top:'25%', left:'25%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle, rgba(0,255,163,0.06), transparent)', filter:'blur(60px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'25%', right:'25%', width:'400px', height:'400px', borderRadius:'50%', background:'radial-gradient(circle, rgba(77,159,255,0.06), transparent)', filter:'blur(60px)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:'400px', padding:'0 1.5rem', position:'relative' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'60px', height:'60px', borderRadius:'16px', background:'linear-gradient(135deg,#00ffa3,#4d9fff)', boxShadow:'0 0 40px rgba(0,255,163,0.3)', marginBottom:'1rem' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="#04050a" strokeWidth="2.5" fill="none"/>
              <path d="M16 4L16 28M4 10L28 22M28 10L4 22" stroke="#04050a" strokeWidth="1"/>
              <circle cx="16" cy="16" r="3" fill="#04050a"/>
            </svg>
          </div>
          <h1 style={{ fontSize:'1.8rem', fontWeight:800, color:'#fff', letterSpacing:'-1px' }}>PYXIS</h1>
          <p style={{ color:'var(--t2)', fontSize:'0.85rem', marginTop:'4px' }}>All AI models · One place · Free forever</p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'20px', padding:'2rem' }}>
          <h2 style={{ color:'#fff', fontWeight:600, fontSize:'1.1rem', marginBottom:'1.5rem', textAlign:'center' }}>
            {isSignUp ? 'Create your account' : 'Sign in to PYXIS'}
          </h2>

          {/* Google Button */}
          <button onClick={handleGoogle} disabled={googleLoading}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', padding:'11px', borderRadius:'12px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--text)', fontSize:'14px', fontWeight:500, cursor:'pointer', marginBottom:'1.2rem', opacity: googleLoading ? 0.6 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'1.2rem' }}>
            <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
            <span style={{ color:'var(--t3)', fontSize:'12px' }}>or</span>
            <div style={{ flex:1, height:'1px', background:'var(--border)' }} />
          </div>

          <form onSubmit={handleEmailAuth} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required
              style={{ padding:'11px 14px', borderRadius:'10px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--text)', fontSize:'14px', outline:'none' }} />
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (6+ characters)" required minLength={6}
              style={{ padding:'11px 14px', borderRadius:'10px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--text)', fontSize:'14px', outline:'none' }} />
            <button type="submit" disabled={loading}
              style={{ padding:'12px', borderRadius:'12px', border:'none', background:'linear-gradient(135deg,#00ffa3,#00cc82)', color:'#04050a', fontSize:'14px', fontWeight:700, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ display:'flex', justifyContent:'space-between', marginTop:'1rem' }}>
            <button onClick={()=>setIsSignUp(!isSignUp)} style={{ color:'var(--b)', background:'none', border:'none', fontSize:'13px', cursor:'pointer' }}>
              {isSignUp ? 'Already have account? Sign in' : 'No account? Sign up free'}
            </button>
            {!isSignUp && (
              <button onClick={handleReset} style={{ color:'var(--t3)', background:'none', border:'none', fontSize:'13px', cursor:'pointer' }}>
                Forgot password?
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign:'center', color:'var(--t3)', fontSize:'12px', marginTop:'1.5rem' }}>
          Free forever · No credit card · Groq + Gemini included
        </p>
      </div>
    </div>
  )
}
