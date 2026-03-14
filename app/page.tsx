'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  BrainCircuit,
  Globe2,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import PyxisMark from '@/components/brand/PyxisMark'
import { useAuth } from '@/contexts/AuthContext'

const STATS = [
  { value: '42%', label: 'Faster decisions', detail: 'by routing work to the best agent automatically' },
  { value: '11x', label: 'Operational leverage', detail: 'through reusable workflows and copilots' },
  { value: '<500ms', label: 'First-token target', detail: 'with streaming and multi-model failover' },
  { value: '99.95%', label: 'Enterprise uptime goal', detail: 'designed for global resiliency and control' },
]

const PLATFORM_PILLARS = [
  {
    title: 'Autonomous Intelligence Layer',
    description: 'Agents, copilots, and policy-aware automations that move from answering questions to doing real work.',
    icon: Bot,
  },
  {
    title: 'Knowledge Graph Memory',
    description: 'A unified enterprise memory fabric spanning documents, conversations, decisions, and workflows.',
    icon: BrainCircuit,
  },
  {
    title: 'Trust and Governance',
    description: 'Role-based access, auditability, provider routing, and zero-trust patterns built directly into the core.',
    icon: ShieldCheck,
  },
]

const MODULES = [
  {
    title: 'Control Tower',
    description: 'Monitor models, workflows, usage, and quality signals in one operational nerve center.',
    href: '/tools/command-center',
    tag: 'Executive visibility',
  },
  {
    title: 'Agent Fleet',
    description: 'Launch domain-specialized agents for research, analysis, code, legal review, and content ops.',
    href: '/tools/agents',
    tag: 'Autonomous execution',
  },
  {
    title: 'Knowledge Mesh',
    description: 'Search, summarize, and reason across project files, documents, and structured context.',
    href: '/tools/rag',
    tag: 'Enterprise memory',
  },
  {
    title: 'Workflow Graph',
    description: 'Build trigger-to-action AI systems with approvals, retries, branching logic, and orchestration.',
    href: '/tools/workflow',
    tag: 'Operational automation',
  },
  {
    title: 'Research Studio',
    description: 'Turn live search signals into competitive briefs, product memos, and strategy-ready outputs.',
    href: '/tools/research',
    tag: 'New flagship',
  },
]

