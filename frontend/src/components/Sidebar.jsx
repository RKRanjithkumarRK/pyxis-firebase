import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Image, Mic, LogOut,
  ChevronLeft, ChevronRight, Sparkles, FlaskConical,
  Code2, Bot, BookOpen, FolderOpen, Settings,
  Plus, Trash2, ChevronDown, ChevronRight as ChevronR,
  Swords, Library, CalendarClock, ShieldCheck,
  Zap, X, ChevronUp, FileText, Code, Mic2, ImageIcon,
  Search, FileCode, StickyNote,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { apiJSON } from '../utils/api'
import toast from 'react-hot-toast'

/* ── Artifact type icon + color ─────────────────────────────── */
const ARTIFACT_META = {
  research: { icon: Search,   color: '#60a5fa', label: 'Research'  },
  code:     { icon: FileCode, color: '#4ade80', label: 'Code'      },
  image:    { icon: ImageIcon,color: '#f472b6', label: 'Image'     },
  document: { icon: FileText, color: '#fb923c', label: 'Document'  },
  voice:    { icon: Mic2,     color: '#a78bfa', label: 'Voice'     },
  prompt:   { icon: StickyNote,color:'#fbbf24', label: 'Prompt'    },
  chat:     { icon: MessageSquare, color: '#34d399', label: 'Chat' },
}

const SOURCE_ROUTES = {
  '/research': 'Research', '/rag': 'Knowledge', '/images': 'Images',
  '/code': 'Code Studio', '/voice': 'Voice', '/prompts': 'Prompts', '/chat': 'Chat',
}

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/hub',    icon: LayoutDashboard, label: 'Hub'    },
      { to: '/chat',   icon: MessageSquare,   label: 'Chat'   },
      { to: '/images', icon: Image,           label: 'Images' },
      { to: '/voice',  icon: Mic,             label: 'Voice'  },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/research', icon: FlaskConical, label: 'Research',    badge: 'Live' },
      { to: '/agents',   icon: Bot,          label: 'Agent Fleet' },
      { to: '/arena',    icon: Swords,       label: 'Model Arena', badge: 'New' },
    ],
  },
  {
    label: 'Studios',
    items: [
      { to: '/code',      icon: Code2,         label: 'Code Studio'    },
      { to: '/rag',       icon: BookOpen,      label: 'Knowledge'      },
      { to: '/prompts',   icon: Library,       label: 'Prompt Library' },
      { to: '/schedules', icon: CalendarClock, label: 'Schedules',      badge: 'New' },
    ],
  },
]

function getTs(ts) {
  if (!ts) return 0
  return ts._seconds ? ts._seconds * 1000 : new Date(ts).getTime()
}

