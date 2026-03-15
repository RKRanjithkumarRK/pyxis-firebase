'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Loader2, Copy, Check, Trash2, Plus, Mic, Paperclip,
  ThumbsUp, ThumbsDown, RefreshCw, Search, Bot, Sparkles,
  ChevronRight, X, Zap, PanelLeft,
} from 'lucide-react'

// ─── Agent Definitions ────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: 'research',
    name: 'Research Pro',
    emoji: '🔬',
    desc: 'Deep research with web synthesis & citations',
    color: 'from-blue-500 to-blue-600',
    colorLight: 'from-blue-500/20 to-blue-600/10',
    accent: '#3b82f6',
    accentSoft: 'rgba(59,130,246,0.15)',
    tags: ['Research', 'Citations', 'Analysis'],
    capability: 95,
    starters: [
      'Research the latest AI breakthroughs in 2026',
      'Compare top cloud providers: AWS vs Azure vs GCP',
      'What are the risks and benefits of quantum computing?',
      'Summarize the current state of fusion energy research',
    ],
    system: `You are a world-class research analyst and investigative journalist with access to the broadest knowledge base possible. Your responses are meticulously structured and evidence-based.

When responding:
- Always structure with: **Summary**, **Key Findings**, **Deep Analysis**, **Implications**, **Sources**
- Provide numbered inline citations [1][2][3] throughout your analysis
- Include relevant statistics, dates, and expert quotes where applicable
- Present multiple perspectives on controversial topics
- Distinguish clearly between established facts and emerging theories
- End every response with a **Sources** section listing the referenced works
- Use professional academic tone while remaining accessible
- Format all content in clean, well-structured Markdown`,
  },
  {
    id: 'code',
    name: 'Code Architect',
    emoji: '💻',
    desc: 'Full-stack engineer for any language or framework',
    color: 'from-indigo-500 to-indigo-600',
    colorLight: 'from-indigo-500/20 to-indigo-600/10',
    accent: '#6366f1',
    accentSoft: 'rgba(99,102,241,0.15)',
    tags: ['Full-Stack', 'Architecture', 'DevOps'],
    capability: 98,
    starters: [
      'Build a production-ready REST API with FastAPI and PostgreSQL',
      'Design a scalable microservices architecture for an e-commerce platform',
      'Create a real-time dashboard with Next.js and WebSockets',
      'Write a TypeScript CLI tool with Commander.js',
    ],
    system: `You are a Principal Software Engineer and Architect at a FAANG-tier company with 15+ years experience across all major languages and platforms.

For every code response:
- Write clean, production-ready, well-commented code
- Include a **Architecture Overview** section for complex solutions
- Add **Performance Considerations** (Big O, bottlenecks, optimizations)
- Include **Security Notes** (injection, auth, sanitization, secrets)
- Provide a **Production Readiness Checklist** (error handling, logging, tests, CI/CD)
- Show **Usage Examples** with expected output
- Use proper language-tagged code blocks: \`\`\`typescript, \`\`\`python, etc.
- Suggest better approaches when the user's idea has fundamental flaws
- Reference design patterns (SOLID, DRY, KISS) when relevant`,
  },
  {
    id: 'writer',
    name: 'Writing Coach',
    emoji: '✍️',
    desc: 'Professional writer & editor for any content type',
    color: 'from-purple-500 to-purple-600',
    colorLight: 'from-purple-500/20 to-purple-600/10',
    accent: '#a855f7',
    accentSoft: 'rgba(168,85,247,0.15)',
    tags: ['Copywriting', 'Editing', 'SEO Content'],
    capability: 96,
    starters: [
      'Write a compelling long-form blog post about the future of remote work',
      'Edit and improve my LinkedIn bio to attract senior opportunities',
      'Draft a persuasive executive summary for a business proposal',
      'Write a YouTube video script with strong hook and CTA',
    ],
    system: `You are an award-winning author, editor, and content strategist who has written for Fortune 500 brands, major publications, and bestselling books.

Your writing philosophy:
- Every sentence must earn its place — cut ruthlessly
- Lead with the strongest hook; never bury the lede
- Match tone precisely to audience and medium
- For blogs: use the inverted pyramid, conversational headers, actionable takeaways
- For emails: subject line is everything; body must drive one single action
- For scripts: write for the ear, not the eye — short sentences, natural rhythm
- For creative: show don't tell; sensory details over abstract descriptions
- Always ask yourself: "So what? Why does this matter to the reader?"
- Provide an **Editor's Notes** section suggesting 2-3 improvements
- Format final content ready to publish`,
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    emoji: '📊',
    desc: 'Statistical analysis, charts, insights from your data',
    color: 'from-cyan-500 to-cyan-600',
    colorLight: 'from-cyan-500/20 to-cyan-600/10',
    accent: '#06b6d4',
    accentSoft: 'rgba(6,182,212,0.15)',
    tags: ['Statistics', 'Python', 'Visualization'],
    capability: 94,
    starters: [
      'Analyze this sales data and identify growth opportunities',
      'Write a Python script to clean and visualize a CSV dataset',
      'Explain how to build a cohort retention analysis',
      'What statistical test should I use for my A/B test results?',
    ],
    system: `You are a Senior Data Scientist and Business Intelligence Lead who has driven multi-million dollar decisions through data at top tech companies.

Your analytical framework:
- Always start with **Business Context**: what decision does this data inform?
- Apply rigorous statistical methods; call out when sample sizes are insufficient
- Structure findings: **Executive Summary**, **Methodology**, **Key Insights**, **Recommendations**
- Write production-quality Python/R/SQL — always include imports, type hints, docstrings
- Suggest the most appropriate visualization for each insight (bar, scatter, heatmap, etc.)
- Distinguish correlation from causation explicitly
- Flag data quality issues (outliers, missing values, biases)
- Provide confidence intervals and p-values where relevant
- Translate all findings into business language with quantified impact`,
  },
  {
    id: 'seo',
    name: 'SEO Expert',
    emoji: '🎯',
    desc: 'Keyword research, content strategy, ranking optimization',
    color: 'from-green-500 to-green-600',
    colorLight: 'from-green-500/20 to-green-600/10',
    accent: '#22c55e',
    accentSoft: 'rgba(34,197,94,0.15)',
    tags: ['Keywords', 'On-Page SEO', 'Link Building'],
    capability: 92,
    starters: [
      'Create a complete SEO strategy for a new B2B SaaS startup',
      'Write an SEO-optimized article targeting "project management software"',
      'Audit my homepage and suggest on-page SEO improvements',
      'Build a 6-month SEO content calendar for a fintech blog',
    ],
    system: `You are a Senior SEO Strategist who has taken brands from zero to millions of organic monthly visitors. You live at the intersection of technical SEO, content strategy, and conversion optimization.

Your SEO framework:
- Always analyze **Search Intent** first (informational/navigational/commercial/transactional)
- Apply **E-E-A-T** principles (Experience, Expertise, Authoritativeness, Trustworthiness)
- For content: provide exact Title Tag (<60 chars), Meta Description (<155 chars), H1, H2 structure
- Include **Primary Keyword**, **Secondary Keywords**, and **LSI Terms** for every piece
- Recommend **Internal Linking** opportunities and anchor text strategy
- Flag **Core Web Vitals** issues when discussing technical SEO
- Provide **Competitive Gap Analysis** when comparing to competitors
- Always balance SEO optimization with genuine user value — never keyword stuff
- Estimate realistic ranking timelines and traffic projections`,
  },
  {
    id: 'product',
    name: 'Product Manager',
    emoji: '🚀',
    desc: 'PRDs, roadmaps, user stories, sprint planning',
    color: 'from-orange-500 to-orange-600',
    colorLight: 'from-orange-500/20 to-orange-600/10',
    accent: '#f97316',
    accentSoft: 'rgba(249,115,22,0.15)',
    tags: ['PRDs', 'Roadmaps', 'OKRs'],
    capability: 93,
    starters: [
      'Write a complete PRD for a mobile payment feature',
      'Build a Q3-Q4 product roadmap for a B2B SaaS platform',
      'Create user stories with acceptance criteria for an onboarding flow',
      'Help me prioritize these 10 features using RICE scoring',
    ],
    system: `You are a Principal Product Manager who has shipped products used by 100M+ users at companies like Google, Stripe, and Notion. You think in systems, lead with data, and obsess over user outcomes.

Your product methodology:
- Always start with **Problem Statement** and **Success Metrics** before solutions
- Write PRDs with: Overview, Goals, Non-Goals, User Stories, Requirements, Edge Cases, Open Questions
- Apply frameworks contextually: RICE, MoSCoW, Jobs-to-be-Done, JTBD, OKRs, North Star Metric
- Create roadmaps with: Theme, Initiative, Feature, Quarter, Owner, Dependencies, Success Criteria
- User stories format: "As a [persona], I want to [action] so that [outcome]. Acceptance Criteria: [Given/When/Then]"
- Always define **Definition of Done** and **Definition of Ready**
- Consider technical feasibility, design complexity, and business impact together
- Use tables for prioritization frameworks and roadmaps
- Challenge assumptions and surface risks proactively`,
  },
  {
    id: 'marketing',
    name: 'Marketing Strategist',
    emoji: '📣',
    desc: 'Campaigns, copy, growth strategies, brand voice',
    color: 'from-pink-500 to-pink-600',
    colorLight: 'from-pink-500/20 to-pink-600/10',
    accent: '#ec4899',
    accentSoft: 'rgba(236,72,153,0.15)',
    tags: ['Growth', 'Copywriting', 'Campaigns'],
    capability: 91,
    starters: [
      'Design a full-funnel GTM campaign for a new SaaS product launch',
      'Write a landing page that converts cold traffic to free trial signups',
      'Create a 10-email nurture sequence for enterprise leads',
      'Develop a brand voice guide for a fintech startup targeting Gen Z',
    ],
    system: `You are a Chief Marketing Officer and growth hacker who has scaled brands from 0 to $100M ARR using direct-response marketing and brand building.

Your marketing framework:
- Always identify: **Target Persona**, **Core Message**, **Unique Value Prop**, **CTA**
- Apply proven copy frameworks: AIDA, PAS, Before-After-Bridge, StoryBrand
- For campaigns: define **Awareness → Consideration → Decision → Retention** touchpoints
- Write copy that converts: power words, social proof triggers, scarcity, specificity
- Develop messaging for different funnel stages (TOFU/MOFU/BOFU) separately
- For emails: subject line, preview text, body, and CTA are equally critical
- Always suggest **A/B test variants** for key copy elements
- Include **Growth Metrics**: CAC, LTV, conversion rate benchmarks
- Build brand voice guides with: Tone, Words to use, Words to avoid, Examples`,
  },
  {
    id: 'legal',
    name: 'Legal Analyst',
    emoji: '⚖️',
    desc: 'Contract review, compliance, risk assessment',
    color: 'from-slate-500 to-slate-600',
    colorLight: 'from-slate-500/20 to-slate-600/10',
    accent: '#64748b',
    accentSoft: 'rgba(100,116,139,0.15)',
    tags: ['Contracts', 'Compliance', 'Risk'],
    capability: 89,
    starters: [
      'Review a SaaS subscription agreement and flag high-risk clauses',
      'What does GDPR require for a startup handling EU user data?',
      'Draft an NDA template for contractor engagements',
      'Explain the key differences between an employee and contractor classification',
    ],
    system: `You are a Senior Corporate Attorney with specialization in technology law, SaaS agreements, intellectual property, privacy regulation, and startup compliance. CRITICAL DISCLAIMER: Always clarify that responses are legal information for educational purposes, not legal advice. Recommend consulting a licensed attorney for binding decisions.

Your legal analysis framework:
- Structure every review: **Executive Summary**, **Key Provisions**, **Risk Flags** (🔴High/🟡Medium/🟢Low), **Recommendations**
- For contracts: identify missing clauses, unfavorable terms, jurisdiction issues, liability caps
- For compliance: map requirements to concrete action items with priority and timeline
- Draft templates with [BRACKETED PLACEHOLDERS] for client-specific information
- Flag jurisdiction-specific variations (US/EU/UK/APAC)
- Explain legal jargon in plain English immediately after quoting it
- Always note: "This analysis is for informational purposes only. Consult a licensed attorney."`,
  },
  {
    id: 'finance',
    name: 'Finance Advisor',
    emoji: '💰',
    desc: 'Financial modeling, analysis, investment insights',
    color: 'from-emerald-500 to-emerald-600',
    colorLight: 'from-emerald-500/20 to-emerald-600/10',
    accent: '#10b981',
    accentSoft: 'rgba(16,185,129,0.15)',
    tags: ['Modeling', 'Valuation', 'Strategy'],
    capability: 90,
    starters: [
      'Build a 3-statement financial model for a SaaS startup',
      'Explain how to value a pre-revenue startup using DCF analysis',
      'Create a unit economics framework for a marketplace business',
      'What key metrics should a Series A investor focus on?',
    ],
    system: `You are a Managing Director at a top-tier investment bank and former CFO of a publicly traded tech company. DISCLAIMER: Responses are for educational and analytical purposes only, not personalized financial advice. Consult a licensed financial advisor for investment decisions.

Your financial analysis framework:
- Structure analyses: **Executive Summary**, **Key Assumptions**, **Model**, **Sensitivity Analysis**, **Conclusion**
- Build models with clear input cells (labeled [INPUT]) vs. calculated cells
- For startups: focus on ARR, MRR, Churn, CAC, LTV, Burn Rate, Runway, Rule of 40
- For valuations: show multiple methodologies (DCF, Comparable Companies, Precedent Transactions)
- Always include **Bull/Base/Bear** scenario analysis
- Format financial tables with proper alignment and units ($ thousands, %)
- Explain every formula and assumption
- Flag key risks and sensitivity to assumptions
- Disclaimer on every response: "This is educational analysis, not investment advice."`,
  },
  {
    id: 'ux',
    name: 'UX Designer',
    emoji: '🎨',
    desc: 'User flows, wireframe descriptions, design critique',
    color: 'from-violet-500 to-violet-600',
    colorLight: 'from-violet-500/20 to-violet-600/10',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139,92,246,0.15)',
    tags: ['Wireframes', 'User Research', 'Design Systems'],
    capability: 92,
    starters: [
      'Design the complete user flow for a fintech onboarding experience',
      'Critique this landing page and suggest UX improvements',
      'Create a design system token structure for a B2B SaaS product',
      'Write usability test questions for a checkout flow redesign',
    ],
    system: `You are a Principal UX Designer and Design Systems Lead who has shaped products at Figma, Airbnb, and Stripe. You apply deep human-centered design principles to create experiences that are intuitive, accessible, and delightful.

Your design framework:
- Always start with **User Goals**, **Business Goals**, and **Constraints**
- Map complete **User Journeys** with: Trigger → Steps → Decision Points → End State → Emotions
- For wireframe descriptions: be spatial and precise ("32px padding left, primary CTA at bottom-right")
- Apply **Jakob's Law**, **Hick's Law**, **Fitts's Law** when relevant
- Structure critiques: **What's Working**, **Critical Issues** (🔴), **Improvements** (🟡), **Opportunities** (🟢)
- Reference **WCAG 2.1 AA** accessibility standards
- Suggest **Design Tokens** (colors, spacing, typography) using CSS custom property naming
- Include **Micro-interaction** recommendations for key touch points
- Always consider mobile-first responsive behavior`,
  },
  {
    id: 'tutor',
    name: 'AI Tutor',
    emoji: '🎓',
    desc: 'Explain any concept, adaptive learning, quizzes',
    color: 'from-amber-500 to-amber-600',
    colorLight: 'from-amber-500/20 to-amber-600/10',
    accent: '#f59e0b',
    accentSoft: 'rgba(245,158,11,0.15)',
    tags: ['Teaching', 'Quizzes', 'Concepts'],
    capability: 97,
    starters: [
      'Explain transformer architecture from first principles',
      'Teach me calculus starting from limits — I know basic algebra',
      'Quiz me on React hooks and give detailed feedback',
      'Build a 30-day learning roadmap for machine learning',
    ],
    system: `You are a world-class educator who combines the pedagogical techniques of the best professors at MIT, Stanford, and Khan Academy. You adapt dynamically to the learner's current knowledge level.

Your teaching methodology:
- Always assess knowledge level first: "To calibrate my explanation, what's your background with [topic]?"
- Use the **Feynman Technique**: explain in simple terms, then build complexity
- Structure lessons: **Big Picture** → **Core Concept** → **Mechanics** → **Examples** → **Practice**
- Use rich analogies that connect new concepts to familiar ones
- For every explanation: include at least one real-world application
- After explanations, offer: "**Quick Check**: [2-3 questions to test understanding]"
- For quiz mode: give immediate detailed feedback, explain why wrong answers are wrong
- Create personalized learning paths with milestones and estimated time
- Use Socratic questioning to help students discover answers themselves
- Celebrate progress and normalize struggle as part of learning`,
  },
  {
    id: 'sales',
    name: 'Sales Coach',
    emoji: '🤝',
    desc: 'Pitch decks, objection handling, closing strategies',
    color: 'from-rose-500 to-rose-600',
    colorLight: 'from-rose-500/20 to-rose-600/10',
    accent: '#f43f5e',
    accentSoft: 'rgba(244,63,94,0.15)',
    tags: ['Pitching', 'Negotiation', 'CRM Strategy'],
    capability: 91,
    starters: [
      'Write a compelling investor pitch deck outline for a Series A startup',
      'Role-play: help me handle "your price is too high" objections',
      'Create a discovery call framework for enterprise SaaS sales',
      'Write a cold email sequence targeting VP of Engineering at mid-market companies',
    ],
    system: `You are a legendary Sales Leader who built multiple $100M+ revenue teams, trained at Sandler and MEDDIC methodologies, and personally closed enterprise deals at the C-suite level.

Your sales framework:
- Always start by identifying: **Buyer Persona**, **Pain Points**, **Decision Criteria**, **Competition**
- Structure pitches: **Hook** (problem), **Stakes** (cost of inaction), **Solution**, **Proof**, **CTA**
- For objection handling: use **Feel-Felt-Found** or **Clarify-Confirm-Counter** frameworks
- Write cold outreach with: Pattern interrupt opening, specific personalization, single clear CTA
- Apply MEDDIC: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion
- For negotiations: always give 3 options (Good/Better/Best), anchor high, protect margin
- Role-play sales calls: play the skeptical prospect, then debrief with coaching feedback
- Provide **Talk Tracks** for every stage of the sales cycle
- Include metrics: response rates, conversion benchmarks, deal velocity targets`,
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  liked?: boolean | null
  copied?: boolean
  timestamp?: number
}

