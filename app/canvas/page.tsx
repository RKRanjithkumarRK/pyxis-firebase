'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  FileText,
  FileUp,
  Globe,
  Layers,
  Mail,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Terminal,
  Trash2,
  Wand2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeCategory = 'input' | 'model' | 'tool' | 'output'

interface CanvasNode {
  id: string
  label: string
  type: string
  category: NodeCategory
  x: number
  y: number
  icon: React.ElementType
}

interface RunRecord {
  timestamp: string
  status: 'success' | 'failed'
  duration: string
  nodes: number
  error?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<NodeCategory, { border: string; dot: string; bg: string; ring: string; text: string }> = {
  input:  { border: '#34D399', dot: 'bg-emerald-400', bg: 'rgba(52,211,153,0.08)', ring: 'rgba(52,211,153,0.4)',  text: 'text-emerald-400' },
  model:  { border: '#60A5FA', dot: 'bg-blue-400',    bg: 'rgba(96,165,250,0.08)', ring: 'rgba(96,165,250,0.4)',  text: 'text-blue-400'    },
  tool:   { border: '#A78BFA', dot: 'bg-violet-400',  bg: 'rgba(167,139,250,0.08)',ring: 'rgba(167,139,250,0.4)', text: 'text-violet-400'  },
  output: { border: '#FB923C', dot: 'bg-orange-400',  bg: 'rgba(251,146,60,0.08)', ring: 'rgba(251,146,60,0.4)',  text: 'text-orange-400'  },
}

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Input', model: 'AI Model', tool: 'Tool', output: 'Output',
}

const NODE_LIBRARY: { category: NodeCategory; nodes: { label: string; desc: string; icon: React.ElementType }[] }[] = [
  {
    category: 'input',
    nodes: [
      { label: 'Text Input',   desc: 'Type your prompt',    icon: Wand2    },
      { label: 'File Upload',  desc: 'Upload documents',    icon: FileUp   },
      { label: 'Web URL',      desc: 'Fetch from URL',      icon: Globe    },
      { label: 'API Trigger',  desc: 'Webhook input',       icon: Zap      },
    ],
  },
  {
    category: 'model',
    nodes: [
      { label: 'Gemini 2.0 Flash', desc: 'Google Gemini',    icon: Sparkles },
      { label: 'GPT-4o',           desc: 'OpenAI flagship',  icon: Sparkles },
      { label: 'Claude Sonnet',    desc: 'Anthropic model',  icon: Sparkles },
      { label: 'Llama 3.3 70B',    desc: 'Meta open-source', icon: Sparkles },
    ],
  },
  {
    category: 'tool',
    nodes: [
      { label: 'Web Search',      desc: 'Live internet search', icon: Globe    },
      { label: 'Image Generator', desc: 'Create images',        icon: Wand2    },
      { label: 'Code Executor',   desc: 'Run code sandboxed',   icon: Code2    },
      { label: 'Document Parser', desc: 'Extract from files',   icon: FileText },
    ],
  },
  {
    category: 'output',
    nodes: [
      { label: 'Text Output', desc: 'Display result',   icon: FileText },
      { label: 'Email Send',  desc: 'Send via email',   icon: Mail     },
      { label: 'Save to File',desc: 'Export to file',   icon: Save     },
      { label: 'API Response',desc: 'Return JSON',      icon: Terminal },
    ],
  },
]

const CANVAS_NODES: CanvasNode[] = [
  { id: 'n1', label: 'User Prompt',      type: 'Text Input',        category: 'input',  x: 60,  y: 210, icon: Wand2    },
  { id: 'n5', label: 'File Upload',      type: 'File Upload',       category: 'input',  x: 60,  y: 80,  icon: FileUp   },
  { id: 'n2', label: 'Web Search',       type: 'Web Search',        category: 'tool',   x: 280, y: 210, icon: Globe    },
  { id: 'n6', label: 'Document Parser',  type: 'Document Parser',   category: 'tool',   x: 280, y: 80,  icon: FileText },
  { id: 'n3', label: 'Gemini 2.0 Flash', type: 'AI Model',          category: 'model',  x: 510, y: 148, icon: Sparkles },
  { id: 'n4', label: 'Text Output',      type: 'Text Output',       category: 'output', x: 740, y: 148, icon: FileText },
]