function timeLabel(ts) {
  const ms = getTs(ts)
  if (!ms) return ''
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function groupConvos(convos) {
  const now = Date.now()
  const DAY = 86400000
  const groups = [
    { label: 'Today',        items: [] },
    { label: 'Yesterday',    items: [] },
    { label: 'Last 7 days',  items: [] },
    { label: 'Last 30 days', items: [] },
    { label: 'Older',        items: [] },
  ]
  for (const c of convos) {
    const ms = getTs(c.updatedAt || c.createdAt)
    const diff = now - ms
    if (diff < DAY)          groups[0].items.push(c)
    else if (diff < 2 * DAY) groups[1].items.push(c)
    else if (diff < 7 * DAY) groups[2].items.push(c)
    else if (diff < 30 * DAY)groups[3].items.push(c)
    else                     groups[4].items.push(c)
  }
  return groups.filter(g => g.items.length > 0)
}

export default function Sidebar({ mobileOpen = false, onMobileClose = () => {} }) {
  const [open, setOpen]                 = useState(true)
  const [isDesktop, setIsDesktop]       = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = e => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const [showChats, setShowChats]       = useState(true)
  const [convos, setConvos]             = useState([])
  const [projects, setProjects]         = useState([])
  const [showProjects, setShowProjects] = useState(false)
  const [showWsPanel, setShowWsPanel]   = useState(false)
  const [showNewWs, setShowNewWs]       = useState(false)
  const [wsName, setWsName]             = useState('')
  const [wsGoal, setWsGoal]             = useState('')
  const { user, signOut, isAdmin }      = useAuth()
  const {
    activeWorkspace, createWorkspace, clearActiveWorkspace,
    setActiveWorkspace, workspaces, removeArtifact,
  } = useWorkspace()
  const navigate                        = useNavigate()
  const { id: activeConvId }            = useParams()
  const wsNameRef                       = useRef(null)

  useEffect(() => {
    if (!user) return
    apiJSON('/api/conversations').then(d => setConvos(d.slice(0, 20))).catch(() => {})
    apiJSON('/api/projects').then(setProjects).catch(() => {})
  }, [user])

  const handleSignOut = async () => {
    try { await signOut(); navigate('/login') }
    catch { toast.error('Sign-out failed') }
  }

  const handleCreateWs = () => {
    if (!wsName.trim()) return
    createWorkspace(wsName.trim(), wsGoal.trim())
    setWsName(''); setWsGoal(''); setShowNewWs(false); setShowWsPanel(true)
    toast.success('Workspace created')
  }

  const deleteConvo = async (id, e) => {
    e.preventDefault(); e.stopPropagation()
    try {
      await apiJSON(`/api/conversations/${id}`, { method: 'DELETE' })
      setConvos(p => p.filter(c => c.id !== id))
      if (activeConvId === id) navigate('/chat', { replace: true })
    } catch { toast.error('Delete failed') }
  }

  return (
    <aside
      className="flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        position: isDesktop ? 'sticky' : 'fixed',
        top: 0,
        left: 0,
        height: isDesktop ? '100vh' : '100%',
        zIndex: isDesktop ? 'auto' : 30,
        width: isDesktop ? (open ? '240px' : '64px') : '280px',
        flexShrink: isDesktop ? 0 : 'unset',
        transform: isDesktop ? 'none' : (mobileOpen ? 'translateX(0)' : 'translateX(-100%)'),
        transition: 'transform 0.25s ease, width 0.2s ease',
        boxShadow: (!isDesktop && mobileOpen) ? '4px 0 32px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      {/* ── Header / Logo ─────────────────────────────────────────── */}
      <div
        className={`flex items-center ${open || !isDesktop ? 'justify-between px-3' : 'justify-center'} py-3.5`}
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        {open && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Pyxis One</span>
              <span
                className="ml-1.5 text-[9px] px-1 py-0.5 rounded font-medium tracking-wide uppercase"
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  color: 'var(--color-primary-light)',
                }}
              >
                AI
              </span>
            </div>
          </div>
        )}
        {!isDesktop ? (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setOpen(v => !v)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            title={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* ── New Chat button ────────────────────────────────────────── */}
      {open && (
        <div className="px-2.5 pt-3 pb-1">
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary w-full justify-center py-2 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
      )}

      {/* ── Workspace Banner ─────────────────────────────────────── */}
      {open && (
        <div className="px-2.5 pb-2">
          {showNewWs ? null : activeWorkspace ? (
            <div
              className="rounded-xl p-2.5 cursor-pointer"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
              }}
            >
              {/* Header row */}
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 shrink-0" style={{ color: 'var(--color-primary-light)' }} />
                <span
                  className="flex-1 text-xs font-semibold truncate"
                  style={{ color: 'var(--color-primary-light)' }}
                  onClick={() => setShowWsPanel(v => !v)}
                >
                  {activeWorkspace.name}
                </span>
                <button
                  onClick={() => setShowWsPanel(v => !v)}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: 'var(--color-primary-light)' }}
                  title="Toggle panel"
                >
                  {showWsPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => { setShowNewWs(true); setShowWsPanel(false) }}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: 'var(--color-primary-light)' }}
                  title="New workspace"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={clearActiveWorkspace}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="Deactivate workspace"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {/* Artifact count */}
              <p className="text-[10px] mt-0.5 ml-4.5" style={{ color: 'var(--text-muted)' }}>
                {activeWorkspace.artifacts.length} artifact{activeWorkspace.artifacts.length !== 1 ? 's' : ''} · active task
              </p>

              {/* Expanded panel */}
              {showWsPanel && (
                <div className="mt-2 space-y-1.5">
                  {activeWorkspace.goal && (
                    <p className="text-[10px] italic px-1" style={{ color: 'var(--text-secondary)' }}>
                      {activeWorkspace.goal.slice(0, 80)}
                    </p>
                  )}
                  {activeWorkspace.artifacts.length === 0 && (
                    <p className="text-[10px] px-1" style={{ color: 'var(--text-muted)' }}>
                      No artifacts yet. Use any AI feature and click "Add to Workspace".
                    </p>
                  )}
                  {activeWorkspace.artifacts.slice(-6).reverse().map(a => {
                    const meta = ARTIFACT_META[a.type] || ARTIFACT_META.research
                    const Icon = meta.icon
                    return (
                      <div key={a.id} className="flex items-start gap-1.5 group">
                        <Icon className="w-3 h-3 mt-0.5 shrink-0" style={{ color: meta.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                            {a.title}
                          </p>
                          {a.source && (
                            <button
                              onClick={() => navigate(a.source)}
                              className="text-[9px] transition-colors"
                              style={{ color: 'var(--color-primary-light)' }}
                            >
                              Open in {SOURCE_ROUTES[a.source] || a.source} →
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => removeArtifact(a.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )
                  })}
                  {/* Other workspaces — switch between them */}
                  {workspaces.filter(w => w.id !== activeWorkspace.id).length > 0 && (
                    <div className="pt-1.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)' }}>
                      <p className="text-[9px] uppercase tracking-wide px-1 mb-1" style={{ color: 'var(--text-muted)' }}>Switch to</p>
                      {workspaces.filter(w => w.id !== activeWorkspace.id).map(w => (
                        <button
                          key={w.id}
                          onClick={() => setActiveWorkspace(w.id)}
                          className="w-full flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] text-left transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary-light)'; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <Zap className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{w.name}</span>
                          <span className="ml-auto shrink-0 text-[9px]" style={{ color: 'var(--text-muted)' }}>{w.artifacts.length}a</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* ── Create workspace form — shown over any state ── */}
          {showNewWs && (
            <div
              className="rounded-xl p-2.5 space-y-2"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                New Workspace
              </p>
              <input
                ref={wsNameRef}
                autoFocus
                value={wsName}
                onChange={e => setWsName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateWs(); if (e.key === 'Escape') { setShowNewWs(false); setWsName(''); setWsGoal('') } }}
                placeholder="Name (e.g. Microservices Design)"
                className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <input
                value={wsGoal}
                onChange={e => setWsGoal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateWs() }}
                placeholder="Goal / objective (optional)"
                className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreateWs}
                  disabled={!wsName.trim()}
                  className="flex-1 text-[10px] font-semibold py-1 rounded-lg transition-colors"
                  style={{
                    backgroundColor: wsName.trim() ? 'var(--color-primary)' : 'var(--bg-app)',
                    color: wsName.trim() ? 'white' : 'var(--text-muted)',
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewWs(false); setWsName(''); setWsGoal('') }}
                  className="px-2 text-[10px] rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-app)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── No active workspace and not creating — compact trigger ── */}
          {!activeWorkspace && !showNewWs && (
            <button
              onClick={() => setShowNewWs(true)}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors border border-dashed"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary-light)'; e.currentTarget.style.borderColor = 'var(--color-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}
            >
              <Zap className="w-3 h-3" /> New Workspace
            </button>
          )}

          {/* ── Add new workspace button — always visible when one exists ── */}
          {activeWorkspace && !showNewWs && (
            <button
              onClick={() => { setShowNewWs(true); setShowWsPanel(false) }}
              className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors mt-1"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary-light)'; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Plus className="w-2.5 h-2.5" /> Add new workspace
            </button>
          )}
        </div>
      )}

      {/* ── Scrollable nav ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">

        {/* Nav groups */}
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {open && (
              <p
                className="text-[9px] font-bold uppercase tracking-widest px-2 mb-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, badge }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={!open ? label : undefined}
                  end={to === '/chat'}
                  onClick={onMobileClose}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all no-underline group"
                  style={({ isActive }) => isActive
                    ? {
                        background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 18%, transparent), color-mix(in srgb, var(--color-primary) 8%, transparent))',
                        color: 'var(--color-primary-light)',
                        borderLeft: '2px solid var(--color-primary)',
                        paddingLeft: open ? '10px' : '9px',
                      }
                    : {
                        color: 'var(--text-secondary)',
                        borderLeft: '2px solid transparent',
                      }
                  }
                  onMouseEnter={e => {
                    if (!e.currentTarget.style.background.includes('gradient')) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-input)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!e.currentTarget.style.background.includes('gradient')) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {open && (
                    <>
                      <span className="flex-1 font-medium text-xs">{label}</span>
                      {badge && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                          style={{
                            background: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                            color: 'var(--color-primary-light)',
                          }}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Recent Chats */}
        {open && convos.length > 0 && (
          <div>
            <button
              onClick={() => setShowChats(v => !v)}
              className="flex items-center gap-1 w-full px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {showChats ? <ChevronDown className="w-3 h-3" /> : <ChevronR className="w-3 h-3" />}
              Recent Chats
            </button>
            {showChats && (
              <div className="space-y-3">
                {groupConvos(convos).map(group => (
                  <div key={group.label}>
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest px-2 mb-1"
                      style={{ color: 'var(--text-muted)', opacity: 0.6 }}
                    >
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map(c => (
                        <NavLink
                          key={c.id}
                          to={`/chat/${c.id}`}
                          onClick={onMobileClose}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs group transition-colors no-underline"
                          style={({ isActive }) => isActive
                            ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }
                            : { color: 'var(--text-muted)' }
                          }
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-input)'
                            e.currentTarget.style.color = 'var(--text-secondary)'
                          }}
                          onMouseLeave={e => {
                            if (!e.currentTarget.classList.contains('active')) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                              e.currentTarget.style.color = 'var(--text-muted)'
                            }
                          }}
                        >
                          <span className="flex-1 truncate">{c.title}</span>
                          <span
                            className="shrink-0 text-[10px] group-hover:hidden"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {timeLabel(c.updatedAt)}
                          </span>
                          <button
                            onClick={e => deleteConvo(c.id, e)}
                            className="hidden group-hover:block shrink-0 p-0.5 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {open && (
          <div>
            <button
              onClick={() => setShowProjects(v => !v)}
              className="flex items-center gap-1 w-full px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {showProjects ? <ChevronDown className="w-3 h-3" /> : <ChevronR className="w-3 h-3" />}
              Projects
            </button>
            {showProjects && (
              <div className="space-y-0.5">
                {projects.map(p => (
                  <NavLink
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors no-underline"
                    style={({ isActive }) => isActive
                      ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }
                      : { color: 'var(--text-muted)' }
                    }
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-input)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--text-muted)'
                    }}
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" style={{ color: 'var(--color-primary-light)' }} />
                    <span className="flex-1 truncate">{p.name}</span>
                  </NavLink>
                ))}
                <button
                  onClick={() => navigate('/projects')}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors w-full"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <Plus className="w-3 h-3" /> New project
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="p-2 space-y-0.5" style={{ borderTop: '1px solid var(--border-color)' }}>
        {open ? (
          <>
            {isAdmin && (
              <NavLink
                to="/admin"
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors no-underline w-full"
                style={({ isActive }) => isActive
                  ? { backgroundColor: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#fbbf24' }
                  : { color: 'var(--text-secondary)' }
                }
                onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #f59e0b 10%, transparent)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">Admin Panel</span>
              </NavLink>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors w-full"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">Settings</span>
            </button>
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
              style={{ backgroundColor: 'var(--bg-input)' }}
            >
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&background=7c3aed&color=fff&size=32`}
                alt="avatar"
                className="w-6 h-6 rounded-full shrink-0 ring-1"
                style={{ ringColor: 'var(--color-primary)' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {user?.displayName || 'Guest'}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {user?.email || ''}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate('/settings')}
              title="Settings"
              className="w-full flex justify-center p-2 rounded-xl transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Settings className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