type ConvoStore = Record<string, Message[]>

// ─── Capability Bar ───────────────────────────────────────────────────────────

function CapabilityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1 rounded-full bg-surface-active overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  isActive,
  msgCount,
  onSelect,
}: {
  agent: typeof AGENTS[0]
  isActive: boolean
  msgCount: number
  onSelect: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full text-left rounded-2xl p-3 transition-all duration-200 relative group overflow-hidden"
      style={{
        background: isActive
          ? agent.accentSoft
          : hovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        border: `1px solid ${isActive ? agent.accent + '50' : hovered ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        boxShadow: isActive ? `0 0 0 1px ${agent.accent}20, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
      }}
    >
      {/* Active glow bar */}
      {isActive && (
        <div
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
          style={{ background: agent.accent }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center shrink-0 shadow-lg transition-transform duration-200`}
          style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
        >
          <span className="text-lg leading-none">{agent.emoji}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-semibold text-white/90 truncate leading-tight">
              {agent.name}
            </p>
            {msgCount > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                style={{ background: agent.accentSoft, color: agent.accent }}
              >
                {msgCount}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 mb-2">
            {agent.desc}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {agent.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Capability bar */}
          <CapabilityBar value={agent.capability} color={agent.color} />
          <p className="text-[9px] text-white/25 mt-1">
            Capability {agent.capability}%
          </p>
        </div>
      </div>

      {/* Hover CTA */}
      {hovered && !isActive && (
        <div
          className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(135deg, ${agent.accent}15, transparent)` }}
        >
          <div
            className="absolute bottom-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
            style={{ background: agent.accent, color: '#fff' }}
          >
            Chat Now <ChevronRight size={10} />
          </div>
        </div>
      )}
    </button>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-surface-active animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0])
  const [convos, setConvos] = useState<ConvoStore>({})
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null)
  const [mobileListOpen, setMobileListOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = convos[selectedAgent.id] ?? []

  const setMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setConvos(prev => ({
        ...prev,
        [selectedAgent.id]: updater(prev[selectedAgent.id] ?? []),
      }))
    },
    [selectedAgent.id]
  )

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const filteredAgents = AGENTS.filter(
    a =>
      !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || streaming) return

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    const contextMessages = [...messages, userMsg]
    setMessages(() => [...contextMessages, { role: 'assistant', content: '', timestamp: Date.now() }])
    setInput('')
    setStreaming(true)

    try {
      abortRef.current = new AbortController()
      const timer = setTimeout(() => abortRef.current?.abort(), 55000)

      const res = await fetch('/api/tool-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          systemPrompt: selectedAgent.system,
          messages: contextMessages.map(m => ({ role: m.role, content: m.content })),
          stream: false,
        }),
      })

      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const content = data.content || data.error || '⚠️ Empty response from AI.'

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content,
          liked: null,
          timestamp: Date.now(),
        }
        return updated
      })
    } catch (e: any) {
      const msg =
        e.name === 'AbortError'
          ? '⚠️ Request timed out. Please try again.'
          : '⚠️ Error connecting to AI. Please try again.'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: msg, timestamp: Date.now() }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setConvos(prev => ({ ...prev, [selectedAgent.id]: [] }))
  }

  const switchAgent = (agent: typeof AGENTS[0]) => {
    abortRef.current?.abort()
    setStreaming(false)
    setSelectedAgent(agent)
  }

  const copyMessage = async (idx: number, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMsgIdx(idx)
    setTimeout(() => setCopiedMsgIdx(null), 2000)
  }

  const toggleLike = (idx: number, value: boolean) => {
    setMessages(prev =>
      prev.map((m, i) => (i === idx ? { ...m, liked: m.liked === value ? null : value } : m))
    )
  }

  const msgCount = (agentId: string) => {
    const msgs = convos[agentId] ?? []
    return Math.floor(msgs.filter(m => m.role === 'user').length)
  }

  const AgentPanel = ({ showClose, onClose }: { showClose?: boolean; onClose?: () => void }) => (
    <>
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white/90 leading-tight">AI Agents</h2>
            <p className="text-[10px] text-white/35">{AGENTS.length} Specialized Agents</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400/80 font-medium">Live</span>
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="h-7 w-7 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20"
                title="Close agents list"
              >
                <X size={12} className="mx-auto" />
              </button>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Search size={12} className="text-white/30 shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="flex-1 bg-transparent text-xs text-white/70 placeholder:text-white/25 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X size={11} className="text-white/30 hover:text-white/60 transition-colors" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
        {filteredAgents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-white/30">No agents match "{searchQuery}"</p>
          </div>
        )}
        {filteredAgents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isActive={agent.id === selectedAgent.id}
            msgCount={msgCount(agent.id)}
            onSelect={() => {
              switchAgent(agent)
              if (showClose) onClose?.()
            }}
          />
        ))}
      </div>

      <div
        className="px-4 py-3 shrink-0 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <Zap size={10} className="text-amber-400" />
          <span className="text-[10px] text-white/30">Powered by Google Gemini</span>
        </div>
      </div>
    </>
  )

  return (
    <div className="relative h-full flex overflow-hidden" style={{ background: 'var(--bg)' }}>

      {mobileListOpen && (
        <>
          <button
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileListOpen(false)}
            aria-label="Close agents list"
          />
          <div
            className="fixed left-0 top-0 bottom-0 z-50 w-[280px] max-w-[82vw] lg:hidden flex flex-col shadow-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.99) 100%)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <AgentPanel showClose onClose={() => setMobileListOpen(false)} />
          </div>
        </>
      )}

      {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col shrink-0 overflow-hidden border-r"
        style={{
          width: 320,
          background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.99) 100%)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <AgentPanel />
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Agent Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0 border-b border-border bg-surface"
          style={{
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setMobileListOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border text-secondary hover:text-primary"
              title="Open agents list"
            >
              <PanelLeft size={16} />
            </button>
            {/* Avatar */}
            <div
              className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center shadow-xl shrink-0`}
              style={{ boxShadow: `0 4px 20px ${selectedAgent.accent}40` }}
            >
              <span className="text-2xl leading-none">{selectedAgent.emoji}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-primary">{selectedAgent.name}</h1>
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: selectedAgent.accentSoft, color: selectedAgent.accent }}
                >
                  ● Active
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">{selectedAgent.desc}</p>
              {/* Capability tags */}
              <div className="flex items-center gap-1.5 mt-1.5">
                {selectedAgent.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[9px] px-2 py-0.5 rounded-lg font-medium border border-border text-secondary bg-surface-hover"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted hover:text-secondary transition-all bg-surface border border-border"
                title="New Conversation"
              >
                <Plus size={11} />
                <span className="hidden sm:inline">New Chat</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 rounded-xl text-muted hover:text-red-400 transition-colors bg-surface border border-border"
                title="Clear conversation"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Empty State */}
            {messages.length === 0 && (
              <div className="text-center py-10 animate-fade-in">
                {/* Large avatar */}
                <div
                  className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center mx-auto mb-5 shadow-2xl`}
                  style={{ boxShadow: `0 8px 40px ${selectedAgent.accent}50` }}
                >
                  <span className="text-4xl leading-none">{selectedAgent.emoji}</span>
                </div>
                <h2 className="text-xl font-bold text-primary mb-2">{selectedAgent.name}</h2>
                <p className="text-sm text-secondary max-w-md mx-auto mb-2">{selectedAgent.desc}</p>
                {/* Tags */}
                <div className="flex items-center justify-center gap-2 mb-8">
                  {selectedAgent.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: selectedAgent.accentSoft, color: selectedAgent.accent }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Starter prompts */}
                <div className="max-w-2xl mx-auto">
                  <p className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-4">
                    Suggested prompts
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedAgent.starters.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => send(s)}
                        className="px-4 py-3.5 rounded-2xl text-left text-xs text-secondary hover:text-primary transition-all duration-200 group bg-surface-hover border border-border"
                        onMouseEnter={e => {
                          ;(e.currentTarget as HTMLElement).style.borderColor =
                            selectedAgent.accent + '50'
                          ;(e.currentTarget as HTMLElement).style.background =
                            selectedAgent.accentSoft
                        }}
                        onMouseLeave={e => {
                          ;(e.currentTarget as HTMLElement).style.borderColor = ''
                          ;(e.currentTarget as HTMLElement).style.background = ''
                        }}
                      >
                        <span className="leading-relaxed">{s}</span>
                        <ChevronRight
                          size={11}
                          className="inline-block ml-1 opacity-0 group-hover:opacity-60 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-200"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-3`}
              >
                {/* AI Avatar */}
                {msg.role === 'assistant' && (
                  <div
                    className={`w-8 h-8 rounded-xl bg-gradient-to-br ${selectedAgent.color} flex items-center justify-center shrink-0 mt-0.5 shadow-md`}
                  >
                    <span className="text-base leading-none">{selectedAgent.emoji}</span>
                  </div>
                )}

                <div
                  className={`group relative ${msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}
                >
                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'rounded-br-md text-white'
                        : 'text-primary'
                    }`}
                    style={
                      msg.role === 'user'
                        ? {
                            background: `linear-gradient(135deg, ${selectedAgent.accent}, ${selectedAgent.accent}cc)`,
                            boxShadow: `0 2px 16px ${selectedAgent.accent}30`,
                          }
                        : {
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }
                    }
                  >
                    {msg.role === 'user' ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : msg.content ? (
                      <div className="markdown-body prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : streaming && i === messages.length - 1 ? (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: selectedAgent.accentSoft, color: selectedAgent.accent }}
                        >
                          {selectedAgent.name} thinking...
                        </span>
                        <TypingDots />
                      </div>
                    ) : null}
                  </div>

                  {/* AI Message Actions */}
                  {msg.role === 'assistant' && msg.content && (
                    <div
                      className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <button
                        onClick={() => copyMessage(i, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-muted hover:text-secondary transition-colors bg-surface-hover"
                      >
                        {copiedMsgIdx === i ? (
                          <Check size={10} className="text-emerald-400" />
                        ) : (
                          <Copy size={10} />
                        )}
                        {copiedMsgIdx === i ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        onClick={() => toggleLike(i, true)}
                        className="p-1.5 rounded-lg text-muted hover:text-emerald-400 transition-colors"
                        style={{
                          background: msg.liked === true ? 'rgba(16,185,129,0.15)' : 'var(--surface-hover)',
                          color: msg.liked === true ? '#10b981' : undefined,
                        }}
                      >
                        <ThumbsUp size={10} />
                      </button>
                      <button
                        onClick={() => toggleLike(i, false)}
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 transition-colors"
                        style={{
                          background: msg.liked === false ? 'rgba(239,68,68,0.15)' : 'var(--surface-hover)',
                          color: msg.liked === false ? '#ef4444' : undefined,
                        }}
                      >
                        <ThumbsDown size={10} />
                      </button>
                      <button
                        onClick={() => {
                          const prevUser = messages[i - 1]
                          if (prevUser?.role === 'user') send(prevUser.content)
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-muted hover:text-secondary transition-colors bg-surface-hover"
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-primary bg-surface-active border border-border"
                  >
                    U
                  </div>
                )}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Area */}
        <div
          className="px-4 sm:px-6 py-4 shrink-0 border-t border-border bg-bg"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-3xl mx-auto">
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: 'var(--surface)',
                border: `1px solid var(--border)`,
                boxShadow: '0 0 0 0 transparent',
              }}
              onFocusCapture={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = selectedAgent.accent + '60'
                ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${selectedAgent.accent}18`
              }}
              onBlurCapture={e => {
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent'
              }}
            >
              {/* Textarea */}
              <div className="px-4 pt-3.5 pb-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder={`Message ${selectedAgent.name}…`}
                  rows={1}
                  className="w-full bg-transparent text-sm text-primary placeholder:text-muted outline-none resize-none leading-relaxed"
                  style={{ maxHeight: 160 }}
                />
              </div>

              {/* Toolbar */}
              <div
                className="flex items-center justify-between px-3 pb-3 pt-1"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                {/* Left tools */}
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-lg text-muted hover:text-secondary transition-colors hover:bg-surface-hover"
                    title="Attach file (coming soon)"
                    disabled
                  >
                    <Paperclip size={14} />
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-muted hover:text-secondary transition-colors hover:bg-surface-hover"
                    title="Voice input (coming soon)"
                    disabled
                  >
                    <Mic size={14} />
                  </button>
                  <span className="text-[10px] text-muted ml-1 hidden sm:inline">
                    Shift+Enter for new line
                  </span>
                </div>

                {/* Right: Gemini label + send */}
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-muted hidden sm:inline">
                    Powered by Gemini
                  </span>
                  <button
                    onClick={() => send()}
                    disabled={streaming || !input.trim()}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${streaming || !input.trim() ? 'text-muted' : 'text-white'}`}
                    style={{
                      background:
                        streaming || !input.trim()
                          ? 'var(--surface-active)'
                          : `linear-gradient(135deg, ${selectedAgent.accent}, ${selectedAgent.accent}cc)`,
                      boxShadow:
                        !streaming && input.trim()
                          ? `0 2px 12px ${selectedAgent.accent}40`
                          : 'none',
                    }}
                  >
                    {streaming ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span className="hidden sm:inline">{streaming ? 'Sending…' : 'Send'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer label */}
            <p className="text-center text-[10px] text-muted mt-2">
              {selectedAgent.name} · AI can make mistakes · Verify important information
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
