import { useState, useEffect, useCallback } from 'react'
import {
  Users, BarChart3, Activity, ScrollText, RefreshCw,
  ShieldCheck, User, CheckCircle, XCircle, Search,
  MessageSquare, Image, TrendingUp,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJSON } from '../utils/api'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'overview',  label: 'Overview',     icon: BarChart3  },
  { id: 'users',     label: 'Users',        icon: Users      },
  { id: 'health',    label: 'Model Health', icon: Activity   },
  { id: 'audit',     label: 'Audit Log',    icon: ScrollText },
]

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = '#a78bfa' }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {value ?? '—'}
          </p>
        </div>
        <div
          className="p-2 rounded-xl"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

// ── OverviewTab ────────────────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  if (!stats) return (
    <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
      Loading stats…
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Total Users"    value={stats.totalUsers}    color="#60a5fa" />
        <StatCard icon={MessageSquare} label="Total Messages" value={stats.totalMessages} color="#a78bfa" />
        <StatCard icon={Image}         label="Total Images"   value={stats.totalImages}   color="#f472b6" />
        <StatCard icon={TrendingUp}    label="Active Today"   value={stats.daily?.at(-1)?.activeUsers ?? 0} color="#4ade80" />
      </div>

      {/* Daily activity */}
      {stats.daily?.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Daily Activity (last 7 days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left pb-2">Date</th>
                  <th className="text-right pb-2">Messages</th>
                  <th className="text-right pb-2">Images</th>
                  <th className="text-right pb-2">Active Users</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.daily].reverse().slice(0, 7).map((d, i) => (
                  <tr
                    key={d.date}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <td className="py-2">{d.date}</td>
                    <td className="text-right">{d.chat}</td>
                    <td className="text-right">{d.images}</td>
                    <td className="text-right">{d.activeUsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model breakdown */}
      {stats.modelBreakdown?.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Model Usage Breakdown
          </h3>
          <div className="space-y-2">
            {stats.modelBreakdown.slice(0, 8).map(({ model, count }) => {
              const pct = Math.round((count / (stats.totalMessages || 1)) * 100)
              return (
                <div key={model} className="flex items-center gap-3">
                  <span className="text-xs w-48 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {model}
                  </span>
                  <div
                    className="flex-1 rounded-full h-2"
                    style={{ backgroundColor: 'var(--bg-input)' }}
                  >
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
                    />
                  </div>
                  <span className="text-xs w-12 text-right" style={{ color: 'var(--text-muted)' }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── UsersTab ───────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    apiJSON('/api/admin/users?limit=100')
      .then(d => setUsers(d.users || []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  const setRole = async (uid, role) => {
    try {
      await apiJSON(`/api/admin/users/${uid}/role`, {
        method: 'POST', body: JSON.stringify({ role }),
      })
      setUsers(p => p.map(u => u.uid === uid ? { ...u, role } : u))
      toast.success(`Role → ${role}`)
    } catch { toast.error('Failed to update role') }
  }

  const setPlan = async (uid, plan) => {
    try {
      await apiJSON(`/api/admin/users/${uid}/plan`, {
        method: 'POST', body: JSON.stringify({ plan }),
      })
      setUsers(p => p.map(u => u.uid === uid ? { ...u, plan } : u))
      toast.success(`Plan → ${plan}`)
    } catch { toast.error('Failed to update plan') }
  }

  const toggleDisable = async (uid, disabled) => {
    try {
      await apiJSON(`/api/admin/users/${uid}/disable`, {
        method: 'POST', body: JSON.stringify({ disabled }),
      })
      setUsers(p => p.map(u => u.uid === uid ? { ...u, disabled } : u))
      toast.success(disabled ? 'User disabled' : 'User enabled')
    } catch { toast.error('Failed to toggle user') }
  }

  const filtered = users.filter(u =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
      Loading users…
    </div>
  )

  const roleStyle = {
    admin: { color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)' },
    user:  { color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)' },
    guest: { color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)' },
  }
  const planStyle = {
    enterprise: { color: '#c084fc', backgroundColor: 'rgba(192,132,252,0.1)' },
    pro:        { color: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)' },
    free:       { color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)' },
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <input
          className="input pl-9 w-full max-w-xs"
          placeholder="Search by email or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--bg-input)' }}>
              <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Provider</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.uid}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                  }}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {u.photoUrl ? (
                        <img src={u.photoUrl} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--bg-input)' }}
                        >
                          <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {u.displayName || '—'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {u.email || u.uid.slice(0, 12) + '…'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.role || 'user'}
                      onChange={e => setRole(u.uid, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border-0 outline-none cursor-pointer font-medium"
                      style={roleStyle[u.role] || roleStyle.user}
                    >
                      <option value="admin">admin</option>
                      <option value="user">user</option>
                      <option value="guest">guest</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.plan || 'free'}
                      onChange={e => setPlan(u.uid, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border-0 outline-none cursor-pointer font-medium"
                      style={planStyle[u.plan] || planStyle.free}
                    >
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {u.providerIds?.join(', ') || '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    {u.disabled ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> Disabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => toggleDisable(u.uid, !u.disabled)}
                      className="text-xs px-2 py-1 rounded-lg transition-colors"
                      style={u.disabled
                        ? { color: '#4ade80' }
                        : { color: '#f87171' }
                      }
                    >
                      {u.disabled ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="px-3 py-2 border-t text-xs"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          {filtered.length} of {users.length} users
        </div>
      </div>
    </div>
  )
}

// ── HealthTab ──────────────────────────────────────────────────────────────────
function HealthTab() {
  const [health,  setHealth]  = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiJSON('/api/admin/model-health')
      .then(setHealth)
      .catch(() => toast.error('Failed to load health data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
      Loading health data…
    </div>
  )

  const providers = health?.providers || []
  const PROVIDER_ICONS = {
    gemini:             '🟢',
    openrouter_premium: '🔵',
    openrouter_free:    '🟡',
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="btn-ghost text-xs gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>All providers healthy</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No errors logged in the last 24h
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map(p => (
            <div key={p.provider} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{PROVIDER_ICONS[p.provider] || '⚪'}</span>
                <div>
                  <p className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                    {p.provider}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {p.errors} error{p.errors !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {p.lastErrorCode && (
                <div className="text-xs bg-red-400/10 text-red-400 rounded-lg px-3 py-2">
                  Last error: {p.lastErrorCode}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AuditTab ───────────────────────────────────────────────────────────────────
function AuditTab() {
  const [log,     setLog]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJSON('/api/admin/audit-log?limit=100')
      .then(setLog)
      .catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
      Loading audit log…
    </div>
  )

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--bg-input)' }}>
            <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <th className="text-left p-3">Timestamp</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Endpoint</th>
              <th className="text-left p-3">Model</th>
              <th className="text-right p-3">Latency</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e, i) => (
              <tr
                key={i}
                style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : 'none' }}
              >
                <td className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {e.timestamp ? new Date(
                    e.timestamp._seconds ? e.timestamp._seconds * 1000 : e.timestamp
                  ).toLocaleString() : '—'}
                </td>
                <td className="p-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {e.uid?.slice(0, 10)}…
                </td>
                <td className="p-3">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                  >
                    {e.endpoint || '—'}
                  </span>
                </td>
                <td className="p-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {e.model || '—'}
                </td>
                <td className="p-3 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                  {e.latency_ms != null ? `${e.latency_ms}ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {log.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
            No audit events yet
          </div>
        )}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab,   setTab]   = useState('overview')
  const [stats, setStats] = useState(null)
  const { isAdmin }       = useAuth()

  useEffect(() => {
    if (tab === 'overview') {
      apiJSON('/api/admin/usage?days=30').then(setStats).catch(() => {})
    }
  }, [tab])

  if (!isAdmin) return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ backgroundColor: 'var(--bg-app)' }}
    >
      <div className="text-center">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Admin access required</p>
      </div>
    </div>
  )

  return (
    <div
      className="p-6 max-w-6xl mx-auto min-h-screen"
      style={{ backgroundColor: 'var(--bg-app)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(251,191,36,0.1)' }}>
          <ShieldCheck className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Manage users, usage analytics, and system health
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ backgroundColor: 'var(--bg-input)' }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-all"
            style={tab === id ? {
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            } : {
              color: 'var(--text-muted)',
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'overview' && <OverviewTab stats={stats} />}
      {tab === 'users'    && <UsersTab />}
      {tab === 'health'   && <HealthTab />}
      {tab === 'audit'    && <AuditTab />}
    </div>
  )
}
