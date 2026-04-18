'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  AudioLines,
  Bot,
  Brain,
  Code2,
  FileText,
  FlaskConical,
  Image,
  LayoutGrid,
  LineChart,
  MessagesSquare,
  Mic,
  Play,
  Search,
  Sparkles,
  Swords,
  Workflow,
  Zap,
} from 'lucide-react'
import PyxisMark from '@/components/brand/PyxisMark'
import { useAuth } from '@/contexts/AuthContext'

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '6', label: 'AI Providers' },
  { value: '15+', label: 'Tools' },
  { value: '<500ms', label: 'Response' },
  { value: '100%', label: 'Free to Start' },
]

const PROVIDERS = [
  { name: 'Gemini', dot: '#34D399' },
  { name: 'OpenAI', dot: '#818CF8' },
  { name: 'Groq', dot: '#F472B6' },
  { name: 'Cerebras', dot: '#FB923C' },
  { name: 'SambaNova', dot: '#60A5FA' },
  { name: 'OpenRouter', dot: '#A78BFA' },
]

const BENTO_FEATURES = [
  {
    title: 'AI Chat',
    description: 'Multi-model streaming chat with 6 providers, auto-fallback routing, and voice input. Switch models mid-conversation.',
    icon: MessagesSquare,
    color: '#60A5FA',
    span: 'lg:col-span-2',
    badge: null,
  },
  {
    title: 'AI Canvas',
    description: 'Visual drag-and-drop workflow builder for chaining AI tools, models, and data flows together.',
    icon: LayoutGrid,
    color: '#A78BFA',
    span: '',
    badge: 'NEW ✦',
  },
  {
    title: 'AI Memory',
    description: 'Persistent memory across all sessions. Pyxis learns your preferences and context automatically.',
    icon: Brain,
    color: '#34D399',
    span: '',
    badge: 'NEW ✦',
  },
  {
    title: 'Document Intelligence',
    description: 'Upload PDF, DOCX, or Excel files and have a full AI conversation with your documents instantly.',
    icon: FileText,
    color: '#FB923C',
    span: 'lg:col-span-2',
    badge: 'NEW ✦',
  },
  {
    title: 'Image Studio',
    description: 'Generate stunning visuals with DALL-E 3, FLUX, and Stable Diffusion from one unified interface.',
    icon: Image,
    color: '#F472B6',
    span: '',
    badge: null,
  },
  {
    title: 'Voice AI',
    description: 'Speak to any model with real-time transcription and natural voice responses.',
    icon: Mic,
    color: '#34D399',
    span: '',
    badge: null,
  },
  {
    title: 'Research Studio',
    description: 'Live web search distilled into cited, structured research briefs in seconds.',
    icon: Search,
    color: '#60A5FA',
    span: '',
    badge: null,
  },
  {
    title: 'Code Studio',
    description: 'Generate, execute, and debug code across 50+ languages with AI-powered explanations.',
    icon: Code2,
    color: '#818CF8',
    span: '',
    badge: null,
  },
  {
    title: 'Agent Fleet',
    description: '12+ specialist AI agents for research, code, content, and analysis — running in parallel.',
    icon: Bot,
    color: '#F472B6',
    span: '',
    badge: null,
  },
  {
    title: 'Workflow Builder',
    description: 'Chain models and tools into automated runbooks with triggers, branching logic, and retries.',
    icon: Workflow,
    color: '#FB923C',
    span: '',
    badge: null,
  },
  {
    title: 'Knowledge Mesh',
    description: 'Ground every AI response in your documents, project context, and structured data.',
    icon: FlaskConical,
    color: '#A78BFA',
    span: '',
    badge: null,
  },
  {
    title: 'Model Arena',
    description: 'Compare 4 AI models side-by-side simultaneously on any prompt you choose.',
    icon: Swords,
    color: '#60A5FA',
    span: '',
    badge: null,
  },
  {
    title: 'Analytics',
    description: 'Token usage, cost tracking, latency histograms, and provider health — all in one dashboard.',
    icon: LineChart,
    color: '#34D399',
    span: '',
    badge: null,
  },
]

const HOW_STEPS = [
  {
    number: '01',
    title: 'Sign in free',
    description: 'Firebase auth in seconds. No credit card, no setup wizard, no waiting.',
    icon: Zap,
  },
  {
    number: '02',
    title: 'Pick your tool',
    description: '15+ AI surfaces in one workspace — chat, research, code, voice, images, and more.',
    icon: LayoutGrid,
  },
  {
    number: '03',
    title: 'Ship faster',
    description: 'AI-powered results stream back in under 500ms. Build what used to take hours.',
    icon: ArrowRight,
  },
]