// SVG bezier connections: [sourceId, targetId]
const CONNECTIONS: [string, string][] = [
  ['n1', 'n2'],
  ['n5', 'n6'],
  ['n2', 'n3'],
  ['n6', 'n3'],
  ['n3', 'n4'],
]

const INITIAL_RUNS: RunRecord[] = [
  { timestamp: 'Today 14:23',     status: 'success', duration: '3.2s', nodes: 6 },
  { timestamp: 'Today 11:05',     status: 'success', duration: '2.8s', nodes: 6 },
  { timestamp: 'Yesterday 16:42', status: 'failed',  duration: '1.1s', nodes: 3, error: 'Web Search timeout' },
]

// ─── Node card width/height for connection dot positioning ────────────────────
const NODE_W = 162
const NODE_H = 78

function getNodeById(id: string) {
  return CANVAS_NODES.find((n) => n.id === id)
}

// ─── SVG Connection ───────────────────────────────────────────────────────────

function Connection({ sourceId, targetId, isRunning }: { sourceId: string; targetId: string; isRunning: boolean }) {
  const src = getNodeById(sourceId)
  const tgt = getNodeById(targetId)
  if (!src || !tgt) return null

  const x1 = src.x + NODE_W
  const y1 = src.y + NODE_H / 2
  const x2 = tgt.x
  const y2 = tgt.y + NODE_H / 2
  const cx1 = x1 + (x2 - x1) * 0.45
  const cy1 = y1
  const cx2 = x2 - (x2 - x1) * 0.45
  const cy2 = y2
  const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
  const color = CATEGORY_COLORS[src.category].border

  return (
    <g>
      {/* shadow line */}
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeOpacity={0.15} />
      {/* main line */}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="5 3" />
      {/* animated flow dot */}
      {isRunning && (
        <circle r={4} fill={color} opacity={0.9}>
          <animateMotion dur="1.6s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  )
}

// ─── Canvas Node ──────────────────────────────────────────────────────────────

function CanvasNodeCard({
  node,
  selected,
  onClick,
}: {
  node: CanvasNode
  selected: boolean
  onClick: () => void
}) {
  const colors = CATEGORY_COLORS[node.category]
  const Icon = node.icon

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_W,
        height: NODE_H,
        borderTop: `3px solid ${colors.border}`,
        background: selected
          ? `linear-gradient(180deg, ${colors.bg}, rgba(255,255,255,0.03))`
          : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        boxShadow: selected
          ? `0 0 0 2px ${colors.ring}, 0 8px 32px rgba(0,0,0,0.5)`
          : '0 4px 20px rgba(0,0,0,0.4)',
        border: selected ? `1px solid ${colors.border}` : '1px solid rgba(255,255,255,0.1)',
        borderTopColor: colors.border,
        borderTopWidth: 3,
        borderRadius: 16,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.15s',
        userSelect: 'none',
        zIndex: selected ? 10 : 1,
      }}
      className="hover:-translate-y-0.5"
    >
      {/* Input dot (left) */}
      <div
        style={{ position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)' }}
        className={`h-2.5 w-2.5 rounded-full border-2 border-bg ${colors.dot}`}
      />
      {/* Output dot (right) */}
      <div
        style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)' }}
        className={`h-2.5 w-2.5 rounded-full border-2 border-bg ${colors.dot}`}
      />

      <div className="flex h-full flex-col justify-center px-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ background: colors.bg }}
          >
            <Icon size={12} style={{ color: colors.border }} />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: colors.border }}>
            {CATEGORY_LABELS[node.category]}
          </span>
        </div>
        <p className="mt-1 font-display text-sm leading-tight text-text-primary">{node.label}</p>
      </div>
    </div>
  )
}

// ─── Node Library Section ─────────────────────────────────────────────────────

