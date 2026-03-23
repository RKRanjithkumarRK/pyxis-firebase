import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MessageSquare, Image, Mic, FlaskConical, Bot, Code2,
  BookOpen, Plus, Clock, ArrowRight, Sparkles, Zap,
  Activity, ChevronRight, LayoutGrid, Swords, Library,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiJSON } from '../utils/api'

const MODULES = [
  {
    to: '/chat', icon: MessageSquare, label: 'AI Chat',
    desc: 'Multi-model streaming conversations with memory',
    gradient: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(139,92,246,0.05))',
    hoverBorder: '#7c3aed',
    iconBg: 'rgba(124,58,237,0.2)',
    iconColor: '#8b5cf6',
    tag: 'Core',
    tagBg: 'rgba(124,58,237,0.2)', tagTxt: '#a78bfa',
  },
  {
    to: '/research', icon: FlaskConical, label: 'Research Studio',
    desc: 'Live web synthesis & competitive intelligence',
    gradient: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(6,182,212,0.05))',
    hoverBorder: '#2563eb',
    iconBg: 'rgba(37,99,235,0.2)',
    iconColor: '#60a5fa',
    tag: 'Live',
    tagBg: 'rgba(16,185,129,0.2)', tagTxt: '#34d399',
  },
  {
    to: '/agents', icon: Bot, label: 'Agent Fleet',
    desc: '8 specialist AI agents for every domain',
    gradient: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(16,185,129,0.05))',
    hoverBorder: '#059669',
    iconBg: 'rgba(5,150,105,0.2)',
    iconColor: '#34d399',
    tag: '8 Agents',
    tagBg: 'rgba(5,150,105,0.2)', tagTxt: '#34d399',
  },
  {
    to: '/code', icon: Code2, label: 'Code Studio',
    desc: '8 modes across 15+ programming languages',
    gradient: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(245,158,11,0.05))',
    hoverBorder: '#d97706',
    iconBg: 'rgba(217,119,6,0.2)',
    iconColor: '#fbbf24',
    tag: 'Dev',
    tagBg: 'rgba(217,119,6,0.2)', tagTxt: '#fbbf24',
  },
  {
    to: '/rag', icon: BookOpen, label: 'Knowledge Mesh',
    desc: 'Upload docs & ask questions with AI citations',
    gradient: 'linear-gradient(135deg, rgba(234,88,12,0.15), rgba(251,146,60,0.05))',
    hoverBorder: '#ea580c',
    iconBg: 'rgba(234,88,12,0.2)',
    iconColor: '#fb923c',
    tag: 'RAG',
    tagBg: 'rgba(234,88,12,0.2)', tagTxt: '#fb923c',
  },
  {
    to: '/images', icon: Image, label: 'Image Studio',
    desc: 'AI image generation with multi-provider support',
    gradient: 'linear-gradient(135deg, rgba(219,39,119,0.15), rgba(244,63,94,0.05))',
    hoverBorder: '#db2777',
    iconBg: 'rgba(219,39,119,0.2)',
    iconColor: '#f472b6',
    tag: 'Multi-Provider',
    tagBg: 'rgba(219,39,119,0.2)', tagTxt: '#f472b6',
  },
  {
    to: '/voice', icon: Mic, label: 'Voice Assistant',
    desc: 'Live voice AI with real-time TTS response',
    gradient: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(6,182,212,0.05))',
    hoverBorder: '#14b8a6',
    iconBg: 'rgba(20,184,166,0.2)',
    iconColor: '#2dd4bf',
    tag: 'Live TTS',
    tagBg: 'rgba(20,184,166,0.2)', tagTxt: '#2dd4bf',
  },
  {
    to: '/arena', icon: Swords, label: 'Model Arena',
    desc: 'Battle AI models side-by-side in real-time',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(167,139,250,0.05))',
    hoverBorder: '#8b5cf6',
    iconBg: 'rgba(139,92,246,0.2)',
    iconColor: '#a78bfa',
    tag: 'Compare',
    tagBg: 'rgba(139,92,246,0.2)', tagTxt: '#a78bfa',
  },
  {
    to: '/prompts', icon: Library, label: 'Prompt Library',
    desc: 'Curated prompts for every use case',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(129,140,248,0.05))',
    hoverBorder: '#6366f1',
    iconBg: 'rgba(99,102,241,0.2)',
    iconColor: '#818cf8',
    tag: 'Templates',
    tagBg: 'rgba(99,102,241,0.2)', tagTxt: '#818cf8',
  },
]