const NEW_FEATURES = [
  {
    icon: LayoutGrid,
    color: '#A78BFA',
    tag: 'NEW ✦',
    title: 'AI Canvas',
    description: 'Build visual AI workflows by connecting tools, models, and data flows on an infinite canvas. No code required.',
    detail: 'Drag. Connect. Deploy.',
  },
  {
    icon: Brain,
    color: '#34D399',
    tag: 'NEW ✦',
    title: 'AI Memory',
    description: 'Pyxis remembers your preferences, past work, and context across every session — getting smarter the more you use it.',
    detail: 'Persistent. Private. Personal.',
  },
  {
    icon: FileText,
    color: '#FB923C',
    tag: 'NEW ✦',
    title: 'Document Intelligence',
    description: 'Upload any document — PDF, DOCX, Excel — and have a full natural language conversation with your data.',
    detail: 'Any format. Any length.',
  },
]

// ─── Chat Mockup ──────────────────────────────────────────────────────────────

function ChatMockup() {
  return (
    <div
      className="panel relative overflow-hidden rounded-[28px]"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))' }}
    >
      {/* shimmer top line */}
      <div className="absolute inset-x-0 top-0 h-px shimmer-line" />

      {/* header */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <PyxisMark size={28} />
          <span className="font-display text-sm text-text-primary">AI Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {[
            { label: 'Gemini', color: '#34D399' },
            { label: 'GPT-4o', color: '#818CF8' },
            { label: 'Llama', color: '#F472B6' },
          ].map((m) => (
            <span
              key={m.label}
              className="flex items-center gap-1.5 rounded-full border border-border/80 px-2.5 py-1 text-[10px] font-medium text-text-secondary"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* messages */}
      <div className="space-y-4 px-5 py-5">
        {/* user message */}
        <div className="flex justify-end">
          <div
            className="max-w-[80%] rounded-2xl px-4 py-3 text-sm text-text-primary"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Summarize the Q3 report and flag any risks
          </div>
        </div>

        {/* assistant message */}
        <div className="flex gap-3">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #60D3FF, #6E66FF)' }}
          >
            <Sparkles size={12} color="white" />
          </div>
          <div
            className="flex-1 rounded-2xl px-4 py-3 text-sm leading-relaxed text-text-secondary"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="mb-2 text-text-primary font-medium">Q3 Executive Summary</p>
            <p>Revenue grew <span className="text-emerald-400 font-semibold">+24% YoY</span> to $4.2M. Gross margin held at 68%.</p>
            <p className="mt-1.5">⚠️ <span className="text-amber-400">Customer churn</span> ticked up 3pts in enterprise segment — watch retention.</p>
          </div>
        </div>

        {/* typing indicator */}
        <div className="flex gap-3">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #34D399, #818CF8)' }}
          >
            <AudioLines size={12} color="white" />
          </div>
          <div
            className="flex items-center gap-1 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span
              className="typing-dot"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="typing-dot"
              style={{ animationDelay: '160ms' }}
            />
            <span
              className="typing-dot"
              style={{ animationDelay: '320ms' }}
            />
          </div>
        </div>
      </div>

      {/* input */}
      <div className="border-t border-border/60 px-5 py-4">
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="flex-1 text-sm text-text-tertiary">Ask anything across 6 AI models…</span>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(91,140,255,0.3)' }}
          >
            <ArrowRight size={13} color="#5B8CFF" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bento Card ───────────────────────────────────────────────────────────────

function BentoCard({
  feature,
}: {
  feature: (typeof BENTO_FEATURES)[number]
}) {
  const Icon = feature.icon
  return (
    <div
      className={`group relative overflow-hidden rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-1 ${feature.span}`}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-[20px]"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${feature.color}12, transparent 60%)`,
          border: `1px solid ${feature.color}25`,
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${feature.color}18`, border: `1px solid ${feature.color}30` }}
          >
            <Icon size={18} color={feature.color} />
          </div>
          {feature.badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider"
              style={{
                background: 'rgba(167,139,250,0.15)',
                border: '1px solid rgba(167,139,250,0.35)',
                color: '#C4B5FD',
              }}
            >
              {feature.badge}
            </span>
          )}
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-text-primary">{feature.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{feature.description}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/hub')
  }, [loading, router, user])

  if (loading || user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-bg">
        <div className="panel flex items-center gap-4 rounded-3xl px-6 py-5">
          <PyxisMark size={46} />
          <div>
            <p className="font-display text-lg text-text-primary">Pyxis One</p>
            <p className="text-sm text-text-tertiary">Launching your workspace…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-bg text-text-primary">
      <div className="hero-noise">

        {/* ── Sticky Nav ─────────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <PyxisMark size={36} />
              <div>
                <p className="font-display text-base leading-tight text-text-primary">Pyxis One</p>
                <p className="text-[10px] text-text-tertiary tracking-wider uppercase">AI Operating System</p>
              </div>
            </div>

            {/* Nav links */}
            <div className="hidden items-center gap-6 md:flex">
              <a href="#features" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                Platform
              </a>
              <a href="#new-features" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                What&apos;s New
              </a>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="hidden rounded-full border border-border/80 px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border hover:text-text-primary md:block"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:scale-[1.02]"
              >
                Get Started
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
          {/* grid background */}
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />

          {/* radial accent glows */}
          <div
            className="pointer-events-none absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(91,140,255,0.6), transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -right-64 top-0 h-[500px] w-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.5), transparent 70%)' }}
          />

          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Left copy */}
            <div>
              {/* Badge */}
              <div
                className="mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-text-secondary"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.3)',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full bg-violet-400"
                  style={{ animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 12px rgba(167,139,250,0.8)' }}
                />
                Now with AI Memory + Canvas Builder
              </div>

              {/* H1 */}
              <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.04em] text-text-primary sm:text-6xl lg:text-7xl">
                The AI Operating{' '}
                <br className="hidden sm:block" />
                System for{' '}
                <span className="text-gradient">Modern Teams</span>
              </h1>

              {/* Subtext */}
              <p className="mt-6 max-w-lg text-lg leading-8 text-text-secondary">
                One workspace for chat, research, code, voice, images, and workflows — powered by 6 AI providers with smart auto-routing and persistent memory.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-accent-hover hover:scale-[1.02]"
                  style={{ boxShadow: '0 8px 32px rgba(91,140,255,0.35)' }}
                >
                  Launch Workspace
                  <ArrowRight size={15} />
                </Link>
                <a
                  href="#features"
                  className="flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                >
                  <Play size={14} />
                  Watch Demo
                </a>
              </div>

              {/* Stat pills */}
              <div className="mt-8 flex flex-wrap gap-3">
                {STATS.map((s, i) => (
                  <div
                    key={s.label}
                    className="metric-card flex items-center gap-2 rounded-full px-4 py-2"
                    style={{
                      animationDelay: `${i * 80}ms`,
                    }}
                  >
                    <span className="font-display text-base font-semibold text-text-primary">{s.value}</span>
                    <span className="text-sm text-text-tertiary">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Chat Mockup */}
            <div className="relative">
              <ChatMockup />
              {/* floating accent card */}
              <div
                className="absolute -bottom-4 -left-6 hidden rounded-2xl px-4 py-3 lg:block"
                style={{
                  background: 'rgba(52,211,153,0.1)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <p className="text-xs font-semibold text-emerald-400">Auto-routed to Gemini Flash</p>
                <p className="text-[10px] text-text-tertiary">244ms · Best latency match</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Powered By Strip ──────────────────────────────────────── */}
        <div className="border-y border-border/50 bg-surface-muted/30">
          <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary">Powered by</span>
              {PROVIDERS.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.dot, boxShadow: `0 0 8px ${p.dot}80` }} />
                  <span className="font-display text-sm font-medium text-text-secondary">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Features Bento Grid ───────────────────────────────────── */}
        <section id="features" className="py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            {/* Section header */}
            <div className="mb-14 max-w-2xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-text-tertiary">Everything in one place</p>
              <h2 className="font-display text-4xl leading-tight tracking-[-0.03em] text-text-primary sm:text-5xl">
                Everything you need.{' '}
                <span className="text-gradient">Nothing you don&apos;t.</span>
              </h2>
              <p className="mt-4 text-lg leading-8 text-text-secondary">
                15+ AI-native tools in one unified workspace. No tab switching, no API juggling, no context lost.
              </p>
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENTO_FEATURES.map((feature) => (
                <BentoCard key={feature.title} feature={feature} />
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────── */}
        <section id="how-it-works" className="border-t border-border/50 py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-14 text-center">
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-text-tertiary">Simple by design</p>
              <h2 className="font-display text-4xl tracking-[-0.03em] text-text-primary sm:text-5xl">
                Up and running in{' '}
                <span className="text-gradient">10 seconds</span>
              </h2>
            </div>

            <div className="relative grid gap-8 lg:grid-cols-3">
              {/* connector lines */}
              <div className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px lg:block"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(91,140,255,0.3) 30%, rgba(91,140,255,0.3) 70%, transparent)' }}
              />

              {HOW_STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.number}
                    className="relative flex flex-col items-center text-center"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    {/* Step number circle */}
                    <div
                      className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
                      style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
                      }}
                    >
                      <Icon size={28} color="#5B8CFF" />
                      <span
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #5B8CFF, #818CF8)' }}
                      >
                        {step.number.replace('0', '')}
                      </span>
                    </div>
                    <h3 className="font-display text-xl text-text-primary">{step.title}</h3>
                    <p className="mt-3 max-w-xs text-sm leading-7 text-text-secondary">{step.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── New Features Spotlight ────────────────────────────────── */}
        <section id="new-features" className="border-t border-border/50 py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-14">
              <div
                className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wider"
                style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#C4B5FD' }}
              >
                ✦ JUST LAUNCHED
              </div>
              <h2 className="font-display text-4xl tracking-[-0.03em] text-text-primary sm:text-5xl">
                Built for the{' '}
                <span className="text-gradient">AI-native era</span>
              </h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-text-secondary">
                Three flagship capabilities that set Pyxis One apart from every other AI tool.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {NEW_FEATURES.map((feat) => {
                const Icon = feat.icon
                return (
                  <div
                    key={feat.title}
                    className="group relative overflow-hidden rounded-[24px] p-7 transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
                    }}
                  >
                    {/* glow on hover */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: `radial-gradient(circle at 50% 0%, ${feat.color}15, transparent 60%)` }}
                    />
                    {/* top accent line */}
                    <div
                      className="absolute inset-x-0 top-0 h-px"
                      style={{ background: `linear-gradient(90deg, transparent, ${feat.color}60, transparent)` }}
                    />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl"
                          style={{ background: `${feat.color}18`, border: `1px solid ${feat.color}35` }}
                        >
                          <Icon size={22} color={feat.color} />
                        </div>
                        <span
                          className="rounded-full px-2.5 py-1 text-[9px] font-bold tracking-widest"
                          style={{
                            background: `${feat.color}15`,
                            border: `1px solid ${feat.color}35`,
                            color: feat.color,
                          }}
                        >
                          {feat.tag}
                        </span>
                      </div>

                      <h3 className="mt-5 font-display text-2xl text-text-primary">{feat.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-text-secondary">{feat.description}</p>

                      <div
                        className="mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{ background: `${feat.color}12`, color: feat.color }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: feat.color, boxShadow: `0 0 6px ${feat.color}` }}
                        />
                        {feat.detail}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── CTA Section ───────────────────────────────────────────── */}
        <section className="px-5 pb-24 sm:px-8">
          <div className="mx-auto max-w-4xl">
            <div
              className="relative overflow-hidden rounded-[32px] px-10 py-14 text-center"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                border: '1px solid rgba(91,140,255,0.3)',
                boxShadow: '0 0 80px rgba(91,140,255,0.12), 0 32px 64px rgba(0,0,0,0.4)',
              }}
            >
              {/* top shimmer */}
              <div className="absolute inset-x-0 top-0 h-px shimmer-line" />

              {/* background glow */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(91,140,255,0.12), transparent 60%)' }}
              />

              <div className="relative">
                <div
                  className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wider"
                  style={{ background: 'rgba(91,140,255,0.12)', border: '1px solid rgba(91,140,255,0.3)', color: '#93B4FF' }}
                >
                  <Sparkles size={11} />
                  100% Free to Start
                </div>

                <h2 className="font-display text-4xl leading-tight tracking-[-0.03em] text-text-primary sm:text-5xl">
                  Ready to build with AI?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-lg leading-8 text-text-secondary">
                  Join thousands of teams who ship faster with Pyxis One. Every tool. Every model. One workspace.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-accent-hover hover:scale-[1.02]"
                    style={{ boxShadow: '0 8px 32px rgba(91,140,255,0.4)' }}
                  >
                    Launch Workspace
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <p className="mt-4 text-sm text-text-tertiary">
                  No credit card. No setup. Start in 10 seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="border-t border-border/50 pb-10 pt-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <PyxisMark size={32} />
                <div>
                  <p className="font-display text-sm text-text-primary">Pyxis One</p>
                  <p className="text-[10px] text-text-tertiary">AI Operating System</p>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-tertiary">
                <a href="#features" className="transition-colors hover:text-text-secondary">Features</a>
                <a href="#how-it-works" className="transition-colors hover:text-text-secondary">Platform</a>
                <a href="#new-features" className="transition-colors hover:text-text-secondary">What&apos;s New</a>
                <Link href="/login" className="transition-colors hover:text-text-secondary">Sign in</Link>
                <Link href="/login" className="transition-colors hover:text-text-secondary">Get Started</Link>
              </div>

              {/* Copyright */}
              <p className="text-xs text-text-tertiary">
                © 2026 Pyxis One. Built for the AI-native era.
              </p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
