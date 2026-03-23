import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Key, Palette, Shield, Save, Eye, EyeOff, Check, Loader2, LogOut, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { apiJSON } from '../utils/api'
import toast from 'react-hot-toast'

const SECTIONS = [
  { id: 'profile',    icon: User,    label: 'Profile'    },
  { id: 'keys',       icon: Key,     label: 'API Keys'   },
  { id: 'appearance', icon: Palette, label: 'Appearance' },
  { id: 'account',    icon: LogOut,  label: 'Account'    },
]

function ProfileSection({ user }) {
  const [nickname, setNickname] = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    apiJSON('/api/profile?section=personalization')
      .then(d => setNickname(d.nickname || ''))
      .catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiJSON('/api/profile', {
        method: 'POST',
        body: JSON.stringify({ section: 'personalization', data: { nickname } }),
      })
      toast.success('Saved')
    } catch { toast.error('Save failed') }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-primary)' }}>
          Display name
        </label>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {user?.displayName || 'Guest user'}
        </p>
        <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-primary)' }}>
          Nickname <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(used in greetings)</span>
        </label>
        <input
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder="e.g. Alex"
          className="input max-w-xs"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-primary)' }}>
          Email
        </label>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {user?.email || 'Guest (no email)'}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary px-5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save changes
        </button>
      </div>
    </div>
  )
}

function KeysSection() {
  const PROVIDERS = [
    { id: 'gemini',      label: 'Google Gemini',  placeholder: 'AIzaSy...',    hint: 'Get free key at aistudio.google.com' },
    { id: 'openrouter',  label: 'OpenRouter',      placeholder: 'sk-or-v1-...', hint: 'Free tier available at openrouter.ai' },
    { id: 'openai',      label: 'OpenAI',          placeholder: 'sk-...',       hint: 'Required for DALL-E image generation' },
    { id: 'huggingface', label: 'HuggingFace',     placeholder: 'hf_...',       hint: 'For HF image models (FLUX.1)' },
  ]
  const [keys,   setKeys]   = useState({})
  const [visible,setVisible]= useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    apiJSON('/api/keys').then(d => setKeys(d || {})).catch(() => {})
  }, [])

  const save = async (provider) => {
    setSaving(s => ({ ...s, [provider]: true }))
    try {
      await apiJSON('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key: keys[provider] || '' }),
      })
      toast.success(`${provider} key saved`)
    } catch { toast.error('Save failed') }
    setSaving(s => ({ ...s, [provider]: false }))
  }

  const remove = async (provider) => {
    try {
      await apiJSON('/api/keys', {
        method: 'DELETE',
        body: JSON.stringify({ provider }),
      })
      setKeys(k => ({ ...k, [provider]: '' }))
      toast.success(`${provider} key removed`)
    } catch { toast.error('Remove failed') }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Add your own API keys for better rate limits and access to premium models.
      </p>
      {PROVIDERS.map(p => (
        <div key={p.id} className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.hint}</p>
            </div>
            {keys[p.id] && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={visible[p.id] ? 'text' : 'password'}
                value={keys[p.id] || ''}
                onChange={e => setKeys(k => ({ ...k, [p.id]: e.target.value }))}
                placeholder={p.placeholder}
                className="input pr-9 text-xs"
              />
              <button
                onClick={() => setVisible(v => ({ ...v, [p.id]: !v[p.id] }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                {visible[p.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button onClick={() => save(p.id)} disabled={saving[p.id]} className="btn-primary px-3 text-xs">
              {saving[p.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </button>
            {keys[p.id] && (
              <button onClick={() => remove(p.id)} className="btn-ghost px-3 text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const ACCENT_OPTIONS = [
  { id: 'purple', color: '#7c3aed', label: 'Purple' },
  { id: 'blue',   color: '#2563eb', label: 'Blue'   },
  { id: 'green',  color: '#059669', label: 'Green'  },
  { id: 'orange', color: '#ea580c', label: 'Orange' },
  { id: 'pink',   color: '#db2777', label: 'Pink'   },
]

function AppearanceSection() {
  const { theme, setTheme, accent, setAccent } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Theme</p>
        <div className="flex gap-3">
          {['dark', 'light'].map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="px-5 py-2.5 rounded-xl text-sm capitalize font-medium transition-all border-2"
              style={theme === t ? {
                borderColor: 'var(--color-primary)',
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                color: 'var(--color-primary)',
              } : {
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Current: <span className="font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>{theme}</span>
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Accent Color</p>
        <div className="flex gap-3 flex-wrap">
          {ACCENT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setAccent(opt.id)}
              title={opt.label}
              className="w-9 h-9 rounded-full transition-all hover:scale-105"
              style={{
                backgroundColor: opt.color,
                outline: accent === opt.id ? `3px solid ${opt.color}` : 'none',
                outlineOffset: accent === opt.id ? '3px' : '0',
                transform: accent === opt.id ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Current accent: <span className="font-medium capitalize" style={{ color: 'var(--color-primary-light)' }}>{accent}</span>
        </p>
      </div>

      <div className="card p-4">
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Preview</p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary text-xs px-3 py-1.5">Primary Button</button>
          <button className="btn-ghost text-xs px-3 py-1.5">Ghost Button</button>
          <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            Badge
          </span>
        </div>
      </div>
    </div>
  )
}

function AccountSection() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try { await signOut(); navigate('/login') }
    catch { toast.error('Sign-out failed'); setSigningOut(false) }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&background=7c3aed&color=fff&size=64`}
            alt="avatar"
            className="w-12 h-12 rounded-full ring-2"
            style={{ ringColor: 'var(--color-primary)' }}
          />
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{user?.displayName || 'Guest'}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email || 'Guest account'}</p>
          </div>
        </div>
        <div className="pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Signing out will end your current session. Your data and history will be preserved.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all"
            style={{ borderColor: '#f87171', color: '#f87171' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="card p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(248,113,113,0.12)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: '#f87171' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Sign out?</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your session will end</p>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Are you sure you want to sign out? You can sign back in at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium border transition-all"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#b91c1c' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#dc2626' }}
              >
                {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [active, setActive] = useState('profile')
  const { user } = useAuth()

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Nav */}
      <div
        className="w-56 shrink-0 p-4"
        style={{ borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}
      >
        <h1 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Shield className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> Settings
        </h1>
        <nav className="space-y-0.5">
          {SECTIONS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
              style={active === id ? {
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              } : {
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                if (active !== id) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-input)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (active !== id) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto max-w-2xl">
        <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          {SECTIONS.find(s => s.id === active)?.label}
        </h2>
        {active === 'profile'    && <ProfileSection user={user} />}
        {active === 'keys'       && <KeysSection />}
        {active === 'appearance' && <AppearanceSection />}
        {active === 'account'    && <AccountSection />}
      </div>
    </div>
  )
}
