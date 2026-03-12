'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Command,
  Globe2,
  Lock,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
  Workflow,
} from 'lucide-react'

const ROUTE_HISTORY_KEY = 'pyxis_recent_routes'

type LaunchModule = {
  title: string
  href: string
  description: string
  tag: string
  stat: string
  icon: typeof Command
}

const LAUNCH_MODULES: LaunchModule[] = [
  {
    title: 'AI Chat',
    href: '/chat',
    description: 'Run high-speed multimodel conversations with streamed responses and provider fallback.',
    tag: 'Core surface',
    stat: '4 model lanes',
    icon: Sparkles,
  },
  {
    title: 'Command Center',
    href: '/tools/command-center',
    description: 'Watch your model mesh, agent throughput, and live system events from one cockpit.',
    tag: 'Operations',
    stat: '24 live events',
    icon: Radar,
  },
  {
    title: 'Research Studio',
    href: '/tools/research',
    description: 'Run live-search research and turn sources into exportable competitive briefs.',
    tag: 'Flagship new',
    stat: 'Cited briefs',
    icon: Search,
  },
  {
    title: 'Agent Fleet',
    href: '/tools/agents',
    description: 'Deploy specialist agents across research, content, analysis, and execution workflows.',
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
    stat: 'Source-aware answers',
    icon: BrainCircuit,
  },
  {
    title: 'Code Studio',
    href: '/tools/code',
    description: 'Generate, inspect, and refine code inside the same enterprise AI workspace.',
    tag: 'Builder mode',
    stat: '50+ languages',
    icon: Wand2,
  },
]

const ENTERPRISE_SIGNALS = [
  {
    title: 'Model Mesh',
    value: 'Healthy',
    detail: 'Gemini, Groq, Together, Mistral, and OpenRouter lanes ready for routing.',
    icon: Network,
  },
  {
    title: 'Governance',
    value: 'Guarded',
    detail: 'Identity, project isolation, and token-aware APIs form the current control baseline.',
    icon: ShieldCheck,
  },
  {
    title: 'Retrieval',
    value: 'Indexed',
    detail: 'Document intelligence, search, and project memory are ready to expand into a full knowledge fabric.',
    icon: Search,
  },
  {
    title: 'Global UX',
    value: 'Immersive',
    detail: 'The upgraded shell now looks like a real AI command platform rather than a plain tool grid.',
    icon: Globe2,
  },
]

const OPS_FEED = [
  'Agent deployment lane active and ready for multi-step runbooks.',
  'Prompt, code, media, voice, and search surfaces remain available inside the same workspace shell.',
  'Firebase-backed identity and persisted user state continue to support the upgraded front-end.',
  'The platform story now aligns more closely with enterprise AI operating systems and control towers.',
]

