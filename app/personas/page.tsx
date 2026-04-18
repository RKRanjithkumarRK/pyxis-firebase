'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Code2,
  Edit2,
  Layers,
  MoreHorizontal,
  PenLine,
  Plus,
  Scale,
  Search,
  Sparkles,
  Terminal,
  TrendingUp,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = 'Professional' | 'Creative' | 'Technical' | 'Academic' | 'Casual' | 'Executive' | 'Formal'

interface Persona {
  id: string
  name: string
  icon: typeof Sparkles
  iconColor: string
  iconBg: string
  description: string
  tags: string[]
  tone: Tone
  systemPrompt: string
  isPreset: boolean
  isFavorite?: boolean
}

type Tab = 'presets' | 'my' | 'active'

// ─── System Prompt Templates ──────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  default:
    'You are Pyxis, a helpful and balanced AI assistant. You are accurate, concise, and helpful for any task. Respond in a clear, professional tone while adapting to the complexity of each request.',
  code:
    'You are a senior software engineer with 10+ years of experience. Write clean, production-ready code with meaningful variable names, proper error handling, and inline comments. Follow best practices for the language being used. Always explain architectural decisions.',
  research:
    'You are a rigorous research analyst. Structure your responses with clear sections, cite evidence and sources when available, identify confidence levels, and distinguish between established facts and speculative claims. Think critically and highlight nuance.',
  creative:
    'You are an imaginative and expressive creative writer. Use vivid, evocative language. Build narrative tension, develop characters, and employ literary devices naturally. Let your prose breathe — vary sentence rhythm and embrace metaphor.',
  business:
    'You are an MBA-level business strategist with deep expertise in market analysis, competitive intelligence, and growth strategy. Frame responses in terms of ROI, risk, market opportunity, and execution. Be direct and executive-ready.',
  data:
    'You are a data scientist and ML engineer. Explain statistical concepts clearly with concrete examples. When relevant, suggest appropriate methods, highlight assumptions and limitations, and recommend validation approaches.',
  legal:
    'You are a careful legal analyst. Structure analysis logically, acknowledge jurisdictional differences, always include appropriate caveats, and translate complex legal concepts into plain language. Do not provide binding legal advice.',
  devops:
    'You are a senior DevOps and platform engineer. Provide infrastructure guidance for Docker, Kubernetes, CI/CD pipelines, and cloud platforms (AWS, GCP, Azure). Prioritize reliability, security, and operational simplicity.',
  product:
    'You are an experienced product manager focused on user outcomes. Help craft PRDs, user stories, roadmap prioritization, and go-to-market strategies. Ground recommendations in user research and business impact.',
}

// ─── Preset Personas ──────────────────────────────────────────────────────────

