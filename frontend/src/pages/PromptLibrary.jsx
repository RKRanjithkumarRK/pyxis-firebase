/**
 * Prompt Library — browse/save/use prompts (My Library tab)
 *                  + AI Prompt Engineer tool (second tab)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Library, Plus, Search, Tag, Copy, Send, Trash2,
  Globe, Lock, Star, Edit3, Check, X, Filter,
  Wand2, Loader2, Brain, Sparkles, Target, ChevronDown, ChevronUp,
  BarChart3, BookOpen, Zap, RefreshCw, Save,
} from 'lucide-react'
import { apiJSON, streamChat } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',        label: 'All',          emoji: '✨' },
  { id: 'general',   label: 'General',      emoji: '💬' },
  { id: 'coding',    label: 'Coding',       emoji: '💻' },
  { id: 'writing',   label: 'Writing',      emoji: '✍️' },
  { id: 'research',  label: 'Research',     emoji: '🔍' },
  { id: 'business',  label: 'Business',     emoji: '📊' },
  { id: 'creative',  label: 'Creative',     emoji: '🎨' },
  { id: 'education', label: 'Education',    emoji: '📚' },
  { id: 'marketing', label: 'Marketing',    emoji: '📣' },
]

const STARTER_PROMPTS = [
  { title: 'Code Review Expert',       category: 'coding',   content: 'Review this code for bugs, performance issues, and best practice violations. Provide specific, actionable feedback with examples of how to fix each issue.',                                                         tags: ['code', 'review'] },
  { title: 'Technical Blog Writer',    category: 'writing',  content: 'Write a detailed technical blog post about [topic]. Include code examples, real-world use cases, and target intermediate developers. Make it engaging and SEO-friendly.',                                            tags: ['writing', 'technical'] },
  { title: 'Market Research Analyst',  category: 'research', content: 'Analyze the market for [product/service]. Include market size, key competitors, target demographics, growth trends, and barriers to entry. Provide data-backed insights.',                                          tags: ['research', 'business'] },
  { title: 'Product Requirements Doc', category: 'business', content: 'Create a detailed PRD for [feature/product]. Include problem statement, target users, user stories, acceptance criteria, success metrics, and technical requirements.',                                               tags: ['product', 'business'] },
  { title: 'System Architecture',      category: 'coding',   content: 'Design a scalable system architecture for [application]. Include database design, API structure, caching strategy, authentication flow, and deployment considerations.',                                              tags: ['architecture', 'coding'] },
  { title: 'Creative Story Starter',   category: 'creative', content: 'Write the opening chapter of a [genre] story set in [setting]. Establish compelling characters, atmospheric world-building, and a hook that leaves the reader wanting more.',                                       tags: ['creative', 'writing'] },
]

const FRAMEWORKS = [
  { id: 'RISEN',          label: 'RISEN',           desc: 'Role · Instructions · Steps · End goal · Narrowing',         color: '#6366f1' },
  { id: 'COSTAR',         label: 'COSTAR',          desc: 'Context · Objective · Style · Tone · Audience · Response',   color: '#8b5cf6' },
  { id: 'APE',            label: 'APE',             desc: 'Action · Purpose · Expectation',                             color: '#ec4899' },
  { id: 'Few-Shot',       label: 'Few-Shot',        desc: 'Provide examples to guide the AI',                           color: '#f59e0b' },
  { id: 'Chain-of-Thought', label: 'Chain-of-Thought', desc: 'Step-by-step reasoning prompts',                         color: '#10b981' },
]

const REFINE_DIRECTIONS = ['Concise', 'Creative', 'Technical', 'Formal']

const SCORE_LABELS = [
  { key: 'clarity',       label: 'Clarity',       color: '#6366f1' },
  { key: 'specificity',   label: 'Specificity',   color: '#8b5cf6' },
  { key: 'creativity',    label: 'Creativity',    color: '#ec4899' },
  { key: 'effectiveness', label: 'Effectiveness', color: '#10b981' },
]

// ─── PromptCard ───────────────────────────────────────────────────────────────

function PromptCard({ prompt, onDelete, onEdit, onUseInChat }) {
  const [editing, setEditing]     = useState(false)
  const [editTitle, setEditTitle] = useState(prompt.title)

  const saveEdit = async () => {
    if (!editTitle.trim()) return
    try {
      await apiJSON(`/api/prompts/${prompt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle }),
      })
      onEdit(prompt.id, { title: editTitle })
      setEditing(false)
      toast.success('Updated')
    } catch { toast.error('Update failed') }
  }

  return (
    <div
      className="card p-4 group transition-colors"
      style={{ borderColor: 'var(--border-color)' }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        {editing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              className="input text-sm flex-1 py-1"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              autoFocus
            />
            <button onClick={saveEdit} style={{ color: '#4ade80' }}>
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditing(false)} style={{ color: 'var(--text-muted)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
            {prompt.title}
          </h3>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1"
            style={{ color: 'var(--text-muted)' }}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(prompt.id)}
            className="p-1 hover:text-red-400"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {prompt.description && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          {prompt.description}
        </p>
      )}

      <p
        className="text-xs line-clamp-3 rounded-lg p-2.5 font-mono leading-relaxed mb-3"
        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-input)' }}
      >
        {prompt.content}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        {prompt.scope === 'public' ? (
          <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
            <Globe className="w-3 h-3" /> Public
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)' }}
          >
            <Lock className="w-3 h-3" /> Personal
          </span>
        )}
        {(prompt.tags || []).map(tag => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)' }}
          >
            #{tag}
          </span>
        ))}
        {prompt.usageCount > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {prompt.usageCount} uses
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => { navigator.clipboard.writeText(prompt.content); toast.success('Copied!') }}
          className="btn-ghost text-xs gap-1 flex-1 justify-center"
        >
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        <button
          onClick={() => onUseInChat(prompt)}
          className="btn-primary text-xs gap-1 flex-1 justify-center"
        >
          <Send className="w-3.5 h-3.5" /> Use in Chat
        </button>
      </div>
    </div>
  )
}

// ─── CreateModal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '', content: '', description: '', category: 'general',
    tags: '', scope: 'personal',
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      }
      const created = await apiJSON('/api/prompts', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      onCreate(created)
      onClose()
      toast.success('Prompt saved!')
    } catch { toast.error('Failed to create prompt') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-2xl p-6 w-full max-w-lg shadow-2xl border"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Create Prompt
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. Code Review Expert"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Prompt Content *</label>
            <textarea
              className="input w-full text-sm resize-none font-mono"
              rows={5}
              placeholder="Write your prompt here. Use [brackets] for variables."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Description (optional)</label>
            <input
              className="input w-full text-sm"
              placeholder="Brief description of what this prompt does"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Category</label>
              <select
                className="input w-full text-sm"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Visibility</label>
              <select
                className="input w-full text-sm"
                value={form.scope}
                onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              >
                <option value="personal">🔒 Personal</option>
                <option value="public">🌐 Public</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tags (comma-separated)</label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. code, review, python"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-input)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ─── CopyBox ──────────────────────────────────────────────────────────────────

function CopyBox({ label, content }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs transition-colors"
          style={{ color: copied ? '#4ade80' : 'var(--text-muted)' }}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre
        className="p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed"
        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
      >
        {content}
      </pre>
    </div>
  )
}

// ─── AIPromptEngineer tab ─────────────────────────────────────────────────────

function AIPromptEngineer({ onSaveToLibrary }) {
  const navigate = useNavigate()
  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()

  const [framework,   setFramework]   = useState('RISEN')
  const [task,        setTask]        = useState('')
  const [audience,    setAudience]    = useState('')
  const [tone,        setTone]        = useState('')
  const [constraints, setConstraints] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [engineering, setEngineering] = useState(false)
  const [generated,   setGenerated]   = useState(null)

  const engineerPrompt = () => {
    if (!task.trim()) { toast.error('Please describe what you want the AI to do'); return }
    setEngineering(true)
    setGenerated(null)
    let full = ''

    const systemInstruction = `You are an expert prompt engineer. Generate a professional AI prompt using the ${framework} framework.

Output your response in this EXACT JSON format (no markdown, just JSON):
{
  "system_prompt": "The system/persona prompt...",
  "user_template": "The user message template with [VARIABLES] in brackets...",
  "examples": [
    {"user": "Example user message 1", "assistant": "Example response 1"},
    {"user": "Example user message 2", "assistant": "Example response 2"},
    {"user": "Example user message 3", "assistant": "Example response 3"}
  ],
  "scores": {
    "clarity": 85,
    "specificity": 90,
    "creativity": 70,
    "effectiveness": 88
  },
  "title": "Short title for this prompt",
  "description": "One sentence description"
}`

    const wsCtx = getContextString()
    streamChat(
      {
        message: `Create a ${framework} framework prompt for: "${task}"\nTarget audience: ${audience || 'general'}\nTone: ${tone || 'professional'}\nConstraints: ${constraints || 'none'}`,
        model: 'gemini-2.5-flash',
        systemPrompt: wsCtx ? `${wsCtx}\n\n---\n\n${systemInstruction}` : systemInstruction,
      },
      token => { full += token },
      () => {
        try {
          const clean = full.replace(/```json\n?|\n?```/g, '').trim()
          const parsed = JSON.parse(clean)
          setGenerated(parsed)
        } catch {
          toast.error('Could not parse generated prompt')
        }
        setEngineering(false)
      },
      err => { toast.error(err.message); setEngineering(false) },
      '/api/tool-chat',
    )
  }

  const refinePrompt = (direction) => {
    if (!generated) return
    setEngineering(true)
    let full = ''
    streamChat(
      {
        message: `Refine this prompt to be more ${direction}. Return the same JSON structure with improved content:\n${JSON.stringify(generated)}`,
        model: 'gemini-2.5-flash',
      },
      token => { full += token },
      () => {
        try {
          const clean = full.replace(/```json\n?|\n?```/g, '').trim()
          setGenerated(JSON.parse(clean))
        } catch {}
        setEngineering(false)
      },
      err => { toast.error(err.message); setEngineering(false) },
      '/api/tool-chat',
    )
  }

  const testInChat = () => {
    if (!generated) return
    const combined = `${generated.system_prompt}\n\n---\n\n${generated.user_template}`
    if (activeWorkspace) {
      addArtifact({ type: 'prompt', title: generated.title || 'Engineered prompt', content: combined.slice(0, 400), source: '/prompts' })
    }
    sessionStorage.setItem('pyxis_starter_prompt', combined)
    navigate('/chat')
    toast.success('Opening in Chat…')
  }

  const saveToLibrary = async () => {
    if (!generated) return
    try {
      await apiJSON('/api/prompts', {
        method: 'POST',
        body: JSON.stringify({
          title: generated.title,
          content: `${generated.system_prompt}\n\n---\n\n${generated.user_template}`,
          description: generated.description,
          category: 'general',
          tags: [framework.toLowerCase(), 'ai-generated'],
          scope: 'personal',
        }),
      })
      toast.success('Saved to library!')
      onSaveToLibrary?.()
    } catch { toast.error('Save failed') }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* ── Left column: inputs ── */}
      <div className="space-y-5">

        {/* Framework picker */}
        <div>
          <label className="block text-xs font-semibold mb-3 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            Prompt Framework
          </label>
          <div className="space-y-2">
            {FRAMEWORKS.map(fw => (
              <button
                key={fw.id}
                onClick={() => setFramework(fw.id)}
                className="w-full text-left rounded-xl border p-3 transition-all"
                style={{
                  borderColor: framework === fw.id ? fw.color : 'var(--border-color)',
                  backgroundColor: framework === fw.id ? `${fw.color}15` : 'var(--bg-card)',
                  boxShadow: framework === fw.id ? `0 0 0 1px ${fw.color}40` : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: framework === fw.id ? fw.color : 'var(--bg-input)',
                      color: framework === fw.id ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {fw.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fw.desc}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Task input */}
        <div>
          <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            What do you want the AI to do?
          </label>
          <textarea
            className="input w-full text-sm resize-none"
            rows={4}
            placeholder="Describe your task in detail… e.g. 'Write engaging product descriptions for an e-commerce store that sells handmade jewelry'"
            value={task}
            onChange={e => setTask(e.target.value)}
          />
        </div>

        {/* Optional fields */}
        <div>
          <button
            onClick={() => setShowOptional(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {showOptional ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Optional Context
          </button>
          {showOptional && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Target Audience</label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. Busy professionals, beginner developers…"
                  value={audience}
                  onChange={e => setAudience(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Tone</label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. Friendly, authoritative, conversational…"
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Constraints</label>
                <input
                  className="input w-full text-sm"
                  placeholder="e.g. Max 200 words, no jargon, include a CTA…"
                  value={constraints}
                  onChange={e => setConstraints(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Engineer button */}
        <button
          onClick={engineerPrompt}
          disabled={engineering || !task.trim()}
          className="btn-primary w-full gap-2 justify-center py-2.5"
        >
          {engineering
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Engineering…</>
            : <><Sparkles className="w-4 h-4" /> Engineer Prompt</>
          }
        </button>

        {/* Refine buttons (after generation) */}
        {generated && (
          <div>
            <label className="block text-xs font-semibold mb-2 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
              Refine
            </label>
            <div className="flex flex-wrap gap-2">
              {REFINE_DIRECTIONS.map(dir => (
                <button
                  key={dir}
                  onClick={() => refinePrompt(dir.toLowerCase())}
                  disabled={engineering}
                  className="btn-ghost text-xs gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  More {dir}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right column: output ── */}
      <div>
        {!generated && !engineering && (
          <div
            className="rounded-2xl border flex flex-col items-center justify-center py-20 text-center"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
          >
            <Brain className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Your engineered prompt will appear here
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              Select a framework, describe your task, then click Engineer Prompt
            </p>
          </div>
        )}

        {engineering && !generated && (
          <div
            className="rounded-2xl border flex flex-col items-center justify-center py-20 text-center"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
          >
            <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: '#6366f1' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Crafting your professional prompt…
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Applying the {framework} framework
            </p>
          </div>
        )}

        {generated && (
          <div className="space-y-4">
            {/* Header */}
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {generated.title}
                </h2>
                <span
                  className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: (FRAMEWORKS.find(f => f.id === framework)?.color ?? '#6366f1') + '20',
                    color: FRAMEWORKS.find(f => f.id === framework)?.color ?? '#6366f1',
                  }}
                >
                  {framework}
                </span>
              </div>
              {generated.description && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {generated.description}
                </p>
              )}
            </div>

            {/* System Prompt */}
            <CopyBox label="System Prompt" content={generated.system_prompt} />

            {/* User Template */}
            <CopyBox label="User Template" content={generated.user_template} />

            {/* Example exchanges */}
            {generated.examples?.length > 0 && (
              <div
                className="rounded-2xl border p-5"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4" style={{ color: '#6366f1' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Example Exchanges
                  </h3>
                </div>
                <div className="space-y-4">
                  {generated.examples.map((ex, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex gap-2">
                        <div
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ backgroundColor: '#6366f120', color: '#6366f1' }}
                        >
                          U
                        </div>
                        <p
                          className="text-xs rounded-xl rounded-tl-none px-3 py-2 flex-1"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                        >
                          {ex.user}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-row-reverse">
                        <div
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ backgroundColor: '#10b98120', color: '#10b981' }}
                        >
                          A
                        </div>
                        <p
                          className="text-xs rounded-xl rounded-tr-none px-3 py-2 flex-1"
                          style={{ backgroundColor: '#10b98110', color: 'var(--text-secondary)' }}
                        >
                          {ex.assistant}
                        </p>
                      </div>
                      {i < generated.examples.length - 1 && (
                        <hr style={{ borderColor: 'var(--border-color)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score panel */}
            {generated.scores && (
              <div
                className="rounded-2xl border p-5"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Prompt Quality Scores
                  </h3>
                </div>
                <div className="space-y-3">
                  {SCORE_LABELS.map(({ key, label, color }) => (
                    <ScoreBar
                      key={key}
                      label={label}
                      value={generated.scores[key] ?? 0}
                      color={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex gap-3">
              <button
                onClick={testInChat}
                className="btn-ghost gap-2 flex-1 justify-center"
                disabled={engineering}
              >
                <Send className="w-4 h-4" />
                Test in Chat
              </button>
              <button
                onClick={saveToLibrary}
                className="btn-primary gap-2 flex-1 justify-center"
                disabled={engineering}
              >
                <Save className="w-4 h-4" />
                Save to Library
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MyLibrary tab ────────────────────────────────────────────────────────────

function MyLibrary({ refreshKey }) {
  const navigate                    = useNavigate()
  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()
  const [prompts, setPrompts]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [category, setCategory]     = useState('all')
  const [search, setSearch]         = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [scope, setScope]           = useState('all')

  const load = () => {
    setLoading(true)
    apiJSON('/api/prompts')
      .then(data => {
        setPrompts(data.length
          ? data
          : STARTER_PROMPTS.map((p, i) => ({ ...p, id: `starter-${i}`, isTemplate: true, usageCount: 0 }))
        )
      })
      .catch(() =>
        setPrompts(STARTER_PROMPTS.map((p, i) => ({ ...p, id: `starter-${i}`, isTemplate: true, usageCount: 0 })))
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [refreshKey])

  const deletePrompt = async (id) => {
    if (String(id).startsWith('starter-')) {
      setPrompts(p => p.filter(x => x.id !== id))
      return
    }
    try {
      await apiJSON(`/api/prompts/${id}`, { method: 'DELETE' })
      setPrompts(p => p.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  const editPrompt = (id, updates) => {
    setPrompts(p => p.map(x => x.id === id ? { ...x, ...updates } : x))
  }

  const useInChat = (prompt) => {
    if (activeWorkspace) {
      addArtifact({ type: 'prompt', title: prompt.title || 'Prompt template', content: prompt.content.slice(0, 400), source: '/prompts' })
    }
    sessionStorage.setItem('pyxis_starter_prompt', prompt.content)
    navigate('/chat')
    toast.success('Opening in Chat…')
  }

  const filtered = prompts.filter(p => {
    const matchesCategory = category === 'all' || p.category === category
    const matchesScope    = scope === 'all' || p.scope === scope
    const matchesSearch   = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    return matchesCategory && matchesScope && matchesSearch
  })

  return (
    <>
      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all"
            style={{
              backgroundColor: category === c.id ? '#7c3aed' : 'var(--bg-input)',
              color: category === c.id ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {/* Search + scope filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input pl-9 w-full text-sm"
            placeholder="Search prompts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'personal', 'public'].map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="px-3 py-1.5 rounded-lg text-xs capitalize transition-all"
              style={{
                backgroundColor: scope === s ? 'var(--bg-input)' : 'transparent',
                color: scope === s ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {s === 'all' ? '🌐 All' : s === 'personal' ? '🔒 Personal' : '🌍 Public'}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        {filtered.length} prompt{filtered.length !== 1 ? 's' : ''}
      </p>

      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Loading prompts…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <PromptCard
              key={p.id}
              prompt={p}
              onDelete={deletePrompt}
              onEdit={editPrompt}
              onUseInChat={useInChat}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <Library className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No prompts found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                Create your first prompt to get started
              </p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={p => setPrompts(prev => [p, ...prev])}
        />
      )}

      {/* Floating create button stored via state passed from parent */}
      <div id="__library-create-trigger" data-show={String(showCreate)} style={{ display: 'none' }} />
    </>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PromptLibrary() {
  const [activeTab,    setActiveTab]    = useState('library')  // 'library' | 'engineer'
  const [showCreate,   setShowCreate]   = useState(false)
  const [libraryKey,   setLibraryKey]   = useState(0)

  // Bump key to reload library after AI engineer saves a prompt
  const handleEngineerSave = () => setLibraryKey(k => k + 1)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: '#6366f115' }}>
            <Library className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Prompt Library
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Save, organize, and engineer professional prompts
            </p>
          </div>
        </div>
        {activeTab === 'library' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" /> New Prompt
          </button>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ backgroundColor: 'var(--bg-input)' }}
      >
        <button
          onClick={() => setActiveTab('library')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'library' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'library' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'library' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          <BookOpen className="w-4 h-4" />
          My Library
        </button>
        <button
          onClick={() => setActiveTab('engineer')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: activeTab === 'engineer' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'engineer' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'engineer' ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          <Wand2 className="w-4 h-4" />
          AI Prompt Engineer
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-bold"
            style={{ backgroundColor: '#6366f130', color: '#818cf8' }}
          >
            NEW
          </span>
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'library' ? (
        <MyLibrary
          refreshKey={libraryKey}
          onShowCreate={() => setShowCreate(true)}
        />
      ) : (
        <AIPromptEngineer onSaveToLibrary={handleEngineerSave} />
      )}

      {/* Create modal (for library tab) */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={p => { setLibraryKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