function timeAgo(ts) {
  if (!ts) return ''
  const ms = ts._seconds ? ts._seconds * 1000 : new Date(ts).getTime()
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ModuleCard({ mod }) {
  const { to, icon: Icon, label, desc, gradient, hoverBorder, iconBg, iconColor, tag, tagBg, tagTxt } = mod
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      to={to}
      className="no-underline"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="h-full rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 cursor-pointer"
        style={{
          background: hovered ? gradient : 'var(--bg-card)',
          border: `1px solid ${hovered ? hoverBorder + '60' : 'var(--border-color)'}`,
          transform: hovered ? 'translateY(-2px)' : 'none',
          boxShadow: hovered ? `0 8px 25px ${hoverBorder}20` : 'none',
        }}
      >
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-xl" style={{ backgroundColor: iconBg }}>
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tagBg, color: tagTxt }}>{tag}</span>
        </div>
        <div>
          <p className="text-sm font-semibold mb-1 transition-colors" style={{ color: hovered ? iconColor : 'var(--text-primary)' }}>{label}</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
        </div>
        <div className="flex items-center gap-1 text-xs mt-auto" style={{ color: hovered ? iconColor : 'var(--text-muted)' }}>
          Launch <ArrowRight className="w-3 h-3" style={{ transform: hovered ? 'translateX(3px)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>
    </Link>
  )
}

export default function Hub() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const [convos,  setConvos]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJSON('/api/conversations')
      .then(d => setConvos(d.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const name = user?.displayName?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen p-6 lg:p-10" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="max-w-7xl mx-auto">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="mb-10 relative">
          {/* Ambient gradient */}
          <div className="absolute -top-10 -left-10 w-96 h-96 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, var(--color-primary), transparent 70%)' }} />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))' }}>
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-primary-light)' }}>Pyxis One</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>Enterprise AI</span>
                </div>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-2 leading-tight">
                <span style={{ color: 'var(--text-primary)' }}>{getGreeting()}, </span>
                <span style={{ background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {name}
                </span>
              </h1>
              <p className="text-base lg:text-lg" style={{ color: 'var(--text-secondary)' }}>
                Your enterprise AI workspace — 9 surfaces, infinite possibilities.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/chat')}
                className="btn-primary gap-2 px-5 py-2.5"
              >
                <Plus className="w-4 h-4" /> New Chat
              </button>
              <button
                onClick={() => navigate('/research')}
                className="btn-ghost gap-2 px-4 py-2.5 rounded-xl border"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <Zap className="w-4 h-4" style={{ color: 'var(--color-primary-light)' }} />
                Research
              </button>
            </div>
          </div>
        </div>

        {/* ── Module Grid ──────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>AI Surfaces</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {MODULES.length} modules
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {MODULES.map(mod => <ModuleCard key={mod.to} mod={mod} />)}
          </div>
        </div>

        {/* ── Recent Activity ──────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Recent Conversations</h2>
            </div>
            <button onClick={() => navigate('/chat')} className="btn-ghost text-xs py-1.5 px-3 gap-1.5 rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
              <Plus className="w-3 h-3" /> New
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-card)' }} />
              ))}
            </div>
          ) : convos.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, transparent 100%)', backgroundColor: 'var(--bg-input)' }}>
                <MessageSquare className="w-6 h-6" style={{ color: 'var(--color-primary-light)' }} />
              </div>
              <p className="text-base font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>Start your first AI conversation and it'll appear here.</p>
              <button onClick={() => navigate('/chat')} className="btn-primary mx-auto">
                <Plus className="w-4 h-4" /> Start chatting
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              {convos.map(c => (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  className="no-underline group"
                >
                  <div
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-150"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--color-primary-light)' }} />
                    </div>
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                    <div className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {timeAgo(c.updatedAt)}
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary-light)' }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