function LibrarySection({
  category,
  nodes,
  expanded,
  onToggle,
}: {
  category: NodeCategory
  nodes: { label: string; desc: string; icon: React.ElementType }[]
  expanded: boolean
  onToggle: () => void
}) {
  const colors = CATEGORY_COLORS[category]
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-surface-hover"
      >
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: colors.border }} />
          <span className="text-xs font-medium text-text-secondary">{CATEGORY_LABELS[category]}</span>
        </div>
        {expanded ? <ChevronDown size={13} className="text-text-tertiary" /> : <ChevronRight size={13} className="text-text-tertiary" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1 px-1">
          {nodes.map((node) => {
            const Icon = node.icon
            return (
              <div
                key={node.label}
                className="flex cursor-grab items-center gap-2.5 rounded-xl border px-3 py-2 transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                style={{
                  borderColor: 'rgba(255,255,255,0.08)',
                  borderLeft: `3px solid ${colors.border}`,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: colors.bg }}
                >
                  <Icon size={11} style={{ color: colors.border }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">{node.label}</p>
                  <p className="truncate text-[10px] text-text-tertiary">{node.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Inspector Panel ──────────────────────────────────────────────────────────

function InspectorPanel({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const [temperature, setTemperature] = useState(0.7)
  const [streaming, setStreaming] = useState(true)
  const colors = CATEGORY_COLORS[node.category]
  const Icon = node.icon

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: colors.bg }}
          >
            <Icon size={15} style={{ color: colors.border }} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{node.label}</p>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: colors.bg, color: colors.border }}
            >
              {CATEGORY_LABELS[node.category]}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover"
        >
          <X size={14} className="text-text-tertiary" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Model selector */}
        {node.category === 'model' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">Model</label>
            <select className="w-full rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500/40">
              <option>gemini-2.0-flash</option>
              <option>gemini-1.5-pro</option>
              <option>gpt-4o</option>
              <option>claude-sonnet-4-5</option>
            </select>
          </div>
        )}

        {/* Temperature */}
        {node.category === 'model' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-text-tertiary">Temperature</label>
              <span className="font-mono text-xs text-text-secondary">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="mt-1 flex justify-between">
              <span className="text-[10px] text-text-tertiary">Precise</span>
              <span className="text-[10px] text-text-tertiary">Creative</span>
            </div>
          </div>
        )}

        {/* Max tokens */}
        {node.category === 'model' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">Max Tokens</label>
            <input
              type="number"
              defaultValue={4096}
              className="w-full rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {/* System prompt */}
        {node.category === 'model' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">System Prompt</label>
            <textarea
              rows={4}
              defaultValue="You are a helpful AI assistant. Be concise and accurate."
              className="w-full resize-none rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {/* Streaming toggle */}
        {node.category === 'model' && (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-hover px-3 py-2.5">
            <span className="text-sm text-text-primary">Streaming</span>
            <button
              onClick={() => setStreaming(!streaming)}
              className={`relative h-5 w-9 rounded-full transition-colors ${streaming ? 'bg-blue-500' : 'bg-border'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${streaming ? 'left-[18px]' : 'left-0.5'}`}
              />
            </button>
          </div>
        )}

        {/* Generic label field for non-model nodes */}
        {node.category !== 'model' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">Node Label</label>
            <input
              type="text"
              defaultValue={node.label}
              className="w-full rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {node.category === 'input' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">Default Value</label>
            <textarea
              rows={3}
              placeholder="Default input value…"
              className="w-full resize-none rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {node.category === 'tool' && (
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-text-tertiary">Timeout (ms)</label>
            <input
              type="number"
              defaultValue={5000}
              className="w-full rounded-xl border border-border/60 bg-surface-hover px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        )}

        {/* Connection info */}
        <div className="rounded-xl border border-border/40 bg-surface-hover/50 px-3 py-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-text-tertiary">Connections</p>
          <div className="space-y-1.5">
            {CONNECTIONS.filter(([s, t]) => s === node.id || t === node.id).map(([s, t]) => {
              const other = getNodeById(s === node.id ? t : s)
              const isOut = s === node.id
              return other ? (
                <div key={`${s}-${t}`} className="flex items-center gap-2 text-xs text-text-secondary">
                  <div className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[other.category].dot}`} />
                  {isOut ? '→' : '←'} {other.label}
                </div>
              ) : null
            })}
          </div>
        </div>
      </div>

      {/* Delete button */}
      <div className="border-t border-border/60 px-4 py-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10">
          <Trash2 size={14} />
          Delete Node
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CanvasPage() {
  const router = useRouter()
  const [canvasName, setCanvasName] = useState('Untitled Canvas')
  const [editingName, setEditingName] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n3')
  const [isRunning, setIsRunning] = useState(false)
  const [runHistory, setRunHistory] = useState<RunRecord[]>(INITIAL_RUNS)
  const [notification, setNotification] = useState<string | null>(null)
  const [bottomOpen, setBottomOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'logs'>('history')
  const [expandedCategories, setExpandedCategories] = useState<Record<NodeCategory, boolean>>({
    input: true, model: true, tool: false, output: false,
  })
  const [canvasMode, setCanvasMode] = useState<'select' | 'pan' | 'connect'>('select')
  const [zoom, setZoom] = useState(100)
  const [showGrid, setShowGrid] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)

  const selectedNode = selectedNodeId ? CANVAS_NODES.find((n) => n.id === selectedNodeId) ?? null : null

  function handleRun() {
    if (isRunning) return
    setIsRunning(true)
    setTimeout(() => {
      setIsRunning(false)
      const newRun: RunRecord = {
        timestamp: 'Just now',
        status: 'success',
        duration: (2 + Math.random()).toFixed(1) + 's',
        nodes: 6,
      }
      setRunHistory((prev) => [newRun, ...prev])
      setNotification('Workflow completed successfully — 6 nodes executed')
      setTimeout(() => setNotification(null), 3500)
    }, 2200)
  }

  function toggleCategory(cat: NodeCategory) {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const canvasSVGWidth = 960
  const canvasSVGHeight = 460

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">

      {/* ── Success Notification ─────────────────────────────────────────── */}
      {notification && (
        <div
          className="pointer-events-none fixed right-5 top-5 z-[100] flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-bg px-4 py-3 shadow-xl"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(52,211,153,0.2)' }}
        >
          <CheckCircle size={16} className="text-emerald-400" />
          <p className="text-sm text-text-primary">{notification}</p>
        </div>
      )}

      {/* ── TOP TOOLBAR ─────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5"
        style={{ background: 'rgba(20,23,34,0.95)', backdropFilter: 'blur(12px)' }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/hub')}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
              <Layers size={14} className="text-violet-400" />
            </div>
            <span className="font-display text-sm font-medium text-text-primary">AI Canvas</span>
            <span className="pill text-[10px] text-violet-400">Beta</span>
          </div>
        </div>

        {/* Center — Canvas name */}
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={canvasName}
              onChange={(e) => setCanvasName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              className="rounded-lg border border-border/80 bg-surface-hover px-3 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              {canvasName}
              <Wand2 size={12} className="text-text-tertiary" />
            </button>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
            <Share2 size={13} />
            Share
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-border/60 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
            <Download size={13} />
            Export
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-semibold text-white transition-all disabled:opacity-70"
            style={{
              background: isRunning
                ? 'rgba(91,140,255,0.5)'
                : 'linear-gradient(135deg, #5B8CFF, #818CF8)',
              boxShadow: isRunning ? 'none' : '0 0 20px rgba(91,140,255,0.4)',
            }}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isRunning ? 'Running…' : 'Run Workflow'}
          </button>
        </div>
      </div>

      {/* ── BODY: LEFT SIDEBAR + CANVAS + RIGHT SIDEBAR ─────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <div
          className="flex w-[240px] shrink-0 flex-col border-r border-border/60"
          style={{ background: 'rgba(20,23,34,0.8)' }}
        >
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-text-tertiary">Add Nodes</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {NODE_LIBRARY.map(({ category, nodes }) => (
              <LibrarySection
                key={category}
                category={category}
                nodes={nodes}
                expanded={expandedCategories[category]}
                onToggle={() => toggleCategory(category)}
              />
            ))}
          </div>
        </div>

        {/* ── MAIN CANVAS ──────────────────────────────────────────────── */}
        <div className="relative flex flex-1 flex-col min-w-0 min-h-0">

          {/* Canvas toolbar strip */}
          <div
            className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 px-4 py-2"
            style={{ background: 'rgba(15,17,21,0.6)' }}
          >
            <div className="flex items-center gap-1">
              {/* Zoom controls */}
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="flex h-7 items-center justify-center rounded-lg px-2 font-mono text-[11px] text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {zoom}%
              </button>
              <button
                onClick={() => setZoom(100)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <Maximize2 size={13} />
              </button>

              <div className="mx-1.5 h-4 w-px bg-border/60" />

              {/* Mode buttons */}
              {(['select', 'pan', 'connect'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCanvasMode(mode)}
                  className={`h-7 rounded-lg px-2.5 text-xs capitalize transition-colors ${
                    canvasMode === mode
                      ? 'bg-surface-active text-text-primary'
                      : 'text-text-tertiary hover:bg-surface-hover hover:text-text-secondary'
                  }`}
                >
                  {mode}
                </button>
              ))}

              <div className="mx-1.5 h-4 w-px bg-border/60" />

              {/* Toggle buttons */}
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`h-7 rounded-lg px-2.5 text-xs transition-colors ${
                  showGrid ? 'bg-surface-active text-text-primary' : 'text-text-tertiary hover:bg-surface-hover'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setShowMinimap(!showMinimap)}
                className={`h-7 rounded-lg px-2.5 text-xs transition-colors ${
                  showMinimap ? 'bg-surface-active text-text-primary' : 'text-text-tertiary hover:bg-surface-hover'
                }`}
              >
                Minimap
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isRunning && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-blue-400" />
                  <span className="font-mono text-xs text-blue-400">Executing…</span>
                </div>
              )}
              <button className="flex h-7 w-7 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Canvas area */}
          <div
            className="relative flex-1 overflow-hidden"
            style={{
              background: showGrid
                ? `
                    linear-gradient(rgba(42,47,58,0.5) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(42,47,58,0.5) 1px, transparent 1px),
                    linear-gradient(rgba(42,47,58,0.2) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(42,47,58,0.2) 1px, transparent 1px),
                    #0F1115
                  `
                : '#0F1115',
              backgroundSize: showGrid ? '60px 60px, 60px 60px, 12px 12px, 12px 12px' : undefined,
            }}
          >
            {/* Canvas transform wrapper */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease',
              }}
            >
              {/* SVG connections */}
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {CONNECTIONS.map(([s, t]) => (
                  <Connection key={`${s}-${t}`} sourceId={s} targetId={t} isRunning={isRunning} />
                ))}
              </svg>

              {/* Canvas nodes */}
              <div style={{ position: 'relative', width: canvasSVGWidth, height: canvasSVGHeight, margin: '60px auto 0' }}>
                {CANVAS_NODES.map((node) => (
                  <CanvasNodeCard
                    key={node.id}
                    node={node}
                    selected={selectedNodeId === node.id}
                    onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
                  />
                ))}
              </div>
            </div>

            {/* Minimap */}
            {showMinimap && (
              <div
                className="absolute bottom-4 right-4 rounded-xl border border-border/60 shadow-xl"
                style={{ width: 140, height: 90, background: 'rgba(15,17,21,0.92)', backdropFilter: 'blur(8px)' }}
              >
                <div className="flex items-center justify-between border-b border-border/40 px-2 py-1">
                  <span className="font-mono text-[9px] text-text-tertiary">MINIMAP</span>
                </div>
                <div className="relative m-1.5" style={{ height: 66 }}>
                  {CANVAS_NODES.map((node) => {
                    const colors = CATEGORY_COLORS[node.category]
                    return (
                      <div
                        key={node.id}
                        style={{
                          position: 'absolute',
                          left: (node.x / 960) * 120,
                          top: (node.y / 460) * 56,
                          width: 24,
                          height: 10,
                          borderRadius: 3,
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          opacity: selectedNodeId === node.id ? 1 : 0.7,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty area hint */}
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] text-text-tertiary opacity-40">
              Click nodes to select · Drag to rearrange · Scroll to zoom
            </p>
          </div>

          {/* ── Floating action panel ─────────────────────────────────── */}
          <div
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border/60 px-3 py-2 shadow-2xl"
            style={{ background: 'rgba(20,23,34,0.95)', backdropFilter: 'blur(16px)' }}
          >
            <button className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
              <Plus size={14} />
            </button>
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5B8CFF, #818CF8)', boxShadow: '0 0 14px rgba(91,140,255,0.35)' }}
            >
              <Play size={12} />
              Run
            </button>
            <div className="h-4 w-px bg-border/60" />
            <span className="font-mono text-[11px] text-text-tertiary">
              {CANVAS_NODES.length} nodes · {CONNECTIONS.length} connections
            </span>
          </div>

          {/* ── BOTTOM PANEL: Run History ─────────────────────────────── */}
          <div
            className="shrink-0 border-t border-border/60"
            style={{ background: 'rgba(15,17,21,0.9)', backdropFilter: 'blur(8px)' }}
          >
            {/* Tab bar */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-1">
                {(['history', 'logs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setBottomOpen(true) }}
                    className={`h-7 rounded-lg px-3 text-xs capitalize transition-colors ${
                      activeTab === tab && bottomOpen
                        ? 'bg-surface-active text-text-primary'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {tab === 'history' ? 'Run History' : 'Logs'}
                  </button>
                ))}
                <span className="ml-2 font-mono text-[10px] text-text-tertiary">
                  {runHistory.length} runs
                </span>
              </div>
              <button
                onClick={() => setBottomOpen(!bottomOpen)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {bottomOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            </div>

            {/* Expanded content */}
            {bottomOpen && (
              <div className="border-t border-border/40 px-4 pb-3 pt-2">
                {activeTab === 'history' ? (
                  <div className="space-y-1.5">
                    {runHistory.slice(0, 4).map((run, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-4 rounded-xl border border-border/40 bg-surface-hover/50 px-3 py-2"
                      >
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${run.status === 'success' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                          {run.status === 'success'
                            ? <CheckCircle size={11} className="text-emerald-400" />
                            : <X size={11} className="text-red-400" />
                          }
                        </div>
                        <span className="font-mono text-xs text-text-tertiary">{run.timestamp}</span>
                        <span className={`text-xs font-medium ${run.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {run.status}
                        </span>
                        <span className="font-mono text-xs text-text-tertiary">{run.duration}</span>
                        <span className="text-xs text-text-tertiary">{run.nodes} nodes</span>
                        {run.error && (
                          <span className="ml-auto truncate text-xs text-red-400/70">{run.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/40 bg-black/30 p-3 font-mono text-[11px] text-text-secondary space-y-1">
                    <p><span className="text-text-tertiary">[14:23:01]</span> Workflow started — 6 nodes queued</p>
                    <p><span className="text-text-tertiary">[14:23:01]</span> <span className="text-emerald-400">▸</span> Node: User Prompt — resolved</p>
                    <p><span className="text-text-tertiary">[14:23:02]</span> <span className="text-emerald-400">▸</span> Node: File Upload — resolved</p>
                    <p><span className="text-text-tertiary">[14:23:02]</span> <span className="text-violet-400">▸</span> Node: Web Search — fetching…</p>
                    <p><span className="text-text-tertiary">[14:23:03]</span> <span className="text-violet-400">▸</span> Node: Document Parser — complete</p>
                    <p><span className="text-text-tertiary">[14:23:03]</span> <span className="text-blue-400">▸</span> Node: Gemini 2.0 Flash — streaming response…</p>
                    <p><span className="text-text-tertiary">[14:23:04]</span> <span className="text-orange-400">▸</span> Node: Text Output — rendered</p>
                    <p><span className="text-text-tertiary">[14:23:04]</span> <span className="text-emerald-400">✓</span> Workflow complete in 3.2s</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: Inspector ──────────────────────────────────── */}
        <div
          className="flex w-[260px] shrink-0 flex-col border-l border-border/60"
          style={{ background: 'rgba(20,23,34,0.8)' }}
        >
          {selectedNode ? (
            <InspectorPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-surface-hover">
                <Layers size={20} className="text-text-tertiary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">Node Inspector</p>
                <p className="mt-1 text-xs leading-5 text-text-tertiary">Click any node on the canvas to inspect and configure it</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