export default function HubPage() {
  const router = useRouter()
  const [recentRoutes, setRecentRoutes] = useState<string[]>([])
  const [compactView, setCompactView] = useState(false)

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
      setCompactView(window.innerHeight < 980 || window.innerWidth < 1680)
    }

    syncCompactView()
    window.addEventListener('resize', syncCompactView)
    return () => window.removeEventListener('resize', syncCompactView)
  }, [])

  const featuredMomentum = useMemo(() => {
    const recentSet = new Set(recentRoutes)
    const recent = LAUNCH_MODULES.filter((module) => recentSet.has(module.href))
    return recent.length > 0 ? recent.slice(0, 3) : LAUNCH_MODULES.slice(0, 3)
  }, [recentRoutes])

  const displayLaunchModules = compactView ? LAUNCH_MODULES.slice(0, 6) : LAUNCH_MODULES
  const displayOpsFeed = compactView ? OPS_FEED.slice(0, 3) : OPS_FEED

  const launch = (module: LaunchModule) => {
    try {
      const next = [module.href, ...recentRoutes.filter((route) => route !== module.href)].slice(0, 6)
      localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(next))
      setRecentRoutes(next)
    } catch {}
    router.push(module.href)
  }

  return (
    <div className={`px-4 sm:px-6 lg:px-7 xl:px-8 ${compactView ? 'pb-6 pt-3' : 'pb-8 pt-4'}`}>
      <div className={`mx-auto max-w-[1720px] ${compactView ? 'space-y-4' : 'space-y-6'}`}>
        <section className="panel overflow-hidden rounded-[32px]">
          <div className={`grid xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)] 2xl:grid-cols-[minmax(0,1.26fr)_minmax(400px,0.74fr)] ${compactView ? 'gap-4 p-5 xl:p-6' : 'gap-6 p-6 xl:p-7'}`}>
            <div>
              <div className={`pill text-sm text-text-secondary ${compactView ? 'mb-4' : 'mb-5'}`}>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]" />
                Control Tower live
              </div>
              <h1 className={`font-display leading-[0.95] text-text-primary ${compactView ? 'text-[clamp(2.35rem,3.8vw,4.1rem)]' : 'text-[clamp(2.9rem,4.7vw,5rem)]'}`}>
                Welcome to the upgraded <span className="text-gradient">Pyxis One</span> workspace.
              </h1>
              <p className={`max-w-3xl text-text-secondary lg:max-w-2xl ${compactView ? 'mt-3 text-sm leading-6 sm:text-[15px] sm:leading-7' : 'mt-4 text-[15px] leading-7 sm:text-base sm:leading-8'}`}>
                This hub is now the front door to a larger AI operating system: an executive-style launch surface for chat, agents, workflows, knowledge, media, and model operations.
              </p>

              <div className={`grid gap-3 sm:grid-cols-3 ${compactView ? 'mt-4' : 'mt-6'}`}>
                {[
                  ['17+', 'Integrated AI surfaces'],
                  ['5', 'Provider lanes currently wired in'],
                  ['1', 'Unified operational shell'],
                ].map(([value, label]) => (
                  <div key={label} className={`metric-card rounded-[28px] ${compactView ? 'p-3.5' : 'p-4'}`}>
                    <p className={`font-display leading-none text-text-primary ${compactView ? 'text-[clamp(1.75rem,2.2vw,2.5rem)]' : 'text-[clamp(2rem,2.8vw,3rem)]'}`}>{value}</p>
                    <p className={`text-text-secondary ${compactView ? 'mt-1.5 text-xs leading-5 sm:text-sm' : 'mt-2 text-sm leading-6'}`}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`grid gap-3 sm:grid-cols-2 ${compactView ? 'xl:content-start' : ''}`}>
              {ENTERPRISE_SIGNALS.map((signal) => (
                <div key={signal.title} className={`glass-panel rounded-[26px] ${compactView ? 'p-3.5' : 'p-4'}`}>
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center justify-center rounded-2xl bg-white/8 ${compactView ? 'h-9 w-9' : 'h-10 w-10'}`}>
                      <signal.icon className="text-cyan-300" size={compactView ? 18 : 20} />
                    </div>
                    <span className="pill text-xs text-cyan-200">{signal.value}</span>
                  </div>
                  <p className={`font-display text-text-primary ${compactView ? 'mt-3 text-[clamp(1.3rem,1.6vw,1.7rem)]' : 'mt-4 text-[clamp(1.55rem,2vw,2rem)]'}`}>{signal.title}</p>
                  <p className={`text-text-secondary ${compactView ? 'mt-1.5 text-xs leading-5 sm:text-sm sm:leading-6' : 'mt-2 text-sm leading-6'}`}>{signal.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`grid xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] ${compactView ? 'gap-4' : 'gap-5'}`}>
          <div className={compactView ? 'space-y-4' : 'space-y-6'}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Launch surfaces</p>
                <h2 className={`mt-2 font-display leading-tight text-text-primary ${compactView ? 'text-[clamp(1.7rem,2vw,2.3rem)]' : 'text-[clamp(2rem,2.4vw,2.8rem)]'}`}>Start from the right operational lane.</h2>
              </div>
              <button
                onClick={() => router.push('/tools/command-center')}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-light hover:text-text-primary"
              >
                Open control center
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {displayLaunchModules.map((module) => (
                <button
                  key={module.href}
                  onClick={() => launch(module)}
                  className={`panel group rounded-[28px] text-left transition-transform hover:-translate-y-1 ${compactView ? 'p-4' : 'p-5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center justify-center rounded-2xl bg-white/8 ${compactView ? 'h-10 w-10' : 'h-11 w-11'}`}>
                      <module.icon className="text-cyan-300" size={compactView ? 18 : 20} />
                    </div>
                    <span className="pill text-xs text-text-secondary">{module.tag}</span>
                  </div>
                  <h3 className={`font-display text-text-primary ${compactView ? 'mt-4 text-[clamp(1.2rem,1.45vw,1.55rem)]' : 'mt-5 text-[clamp(1.45rem,1.8vw,2rem)]'}`}>{module.title}</h3>
                  <p className={`text-text-secondary ${compactView ? 'mt-2 text-xs leading-5 sm:text-sm' : 'mt-3 text-sm leading-6'}`}>{module.description}</p>
                  <div className={`flex items-center justify-between ${compactView ? 'mt-4' : 'mt-5'}`}>
                    <span className="text-sm font-semibold text-text-primary">{module.stat}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-text-tertiary transition-colors group-hover:text-text-primary">
                      Launch
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={compactView ? 'space-y-4' : 'space-y-6'}>
            <div className={`panel rounded-[28px] ${compactView ? 'p-4' : 'p-5'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Momentum</p>
                  <h2 className={`mt-2 font-display leading-tight text-text-primary ${compactView ? 'text-[clamp(1.7rem,2vw,2.2rem)]' : 'text-[clamp(2rem,2.3vw,2.7rem)]'}`}>Continue from your strongest surfaces.</h2>
                </div>
                <Activity className="text-cyan-300" size={18} />
              </div>

              <div className={compactView ? 'mt-4 space-y-2.5' : 'mt-5 space-y-3'}>
                {featuredMomentum.map((module, index) => (
                  <button
                    key={module.href}
                    onClick={() => launch(module)}
                    className={`flex w-full items-center gap-3 rounded-[20px] border border-border/80 bg-white/5 px-4 text-left transition-colors hover:bg-white/8 ${compactView ? 'py-3' : 'py-3.5'}`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-text-primary">
                      <module.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{module.title}</p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {index === 0 ? 'Recommended next action' : 'Recent high-value surface'}
                      </p>
                    </div>
                    <ArrowRight className="text-text-tertiary" size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className={`glass-panel rounded-[28px] ${compactView ? 'p-4' : 'p-5'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Ops feed</p>
                  <h3 className={`mt-2 font-display text-text-primary ${compactView ? 'text-[clamp(1.5rem,1.8vw,1.95rem)]' : 'text-[clamp(1.8rem,2vw,2.3rem)]'}`}>System narrative</h3>
                </div>
                <Lock className="text-cyan-300" size={18} />
              </div>
              <div className={compactView ? 'mt-3 space-y-2.5' : 'mt-4 space-y-3'}>
                {displayOpsFeed.map((item) => (
                  <div key={item} className={`flex gap-3 rounded-[20px] bg-white/5 px-4 ${compactView ? 'py-3' : 'py-3.5'}`}>
                    <CheckCircle2 className="mt-0.5 text-emerald-300" size={18} />
                    <p className={`text-text-secondary ${compactView ? 'text-xs leading-5 sm:text-sm sm:leading-6' : 'text-sm leading-6'}`}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
