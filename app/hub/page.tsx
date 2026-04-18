'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  BrainCircuit,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  FileUp,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Mic,
  Package,
  PenLine,
  Radar,
  Search,
  Sparkles,
  Terminal,
  Wand2,
  Workflow,
  Zap,
} from 'lucide-react'

const ROUTE_HISTORY_KEY = 'pyxis_recent_routes'

type LaunchModule = {
  title: string
  href: string
  description: string
  tag: string
  stat: string
  icon: typeof MessageSquare
  isNew?: boolean
}

const LAUNCH_MODULES: LaunchModule[] = [
  {
    title: 'AI Chat',
    href: '/chat',
    description: 'Streamed multimodel conversations with smart provider routing and fallback.',
    tag: 'Core',
    stat: '4 model lanes',
    icon: Sparkles,
  },
  {
    title: 'Command Center',
    href: '/tools/command-center',
    description: 'Live model mesh, agent throughput, and system events from one cockpit.',
    tag: 'Operations',
    stat: '24 live events',
    icon: Terminal,
  },
  {
    title: 'Research Studio',
    href: '/tools/research',
    description: 'Run live-search research and turn sources into exportable cited briefs.',
    tag: 'Flagship',
    stat: 'Cited briefs',
    icon: Search,
  },
  {
    title: 'Agent Fleet',
    href: '/tools/agents',
    description: 'Deploy specialist agents across research, content, analysis, and execution.',
    tag: 'Autonomous',
    stat: '12 agents',
    icon: Bot,
  },
  {
    title: 'Workflow Builder',
    href: '/tools/workflow',
    description: 'Chain models, tools, and approval logic into reusable AI runbooks.',
    tag: 'Automation',
    stat: '8 templates',
    icon: Workflow,
  },
  {
    title: 'Knowledge Mesh',
    href: '/tools/rag',
    description: 'Ground responses in your files, documents, and project context with retrieval.',
    tag: 'Memory',
    stat: 'Source-aware',
    icon: BrainCircuit,
  },
  {
    title: 'Code Studio',
    href: '/tools/code',
    description: 'Generate, inspect, and refine code inside the same enterprise AI workspace.',
    tag: 'Builder',
    stat: '50+ languages',
    icon: Code2,
  },
  {
    title: 'Document Intelligence',
    href: '/docs',
    description: 'Analyze, summarize, and extract insights from any document or file.',
    tag: 'New ✦',
    stat: 'PDF · DOCX · CSV',
    icon: FileText,
    isNew: true,
  },
  {
    title: 'AI Canvas',
    href: '/canvas',
    description: 'Collaborative infinite canvas for brainstorming and visual AI workflows.',
    tag: 'New ✦',
    stat: 'Visual workspace',
    icon: Layers,
    isNew: true,
  },
  {
    title: 'AI Memory',
    href: '/memory',
    description: 'Persistent context across sessions — the platform remembers your preferences.',
    tag: 'New ✦',
    stat: 'Always learning',
    icon: Brain,
    isNew: true,
  },
  {
    title: 'Writing Studio',
    href: '/tools/write',
    description: 'Long-form drafting, editing, and tone refinement with AI assistance.',
    tag: 'Creative',
    stat: '20+ templates',
    icon: PenLine,
  },
  {
    title: 'Image Studio',
    href: '/images',
    description: 'Generate, edit, and upscale images with state-of-the-art diffusion models.',
    tag: 'Media',
    stat: 'Multi-model',
    icon: ImageIcon,
  },
  {
    title: 'Voice AI',
    href: '/voice',
    description: 'Real-time speech-to-text, voice cloning, and conversational voice agents.',
    tag: 'Audio',
    stat: 'Real-time',
    icon: Mic,
  },
  {
    title: 'Model Arena',
    href: '/tools/compare',
    description: 'Side-by-side model evaluation with shared prompts and quality scoring.',
    tag: 'Evaluation',
    stat: '6 providers',
    icon: Radar,
  },
  {
    title: 'Marketplace',
    href: '/tools/marketplace',
    description: 'Discover, install, and configure AI tools, plugins, and integrations.',
    tag: 'Ecosystem',
    stat: '40+ integrations',
    icon: Package,
  },
]