const PRESET_PERSONAS: Persona[] = [
  {
    id: 'default',
    name: 'Pyxis Default',
    icon: Sparkles,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    description: 'The balanced all-rounder. Accurate, concise, and helpful for any task.',
    tags: ['General', 'Balanced'],
    tone: 'Professional',
    systemPrompt: SYSTEM_PROMPTS.default,
    isPreset: true,
    isFavorite: true,
  },
  {
    id: 'code',
    name: 'Code Architect',
    icon: Code2,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    description: 'Senior software engineer focused on clean, production-ready code with best practices.',
    tags: ['Code', 'Technical'],
    tone: 'Technical',
    systemPrompt: SYSTEM_PROMPTS.code,
    isPreset: true,
  },
  {
    id: 'research',
    name: 'Research Analyst',
    icon: Search,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    description: 'Deep analytical thinker that structures research with sources, evidence, and insights.',
    tags: ['Research', 'Analysis'],
    tone: 'Academic',
    systemPrompt: SYSTEM_PROMPTS.research,
    isPreset: true,
  },
  {
    id: 'creative',
    name: 'Creative Writer',
    icon: PenLine,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/15',
    description: 'Imaginative storyteller with vivid language, narrative flair, and creative depth.',
    tags: ['Writing', 'Creative'],
    tone: 'Creative',
    systemPrompt: SYSTEM_PROMPTS.creative,
    isPreset: true,
  },
  {
    id: 'business',
    name: 'Business Strategist',
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    description: 'MBA-level advisor for market analysis, strategy, competitive intelligence, and growth.',
    tags: ['Business', 'Strategy'],
    tone: 'Executive',
    systemPrompt: SYSTEM_PROMPTS.business,
    isPreset: true,
  },
  {
    id: 'data',
    name: 'Data Scientist',
    icon: BarChart3,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    description: 'Statistics and ML expert that explains complex data concepts clearly with examples.',
    tags: ['Data', 'ML'],
    tone: 'Technical',
    systemPrompt: SYSTEM_PROMPTS.data,
    isPreset: true,
  },
  {
    id: 'legal',
    name: 'Legal Assistant',
    icon: Scale,
    iconColor: 'text-yellow-400',
    iconBg: 'bg-yellow-500/15',
    description: 'Careful legal analysis with caveats, structured reasoning, and plain-language explanations.',
    tags: ['Legal', 'Compliance'],
    tone: 'Formal',
    systemPrompt: SYSTEM_PROMPTS.legal,
    isPreset: true,
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    icon: Terminal,
    iconColor: 'text-slate-400',
    iconBg: 'bg-slate-500/15',
    description: 'Infrastructure and deployment expert for Docker, Kubernetes, CI/CD, and cloud platforms.',
    tags: ['DevOps', 'Cloud'],
    tone: 'Technical',
    systemPrompt: SYSTEM_PROMPTS.devops,
    isPreset: true,
  },
  {
    id: 'product',
    name: 'Product Manager',
    icon: Layers,
    iconColor: 'text-pink-400',
    iconBg: 'bg-pink-500/15',
    description: 'User-focused PM that helps with PRDs, roadmaps, user stories, and prioritization.',
    tags: ['Product', 'Strategy'],
    tone: 'Professional',
    systemPrompt: SYSTEM_PROMPTS.product,
    isPreset: true,
  },
]

// ─── Tone styles ─────────────────────────────────────────────────────────────