const SIGNALS = [
  'Provider mesh online: Gemini, OpenRouter, Together, Mistral, Groq',
  'Policy engine enforcing tenant rules, tool scopes, and fallback budgets',
  'Real-time command surfaces for chat, voice, code, image, and video generation',
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/hub')
  }, [loading, router, user])

  if (loading || user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg">
        <div className="panel flex items-center gap-4 rounded-3xl px-6 py-5">
          <PyxisMark size={46} />
          <div>
            <p className="font-display text-lg text-text-primary">Booting Pyxis One</p>
            <p className="text-sm text-text-tertiary">Provisioning your control plane</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-bg text-text-primary">
      <div className="hero-noise">
        <nav className="sticky top-0 z-50 border-b border-border/70 bg-bg/70 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <PyxisMark size={40} />
              <div>
                <p className="font-display text-lg leading-none">Pyxis One</p>
                <p className="text-xs text-text-tertiary">AI Operating System</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <a href="#platform" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                Platform
              </a>
              <a href="#advantage" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                Advantage
              </a>
              <Link href="/login" className="rounded-full border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-light hover:text-text-primary">
                Sign in
              </Link>
              <Link href="/login" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]">
                Enter Pyxis
              </Link>
            </div>
          </div>
        </nav>

        <section className="relative overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-40" />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pb-24 lg:pt-20">
            <div>
              <div className="pill mb-6 text-sm text-text-secondary">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.8)]" />
                Enterprise-grade AI orchestration for search, workflow, media, code, and decisioning
              </div>

              <h1 className="font-display text-4xl leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                Bring search, copilots, workflows, and memory into one <span className="text-gradient">AI workspace</span>.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-text-secondary sm:text-[19px]">
                Pyxis One turns scattered AI tools into one calmer, more capable product surface for teams:
                chat, research, code, voice, workflows, knowledge, governance, and provider routing in the same workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-accent-hover"
                >
                  Launch Control Tower
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#platform"
                  className="inline-flex items-center gap-2 rounded-full border border-border-light px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                >
                  Explore the platform
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="metric-card rounded-3xl p-4">
                    <p className="font-display text-3xl text-text-primary">{stat.value}</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{stat.label}</p>
                    <p className="mt-2 text-xs leading-5 text-text-tertiary">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="panel relative overflow-hidden rounded-[32px] p-6 sm:p-8">
                <div className="absolute inset-x-0 top-0 h-px shimmer-line" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-text-tertiary">Live orchestration</p>
                    <h2 className="font-display text-2xl text-text-primary">Executive Control Plane</h2>
                  </div>
                  <div className="pill text-xs text-emerald-300">
                    <Activity size={14} />
                    All systems live
                  </div>
                </div>

                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="glass-panel rounded-3xl p-5">
                    <div className="flex items-center justify-between text-sm text-text-secondary">
                      <span>Agent fleet status</span>
                      <span className="font-medium text-emerald-300">24 active</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {['Research council', 'Revenue copilot', 'Security sentinel'].map((agent, index) => (
                        <div key={agent} className="flex items-center justify-between rounded-2xl bg-surface-hover px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{agent}</p>
                            <p className="text-xs text-text-tertiary">Runbook {index + 1} online</p>
                          </div>
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel rounded-3xl p-5">
                    <div className="flex items-center justify-between text-sm text-text-secondary">
                      <span>Model router</span>
                      <span className="font-medium text-cyan-300">Latency aware</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ['Gemini 2.5 Flash', '244ms'],
                        ['Llama 3.3 70B', '612ms'],
                        ['Mistral Small', '318ms'],
                      ].map(([model, latency]) => (
                        <div key={model} className="rounded-2xl border border-border/80 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-text-primary">{model}</p>
                            <p className="text-xs text-text-tertiary">{latency}</p>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-active">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-300" style={{ width: latency === '244ms' ? '82%' : latency === '318ms' ? '68%' : '54%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-border/80 bg-surface-muted p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Enterprise command stream</p>
                      <p className="text-xs text-text-tertiary">Signals from governance, routing, and workflow execution</p>
                    </div>
                    <Radar className="text-cyan-300" size={18} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {SIGNALS.map((signal) => (
                      <div key={signal} className="flex items-start gap-3 rounded-2xl bg-surface-hover px-4 py-3">
                        <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                        <p className="text-sm leading-6 text-text-secondary">{signal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="border-y border-border/70 bg-surface-muted/40">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Platform Surface</p>
                <h2 className="font-display text-4xl text-text-primary sm:text-5xl">A single operating layer for AI-native organizations.</h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-text-secondary">
                Instead of stitching together chat apps, tools, prompt vaults, workflow builders, and analytics dashboards, Pyxis One unifies the entire system into one extensible control plane.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {MODULES.map((module) => (
                <Link
                  key={module.title}
                  href={module.href}
                  className="panel group rounded-[28px] p-6 transition-transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="pill text-xs text-cyan-200">{module.tag}</span>
                    <ArrowRight className="text-text-tertiary transition-transform group-hover:translate-x-1 group-hover:text-text-primary" size={18} />
                  </div>
                  <h3 className="mt-6 font-display text-2xl text-text-primary">{module.title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-text-secondary">{module.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="advantage">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="grid gap-5 lg:grid-cols-3">
              {PLATFORM_PILLARS.map((pillar) => (
                <div key={pillar.title} className="glass-panel rounded-[28px] p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-active">
                    <pillar.icon className="text-cyan-300" size={22} />
                  </div>
                  <h3 className="mt-5 font-display text-2xl text-text-primary">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">{pillar.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 panel rounded-[32px] p-8">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Built to sell upward</p>
                  <h2 className="mt-3 font-display text-4xl text-text-primary">Impressive enough for a founder demo. Structured enough for an enterprise RFP.</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Global readiness', 'Multi-provider routing, async workflows, and command surfaces built for scale.'],
                    ['Security posture', 'Authentication, access control, governance, and data isolation patterns ready to harden.'],
                    ['AI-native UX', 'Command-first navigation, adaptive workspaces, and high-density operational dashboards.'],
                    ['Expansion path', 'Marketplace, plugins, APIs, analytics, and multi-tenant control foundations.'],
                  ].map(([title, description]) => (
                    <div key={title} className="rounded-[24px] border border-border/80 bg-surface-hover p-5">
                      <p className="font-semibold text-text-primary">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8">
          <div className="mx-auto max-w-7xl rounded-[36px] border border-border/80 bg-gradient-to-r from-cyan-400/10 via-indigo-500/10 to-emerald-400/10 px-8 py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-text-tertiary">Start the upgrade</p>
                <h2 className="mt-3 font-display text-4xl text-text-primary">Your existing Pyxis stack now has a stronger flagship surface and a bigger product story.</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover">
                  Enter the workspace
                  <ArrowRight size={16} />
                </Link>
                <Link href="/tools/command-center" className="inline-flex items-center gap-2 rounded-full border border-border-light px-6 py-3 text-sm font-semibold text-text-primary">
                  View the control center
                  <Sparkles size={16} />
                </Link>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-text-secondary">
              <span className="pill"><Boxes size={14} /> Modular architecture</span>
              <span className="pill"><Radar size={14} /> Deep research studio</span>
              <span className="pill"><Workflow size={14} /> Workflow automation</span>
              <span className="pill"><Globe2 size={14} /> Global-ready platform</span>
              <span className="pill"><Lock size={14} /> Secure by design</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