const QUICK_ACTIONS = [
  { label: 'New Chat', icon: MessageSquare, href: '/chat', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { label: 'Upload Document', icon: FileUp, href: '/docs', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { label: 'Create Canvas', icon: Layers, href: '/canvas', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { label: 'Generate Image', icon: ImageIcon, href: '/images', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  { label: 'Voice Mode', icon: Mic, href: '/voice', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
]

const AI_MEMORIES = [
  { text: 'Prefers concise responses', icon: Sparkles },
  { text: 'Working on React dashboard', icon: Code2 },
  { text: 'Interested in AI research', icon: Radar },
]

const RECENT_ACTIVITY = [
  { title: 'Chat session — GPT-4o', icon: MessageSquare, time: '2 hours ago', iconColor: 'text-blue-400' },
  { title: 'Image generated — Flux 1.1', icon: ImageIcon, time: '5 hours ago', iconColor: 'text-pink-400' },
  { title: 'Document analyzed — Q3 Report.pdf', icon: FileText, time: 'Yesterday', iconColor: 'text-purple-400' },
  { title: 'Voice session — 4 mins', icon: Mic, time: 'Yesterday', iconColor: 'text-cyan-400' },
]

const PROVIDER_STATUS = [
  { name: 'Gemini', latency: '42ms' },
  { name: 'Groq', latency: '18ms' },
  { name: 'OpenAI', latency: '61ms' },
  { name: 'Cerebras', latency: '24ms' },
  { name: 'SambaNova', latency: '35ms' },
  { name: 'OpenRouter', latency: '53ms' },
]

const NEW_FEATURES = [
  {
    title: 'AI Canvas',
    description: 'Infinite collaborative canvas for visual AI workflows and brainstorming.',
    href: '/canvas',
    icon: Layers,
    gradient: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-400',
  },
  {
    title: 'AI Memory',
    description: 'Persistent cross-session context so your workspace learns from every interaction.',
    href: '/memory',
    icon: Brain,
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
  },
  {
    title: 'Document Intelligence',
    description: 'Upload PDFs, DOCX, and CSVs — extract, summarize, and query any document.',
    href: '/docs',
    icon: FileText,
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-400',
  },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning,'
  if (hour < 18) return 'Good afternoon,'
  return 'Good evening,'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function HubPage() {
  const router = useRouter()
  const [recentRoutes, setRecentRoutes] = useState<string[]>([])
  const [compactView, setCompactView] = useState(false)
  const [tightView, setTightView] = useState(false)
  const [greeting] = useState(getGreeting)
  const [dateStr] = useState(formatDate)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROUTE_HISTORY_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentRoutes(parsed.filter((route): route is string => typeof route === 'string'))
        }
      }
    } catch {
      setRecentRoutes([])
    }
  }, [])

  useEffect(() => {
    const syncCompactView = () => {
      const height = window.innerHeight
      const width = window.innerWidth
      setCompactView(height < 980 || width < 1680)
      setTightView(height < 820 || width < 1360)
    }
    syncCompactView()
    window.addEventListener('resize', syncCompactView)
    return () => window.removeEventListener('resize', syncCompactView)
  }, [])

  const displayLaunchModules = useMemo(() => {
    if (tightView) return LAUNCH_MODULES.slice(0, 6)
    if (compactView) return LAUNCH_MODULES.slice(0, 9)
    return LAUNCH_MODULES
  }, [tightView, compactView])

  const launch = (href: string) => {
    try {
      const next = [href, ...recentRoutes.filter((r) => r !== href)].slice(0, 6)
      localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(next))
      setRecentRoutes(next)
    } catch {}
    router.push(href)
  }

  const gap = tightView ? 'gap-3' : compactView ? 'gap-4' : 'gap-5'
  const space = tightView ? 'space-y-3' : compactView ? 'space-y-4' : 'space-y-6'
  const pad = tightView ? 'p-3.5' : compactView ? 'p-4' : 'p-5'

  return (
    <div className={`w-full px-4 sm:px-5 lg:px-6 xl:px-7 2xl:px-8 ${tightView ? 'pb-4 pt-2' : compactView ? 'pb-6 pt-3' : 'pb-8 pt-4'}`}>
      <div className={`w-full ${space}`}>

        {/* ── Header Row ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-text-tertiary">{greeting}</p>
            <h1 className={`mt-1 font-display leading-tight text-text-primary ${tightView ? 'text-[clamp(1.4rem,1.8vw,2rem)]' : compactView ? 'text-[clamp(1.6rem,2vw,2.3rem)]' : 'text-[clamp(1.9rem,2.4vw,2.8rem)]'}`}>
              Welcome back to <span className="text-gradient">Pyxis One</span>
            </h1>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="pill flex items-center gap-2 text-sm text-emerald-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              All systems operational
            </div>
            <p className="font-mono text-xs text-text-tertiary">{dateStr}</p>
          </div>
        </div>

        {/* ── Quick Action Row ── */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.href}
              onClick={() => launch(action.href)}
              className={`flex shrink-0 items-center gap-2.5 rounded-[20px] border px-4 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-lg ${action.bg} ${action.color}`}
            >
              <action.icon size={16} />
              {action.label}
            </button>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div className={`grid xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] ${gap}`}>

          {/* Left Column */}
          <div className={space}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-tertiary">Platform</p>
                <h2 className={`mt-1.5 font-display leading-tight text-text-primary ${tightView ? 'text-[clamp(1.25rem,1.5vw,1.7rem)]' : compactView ? 'text-[clamp(1.45rem,1.75vw,1.95rem)]' : 'text-[clamp(1.7rem,2vw,2.3rem)]'}`}>
                  Launch Surfaces
                </h2>
              </div>
              <button
                onClick={() => router.push('/tools/command-center')}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border hover:text-text-primary"
              >
                Open Command Center
                <ArrowRight size={14} />
              </button>
            </div>

            <div className={`grid gap-3 xl:grid-cols-2 2xl:grid-cols-3 ${tightView ? 'gap-2.5' : ''}`}>
              {displayLaunchModules.map((module) => (
                <button
                  key={module.href}
                  onClick={() => launch(module.href)}
                  className={`panel group rounded-[26px] text-left transition-all hover:-translate-y-1 hover:shadow-xl ${pad}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center justify-center rounded-2xl bg-surface-hover ${tightView ? 'h-9 w-9' : 'h-10 w-10'}`}>
                      <module.icon
                        size={tightView ? 15 : 18}
                        className={module.isNew ? 'text-violet-400' : 'text-accent'}
                      />
                    </div>
                    <span className={`pill text-[11px] ${module.isNew ? 'text-violet-400' : 'text-text-secondary'}`}>
                      {module.tag}
                    </span>
                  </div>
                  <h3 className={`font-display text-text-primary ${tightView ? 'mt-2.5 text-[clamp(0.95rem,1.2vw,1.2rem)]' : compactView ? 'mt-3 text-[clamp(1.1rem,1.3vw,1.4rem)]' : 'mt-4 text-[clamp(1.3rem,1.6vw,1.8rem)]'}`}>
                    {module.title}
                  </h3>
                  <p className={`text-text-secondary ${tightView ? 'mt-1 text-[11px] leading-4' : compactView ? 'mt-1.5 text-xs leading-5' : 'mt-2 text-sm leading-6'}`}>
                    {module.description}
                  </p>
                  <div className={`flex items-center justify-between ${tightView ? 'mt-2.5' : 'mt-4'}`}>
                    <span className="font-mono text-xs text-text-tertiary">{module.stat}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-text-tertiary opacity-0 transition-all group-hover:opacity-100 group-hover:text-text-primary">
                      Launch <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className={space}>

            {/* AI Memory Widget */}
            <div className={`glass-panel rounded-[26px] ${pad}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Brain size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-tertiary">Persistent</p>
                    <h3 className="font-display text-sm text-text-primary">AI Memory</h3>
                  </div>
                </div>
                <span className="pill text-[11px] text-violet-400">New ✦</span>
              </div>
              <div className="mt-4 space-y-2">
                {AI_MEMORIES.map((memory) => (
                  <div
                    key={memory.text}
                    className="flex items-center gap-3 rounded-[16px] border border-border/60 bg-surface-hover px-3.5 py-2.5"
                  >
                    <memory.icon size={14} className="shrink-0 text-violet-400" />
                    <p className="text-sm text-text-secondary">{memory.text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/memory')}
                className="mt-3 flex items-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-primary"
              >
                View all memories <ArrowRight size={12} />
              </button>
            </div>

            {/* Recent Activity */}
            <div className={`panel rounded-[26px] ${pad}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-surface-hover">
                    <Clock size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-tertiary">History</p>
                    <h3 className="font-display text-sm text-text-primary">Recent Sessions</h3>
                  </div>
                </div>
                <Activity size={16} className="text-text-tertiary" />
              </div>
              <div className="mt-4 space-y-2">
                {RECENT_ACTIVITY.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-[16px] bg-surface-hover px-3.5 py-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-bg">
                      <item.icon size={14} className={item.iconColor} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className={`glass-panel rounded-[26px] ${pad}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <Zap size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-text-tertiary">Monitoring</p>
                    <h3 className="font-display text-sm text-text-primary">Provider Status</h3>
                  </div>
                </div>
                <span className="pill text-[11px] text-emerald-400">All live</span>
              </div>
              <div className="mt-4 space-y-2">
                {PROVIDER_STATUS.map((provider) => (
                  <div
                    key={provider.name}
                    className="flex items-center justify-between rounded-[14px] bg-surface-hover px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                      <span className="text-sm text-text-primary">{provider.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-text-tertiary">{provider.latency}</span>
                      <span className="text-[11px] text-emerald-400">Operational</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Banner — New in Pyxis One ── */}
        <div className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-surface-hover to-bg p-1">
          <div className="rounded-[24px] bg-gradient-to-br from-violet-500/8 via-bg to-bg p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet-400">Just shipped</p>
                </div>
                <h2 className={`mt-2 font-display text-text-primary ${tightView ? 'text-[clamp(1.2rem,1.4vw,1.6rem)]' : compactView ? 'text-[clamp(1.35rem,1.6vw,1.8rem)]' : 'text-[clamp(1.6rem,1.9vw,2.2rem)]'}`}>
                  New in Pyxis One
                </h2>
                <p className="mt-1 text-sm text-text-secondary">Three powerful new surfaces, now live across your workspace.</p>
              </div>
              <ExternalLink size={18} className="hidden text-text-tertiary sm:block" />
            </div>

            <div className={`mt-5 grid gap-3 sm:grid-cols-3`}>
              {NEW_FEATURES.map((feature) => (
                <button
                  key={feature.href}
                  onClick={() => launch(feature.href)}
                  className={`group flex items-start gap-3 rounded-[20px] border border-border/60 bg-gradient-to-br p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border ${feature.gradient}`}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg/60">
                    <feature.icon size={18} className={feature.iconColor} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm text-text-primary">{feature.title}</p>
                    <p className="mt-1 text-xs leading-5 text-text-secondary">{feature.description}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-text-tertiary transition-colors group-hover:text-text-primary">
                      Explore <ArrowRight size={11} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