const TONE_STYLES: Record<Tone, string> = {
  Professional: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Creative:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Technical:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Academic:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Casual:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Executive:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Formal:       'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

const TONE_OPTIONS: Tone[] = ['Professional', 'Creative', 'Technical', 'Academic', 'Casual', 'Executive']

const EMOJI_OPTIONS = ['🤖', '🧪', '📊', '✍️', '🔬', '💼']

const COLOR_OPTIONS = [
  { label: 'Blue',   bg: 'bg-blue-500',   ring: 'ring-blue-400' },
  { label: 'Purple', bg: 'bg-purple-500', ring: 'ring-purple-400' },
  { label: 'Emerald',bg: 'bg-emerald-500',ring: 'ring-emerald-400' },
  { label: 'Orange', bg: 'bg-orange-500', ring: 'ring-orange-400' },
  { label: 'Pink',   bg: 'bg-pink-500',   ring: 'ring-pink-400' },
  { label: 'Cyan',   bg: 'bg-cyan-500',   ring: 'ring-cyan-400' },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Persona Card ─────────────────────────────────────────────────────────────

function PersonaCard({
  persona,
  isActive,
  onActivate,
  onDelete,
  allowDelete,
}: {
  persona: Persona
  isActive: boolean
  onActivate: (id: string) => void
  onDelete?: (id: string) => void
  allowDelete?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const Icon = persona.icon

  return (
    <div
      className={`panel group relative flex flex-col rounded-[24px] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${
        isActive
          ? 'border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.3),0_8px_32px_rgba(59,130,246,0.12)]'
          : 'hover:border-border'
      }`}
    >
      {/* ── Top row: icon + badges + menu ── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${persona.iconBg}`}>
            <Icon size={20} className={persona.iconColor} />
          </div>
          {isActive && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              Active
            </span>
          )}
        </div>

        {/* Three-dot menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:border-border/80 hover:bg-surface-hover hover:text-text-primary"
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-[16px] border border-border/80 bg-surface-hover shadow-xl backdrop-blur-xl">
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-active hover:text-text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  <Edit2 size={13} />
                  Edit
                </button>
                <button
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-active hover:text-text-primary"
                  onClick={() => setMenuOpen(false)}
                >
                  <Zap size={13} />
                  Duplicate
                </button>
                {allowDelete && onDelete && (
                  <button
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                    onClick={() => { onDelete(persona.id); setMenuOpen(false) }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Name + description ── */}
      <div className="mt-4 flex-1">
        <h3 className="font-display text-[clamp(1rem,1.3vw,1.2rem)] leading-tight text-text-primary">
          {persona.name}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-text-tertiary">{persona.description}</p>
      </div>

      {/* ── Tags ── */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {persona.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border/60 bg-surface-hover px-2.5 py-0.5 text-[11px] text-text-tertiary"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* ── Footer: tone + activate button ── */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_STYLES[persona.tone]}`}
        >
          {persona.tone}
        </span>

        {isActive ? (
          <button
            disabled
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400"
          >
            <CheckCircle size={13} />
            Active
          </button>
        ) : (
          <button
            onClick={() => onActivate(persona.id)}
            className="rounded-xl border border-border/80 bg-surface-hover px-4 py-2 text-xs font-medium text-text-secondary transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400"
          >
            Activate
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreatePersonaModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (p: Persona) => void
}) {
  const [name, setName] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('🤖')
  const [selectedColor, setSelectedColor] = useState(0)
  const [tone, setTone] = useState<Tone>('Professional')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [errors, setErrors] = useState<{ name?: boolean; prompt?: boolean }>({})

  function handleCreate() {
    const errs: typeof errors = {}
    if (!name.trim()) errs.name = true
    if (!systemPrompt.trim()) errs.prompt = true
    if (Object.keys(errs).length) { setErrors(errs); return }

    const colorMap: Record<number, { color: string; bg: string }> = {
      0: { color: 'text-blue-400',    bg: 'bg-blue-500/15' },
      1: { color: 'text-purple-400',  bg: 'bg-purple-500/15' },
      2: { color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
      3: { color: 'text-orange-400',  bg: 'bg-orange-500/15' },
      4: { color: 'text-pink-400',    bg: 'bg-pink-500/15' },
      5: { color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
    }

    // Use Sparkles as a fallback icon type; custom personas render emoji
    const newPersona: Persona = {
      id: generateId(),
      name: name.trim(),
      icon: Sparkles,
      iconColor: colorMap[selectedColor].color,
      iconBg: colorMap[selectedColor].bg,
      description: systemPrompt.trim().slice(0, 120) + (systemPrompt.trim().length > 120 ? '...' : ''),
      tags: [tone],
      tone,
      systemPrompt: systemPrompt.trim(),
      isPreset: false,
      isFavorite: false,
    }

    onCreate(newPersona)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[28px] border border-border/80 bg-surface-hover shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
              <Users size={17} className="text-blue-400" />
            </div>
            <p className="font-display text-lg text-text-primary">Create New Persona</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-bg text-text-tertiary transition-colors hover:border-border hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">
              Persona Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: false })) }}
              placeholder="Persona name..."
              className={`w-full rounded-[16px] border bg-bg px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all focus:ring-2 ${
                errors.name
                  ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10'
                  : 'border-border/80 focus:border-blue-500/40 focus:ring-blue-500/10'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">Name is required</p>}
          </div>

          {/* Emoji + Color row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">
                Icon
              </label>
              <div className="flex gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border text-base transition-all ${
                      selectedEmoji === emoji
                        ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_0_2px_rgba(59,130,246,0.25)]'
                        : 'border-border/60 bg-bg hover:border-border hover:bg-surface-hover'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">
                Color
              </label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color, i) => (
                  <button
                    key={color.label}
                    onClick={() => setSelectedColor(i)}
                    className={`h-7 w-7 rounded-full ${color.bg} transition-all ${
                      selectedColor === i
                        ? `ring-2 ring-offset-2 ring-offset-surface-hover ${color.ring}`
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full rounded-[16px] border border-border/80 bg-bg px-4 py-3 text-sm text-text-primary outline-none transition-all focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-[0.15em] text-text-tertiary">
                System Prompt
              </label>
              <button
                onClick={() => setSystemPrompt(`You are ${name.trim() || 'a specialized AI assistant'}. `)}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-bg px-2.5 py-1 text-[11px] text-text-tertiary transition-colors hover:border-border hover:text-text-primary"
              >
                <Sparkles size={10} className="text-blue-400" />
                Generate with AI
              </button>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => { setSystemPrompt(e.target.value); setErrors((p) => ({ ...p, prompt: false })) }}
              placeholder={`You are a specialized AI assistant that...\n\nDescribe the persona's expertise, communication style, and how it should behave.`}
              rows={5}
              className={`w-full rounded-[16px] border bg-bg px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-tertiary outline-none transition-all resize-none focus:ring-2 ${
                errors.prompt
                  ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10'
                  : 'border-border/80 focus:border-blue-500/40 focus:ring-blue-500/10'
              }`}
            />
            {errors.prompt && <p className="mt-1 text-xs text-red-400">System prompt is required</p>}
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              This prompt is sent as a system message before every chat with this persona.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border/60 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-surface-hover px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:scale-[1.02]"
          >
            <Plus size={14} />
            Create Persona
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const router = useRouter()

  const [activePersona, setActivePersona] = useState<string>('default')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('presets')
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────

  const allPersonas = [...PRESET_PERSONAS, ...customPersonas]
  const currentPersona = allPersonas.find((p) => p.id === activePersona) ?? PRESET_PERSONAS[0]
  const isNonDefault = activePersona !== 'default'

  // ── Handlers ───────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  function handleActivate(id: string) {
    const p = allPersonas.find((x) => x.id === id)
    setActivePersona(id)
    showToast(`${p?.name ?? 'Persona'} activated`)
  }

  function handleDeactivate() {
    setActivePersona('default')
    showToast('Reverted to Pyxis Default')
  }

  function handleCreate(persona: Persona) {
    setCustomPersonas((prev) => [persona, ...prev])
    setShowCreateModal(false)
    showToast(`"${persona.name}" created`)
    setActiveTab('my')
  }

  function handleDelete(id: string) {
    if (activePersona === id) setActivePersona('default')
    setCustomPersonas((prev) => prev.filter((p) => p.id !== id))
    showToast('Persona deleted')
  }

  // ── Tabs config ────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'presets', label: 'Presets', count: PRESET_PERSONAS.length },
    { id: 'my',      label: 'My Personas', count: customPersonas.length || undefined },
    { id: 'active',  label: 'Active' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full overflow-y-auto custom-scrollbar" style={{ maxHeight: '100%' }}>

      {/* ── Toast ── */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-[20px] border border-border/80 bg-surface-hover px-4 py-3 shadow-xl backdrop-blur-xl">
          <CheckCircle size={13} className="text-emerald-400" />
          <span className="text-sm text-text-primary">{toast}</span>
        </div>
      </div>

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <CreatePersonaModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      <div className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">

        {/* ── Active Persona Banner (non-default only) ── */}
        {isNonDefault && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-[20px] border border-blue-500/25 bg-blue-500/8 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${currentPersona.iconBg}`}>
                <currentPersona.icon size={15} className={currentPersona.iconColor} />
              </div>
              <p className="text-sm text-text-primary">
                <span className="font-semibold text-blue-300">{currentPersona.name}</span>
                <span className="text-text-secondary"> is active — all chats will use this persona</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setActiveTab('presets')}
                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
              >
                Change
              </button>
              <button
                onClick={handleDeactivate}
                className="rounded-xl border border-border/60 bg-surface-hover px-3.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-border hover:text-text-primary"
              >
                Deactivate
              </button>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            {/* Back */}
            <button
              onClick={() => router.push('/hub')}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-surface-hover px-3.5 py-2 text-sm text-text-secondary transition-all hover:border-border hover:text-text-primary"
            >
              <ArrowLeft size={14} />
              Back to Hub
            </button>

            {/* Title row */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10">
                <Users size={22} className="text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-[clamp(1.6rem,2.2vw,2.4rem)] leading-tight">
                    <span className="text-gradient">AI Personas</span>
                  </h1>
                  <span className="pill text-[11px] text-violet-400">12 presets</span>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Create custom AI personalities for different workflows
                </p>
              </div>
            </div>
          </div>

          {/* Create button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:scale-[1.02] sm:self-auto"
          >
            <Plus size={15} />
            Create Persona
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="mb-6 flex items-center gap-1 rounded-[20px] border border-border/60 bg-surface-hover p-1.5 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-surface-active text-text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-surface-active/50 hover:text-text-primary'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.id
                      ? 'bg-accent/20 text-accent'
                      : 'bg-bg text-text-tertiary'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Presets ── */}
        {activeTab === 'presets' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PRESET_PERSONAS.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={activePersona === persona.id}
                onActivate={handleActivate}
                allowDelete={false}
              />
            ))}
          </div>
        )}

        {/* ── Tab: My Personas ── */}
        {activeTab === 'my' && (
          <>
            {customPersonas.length === 0 ? (
              <div className="panel flex flex-col items-center justify-center rounded-[28px] py-24 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-surface-hover">
                  <Users size={28} className="text-text-tertiary" />
                </div>
                <p className="font-display text-xl text-text-primary">No custom personas yet</p>
                <p className="mt-2 max-w-xs text-sm text-text-secondary">
                  Create a persona with a custom system prompt and personality tailored to your workflow.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-all hover:bg-accent-hover hover:scale-[1.02]"
                >
                  <Plus size={14} />
                  Create your first persona →
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customPersonas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    isActive={activePersona === persona.id}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                    allowDelete
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Active ── */}
        {activeTab === 'active' && (
          <div className="glass-panel rounded-[28px] p-6 md:p-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] ${currentPersona.iconBg}`}
                >
                  <currentPersona.icon size={24} className={currentPersona.iconColor} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-2xl text-text-primary">{currentPersona.name}</h2>
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                      Active
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{currentPersona.description}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface-hover px-4 py-2.5 text-sm text-text-secondary transition-all hover:border-border hover:text-text-primary"
                  onClick={() => setActiveTab('presets')}
                >
                  <Edit2 size={13} />
                  Change
                </button>
                {isNonDefault && (
                  <button
                    onClick={handleDeactivate}
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/15"
                  >
                    <X size={13} />
                    Deactivate
                  </button>
                )}
              </div>
            </div>

            {/* Tags + Tone row */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${TONE_STYLES[currentPersona.tone]}`}>
                {currentPersona.tone}
              </span>
              {currentPersona.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/60 bg-surface-hover px-3 py-1 text-xs text-text-tertiary"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Divider */}
            <div className="my-6 h-px bg-border/40" />

            {/* System Prompt */}
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
                System Prompt
              </p>
              <div className="rounded-[18px] border border-border/60 bg-bg px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                  {currentPersona.systemPrompt}
                </p>
              </div>
            </div>

            {/* Info note */}
            <div className="mt-5 flex items-center gap-2.5 rounded-[14px] border border-border/50 bg-surface-hover px-4 py-3">
              <Sparkles size={14} className="shrink-0 text-blue-400" />
              <p className="text-sm text-text-secondary">
                This system prompt is applied at the start of every new chat session while this persona is active.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
