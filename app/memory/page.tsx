'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Brain,
  Briefcase,
  Code2,
  Heart,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemoryCategory = 'all' | 'preferences' | 'work' | 'interests' | 'skills' | 'communication'
type Confidence = 'High' | 'Medium' | 'Low'

interface Memory {
  id: string
  text: string
  category: MemoryCategory
  categoryLabel: string
  daysAgo: number
  confidence: Confidence
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_MEMORIES: Memory[] = [
  {
    id: '1',
    text: 'Prefers concise, direct responses without filler phrases',
    category: 'preferences',
    categoryLabel: 'Preferences',
    daysAgo: 2,
    confidence: 'High',
  },
  {
    id: '2',
    text: 'Working on a React dashboard with Next.js 14 and Tailwind CSS',
    category: 'work',
    categoryLabel: 'Work Context',
    daysAgo: 1,
    confidence: 'High',
  },
  {
    id: '3',
    text: 'Interested in AI/ML research and large language models',
    category: 'interests',
    categoryLabel: 'Interests',
    daysAgo: 5,
    confidence: 'High',
  },
  {
    id: '4',
    text: 'Prefers dark mode and minimal UI interfaces',
    category: 'preferences',
    categoryLabel: 'Preferences',
    daysAgo: 7,
    confidence: 'High',
  },
  {
    id: '5',
    text: 'Uses TypeScript for all frontend projects',
    category: 'skills',
    categoryLabel: 'Technical Skills',
    daysAgo: 3,
    confidence: 'Medium',
  },
  {
    id: '6',
    text: 'Currently job hunting and preparing for technical interviews',
    category: 'work',
    categoryLabel: 'Work Context',
    daysAgo: 1,
    confidence: 'High',
  },
  {
    id: '7',
    text: 'Prefers Python for backend development (FastAPI)',
    category: 'skills',
    categoryLabel: 'Technical Skills',
    daysAgo: 4,
    confidence: 'High',
  },
  {
    id: '8',
    text: 'Likes step-by-step explanations for complex topics',
    category: 'communication',
    categoryLabel: 'Communication Style',
    daysAgo: 6,
    confidence: 'Medium',
  },
  {
    id: '9',
    text: 'Interested in startup culture and entrepreneurship',
    category: 'interests',
    categoryLabel: 'Interests',
    daysAgo: 8,
    confidence: 'Medium',
  },
  {
    id: '10',
    text: 'Building Pyxis One — an AI operating system platform',
    category: 'work',
    categoryLabel: 'Work Context',
    daysAgo: 2,
    confidence: 'High',
  },
  {
    id: '11',
    text: 'Prefers code examples with inline comments explaining each step',
    category: 'communication',
    categoryLabel: 'Communication Style',
    daysAgo: 3,
    confidence: 'High',
  },
  {
    id: '12',
    text: 'Interested in system design and distributed systems architecture',
    category: 'interests',
    categoryLabel: 'Interests',
    daysAgo: 5,
    confidence: 'Medium',
  },
]

const CATEGORIES: {
  id: MemoryCategory
  label: string
  icon: typeof Brain
  color: string
  bg: string
}[] = [
  { id: 'all',          label: 'All Memories',       icon: Brain,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { id: 'preferences',  label: 'Preferences',         icon: Settings,      color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  { id: 'work',         label: 'Work Context',        icon: Briefcase,     color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { id: 'interests',    label: 'Interests',           icon: Heart,         color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  { id: 'skills',       label: 'Technical Skills',    icon: Code2,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'communication',label: 'Communication Style', icon: MessageSquare, color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
]

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  High:   'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  Medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  Low:    'text-text-tertiary border-border/60 bg-surface-hover',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryMeta(cat: MemoryCategory) {
  return CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[0]
}

function formatRelativeDate(daysAgo: number): string {
  if (daysAgo === 0) return 'Added today'
  if (daysAgo === 1) return 'Added yesterday'
  return `Added ${daysAgo} days ago`
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// ─── Memory Card ──────────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onDelete,
}: {
  memory: Memory
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const meta = getCategoryMeta(memory.category)
  const Icon = meta.icon

  return (
    <div
      className="glass-panel relative rounded-[20px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button — appears on hover */}
      <button
        onClick={() => onDelete(memory.id)}
        className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-surface-hover text-text-tertiary transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 ${
          hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
        aria-label="Delete memory"
      >
        <X size={12} />
      </button>

      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
          <Icon size={16} className={meta.color} />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm leading-6 text-text-primary">{memory.text}</p>
        </div>
      </div>

      {/* Footer row */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Category badge */}
          <span className={`pill text-[10px] ${meta.color}`} style={{ borderColor: 'var(--border)' }}>
            {memory.categoryLabel}
          </span>
          {/* Confidence */}
          <span className={`pill text-[10px] ${CONFIDENCE_STYLES[memory.confidence]}`}>
            {memory.confidence}
          </span>
        </div>
        {/* Date */}
        <p className="shrink-0 font-mono text-[11px] text-text-tertiary">
          {formatRelativeDate(memory.daysAgo)}
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const router = useRouter()
  const [memories, setMemories] = useState<Memory[]>(INITIAL_MEMORIES)
  const [selectedCategory, setSelectedCategory] = useState<MemoryCategory>('all')
  const [newMemoryText, setNewMemoryText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // ── Derived data ──────────────────────────────────────────────────────

  const filtered =
    selectedCategory === 'all'
      ? memories
      : memories.filter((m) => m.category === selectedCategory)

  const categoryCounts: Record<MemoryCategory, number> = {
    all: memories.length,
    preferences:   memories.filter((m) => m.category === 'preferences').length,
    work:          memories.filter((m) => m.category === 'work').length,
    interests:     memories.filter((m) => m.category === 'interests').length,
    skills:        memories.filter((m) => m.category === 'skills').length,
    communication: memories.filter((m) => m.category === 'communication').length,
  }

  const usagePct = Math.round((memories.length / 200) * 100)

  // ── Actions ───────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  function handleDelete(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    showToast('Memory removed')
  }

  function handleClearAll() {
    if (selectedCategory === 'all') {
      setMemories([])
    } else {
      setMemories((prev) => prev.filter((m) => m.category !== selectedCategory))
    }
    setShowClearConfirm(false)
    showToast(selectedCategory === 'all' ? 'All memories cleared' : 'Category cleared')
  }

  function handleAddMemory() {
    const text = newMemoryText.trim()
    if (!text) return
    const newMem: Memory = {
      id: generateId(),
      text,
      category: selectedCategory === 'all' ? 'preferences' : selectedCategory,
      categoryLabel:
        selectedCategory === 'all'
          ? 'Preferences'
          : (CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? 'Preferences'),
      daysAgo: 0,
      confidence: 'High',
    }
    setMemories((prev) => [newMem, ...prev])
    setNewMemoryText('')
    showToast('Memory added')
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full overflow-y-auto custom-scrollbar" style={{ maxHeight: '100%' }}>

      {/* ── Toast Notification ── */}
      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-[20px] border border-border/80 bg-surface-hover px-4 py-3 shadow-xl backdrop-blur-xl">
          <Sparkles size={13} className="text-blue-400" />
          <span className="text-sm text-text-primary">{toast}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1280px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            {/* Back button */}
            <button
              onClick={() => router.push('/hub')}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-surface-hover px-3.5 py-2 text-sm text-text-secondary transition-all hover:border-border hover:text-text-primary"
            >
              <ArrowLeft size={14} />
              Back to Hub
            </button>

            {/* Title row */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10">
                <Brain size={22} className="text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-[clamp(1.6rem,2.2vw,2.4rem)] leading-tight text-text-primary">
                    <span className="text-gradient">AI Memory</span>
                  </h1>
                  <span className="pill text-[11px] text-blue-400">Beta</span>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Pyxis remembers your preferences and context across all sessions
                </p>
              </div>
            </div>
          </div>

          {/* Clear All button */}
          <div className="flex items-center gap-3">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Are you sure?</span>
                <button
                  onClick={handleClearAll}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-xl border border-border/80 bg-surface-hover px-4 py-2 text-sm text-text-secondary transition-all hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-2.5 text-sm font-medium text-red-400 transition-all hover:border-red-500/50 hover:bg-red-500/15"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Total Memories',
              value: memories.length.toString(),
              sub: 'stored entries',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
              icon: Brain,
            },
            {
              label: 'Categories',
              value: '6',
              sub: 'active groups',
              color: 'text-violet-400',
              bg: 'bg-violet-500/10',
              icon: Sparkles,
            },
            {
              label: 'Last Updated',
              value: '2h ago',
              sub: 'most recent entry',
              color: 'text-emerald-400',
              bg: 'bg-emerald-500/10',
              icon: Brain,
            },
            {
              label: 'Memory Usage',
              value: `${usagePct}%`,
              sub: 'of capacity',
              color: 'text-amber-400',
              bg: 'bg-amber-500/10',
              icon: Brain,
            },
          ].map((stat) => (
            <div key={stat.label} className="panel rounded-[22px] p-5">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon size={16} className={stat.color} />
              </div>
              <p className={`font-display text-2xl font-semibold leading-none ${stat.color}`}>
                {stat.value}
              </p>
              <p className="mt-1.5 text-xs font-medium text-text-primary">{stat.label}</p>
              <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Main Content: Sidebar + Grid ── */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* ── Category Sidebar (30%) ── */}
          <div className="w-full lg:w-[30%] lg:shrink-0">
            <div className="glass-panel rounded-[24px] p-2">
              <div className="mb-2 px-3 pt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-tertiary">
                  Filter by category
                </p>
              </div>
              <div className="space-y-0.5">
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat.id
                  const count = categoryCounts[cat.id]
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex w-full items-center gap-3 rounded-[16px] px-3.5 py-3 text-left transition-all duration-150 ${
                        isActive
                          ? 'bg-surface-active text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
                          isActive ? cat.bg : 'bg-surface-hover'
                        }`}
                      >
                        <Icon size={15} className={isActive ? cat.color : 'text-text-tertiary'} />
                      </div>
                      <span className="flex-1 text-sm font-medium">{cat.label}</span>
                      <span
                        className={`min-w-[24px] rounded-full px-2 py-0.5 text-center font-mono text-[11px] transition-all ${
                          isActive
                            ? `${cat.bg} ${cat.color}`
                            : 'bg-surface-hover text-text-tertiary'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Sidebar footer tip */}
              <div className="mt-3 rounded-[14px] border border-border/60 bg-surface-hover px-3.5 py-3">
                <p className="text-[11px] leading-5 text-text-tertiary">
                  <span className="font-medium text-text-secondary">Tip:</span> Pyxis automatically
                  learns from your conversations. Memories are updated in real-time.
                </p>
              </div>
            </div>
          </div>

          {/* ── Memory Grid (70%) ── */}
          <div className="flex-1 min-w-0">

            {/* Grid header */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-text-tertiary">
                  {selectedCategory === 'all' ? 'All memories' : getCategoryMeta(selectedCategory).label}
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} stored
                </p>
              </div>
              {filtered.length > 0 && (
                <span className="pill text-[11px] text-text-tertiary">
                  Sorted by recency
                </span>
              )}
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="panel flex flex-col items-center justify-center rounded-[24px] py-20 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-hover">
                  <Brain size={24} className="text-text-tertiary" />
                </div>
                <p className="font-display text-lg text-text-primary">No memories here</p>
                <p className="mt-1.5 max-w-xs text-sm text-text-secondary">
                  {selectedCategory === 'all'
                    ? 'Start chatting with Pyxis and memories will appear automatically.'
                    : 'No memories in this category yet. Add one below or chat with Pyxis.'}
                </p>
              </div>
            )}

            {/* Memory cards grid */}
            {filtered.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {filtered.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {/* ── Add Memory Section ── */}
            <div className="mt-6">
              <div className="panel rounded-[24px] p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                    <Plus size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Add a Memory</p>
                    <p className="text-xs text-text-tertiary">
                      Manually add things you want Pyxis to always remember
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddMemory()
                    }}
                    placeholder="Add a new memory..."
                    className="flex-1 rounded-[16px] border border-border/80 bg-surface-hover px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-all focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                  />
                  <button
                    onClick={handleAddMemory}
                    disabled={!newMemoryText.trim()}
                    className="flex items-center gap-2 rounded-[16px] bg-blue-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-text-tertiary">
                  Press Enter or click Add. New memories are applied immediately across all future sessions.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Privacy Notice ── */}
        <div className="mt-8 flex items-center justify-center gap-2.5 rounded-[18px] border border-border/60 bg-surface-hover py-4">
          <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
          <p className="text-sm text-text-secondary">
            Your memories are encrypted and stored securely. Only you can access them.
          </p>
        </div>

      </div>
    </div>
  )
}
