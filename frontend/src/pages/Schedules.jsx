/**
 * Scheduled AI Tasks — run AI prompts on a recurring schedule.
 * Unique enterprise feature — no competitor has this.
 */
import { useState, useEffect } from 'react'
import {
  CalendarClock, Plus, Play, Trash2, Power, Edit3,
  Clock, CheckCircle, AlertCircle, ChevronDown, X, Zap,
} from 'lucide-react'
import { apiJSON } from '../utils/api'
import toast from 'react-hot-toast'

const CRON_OPTIONS = [
  { id: 'hourly',  label: 'Every Hour',  emoji: '⏰' },
  { id: 'daily',   label: 'Daily',       emoji: '📅' },
  { id: 'weekly',  label: 'Weekly',      emoji: '📆' },
  { id: 'monthly', label: 'Monthly',     emoji: '🗓️' },
]

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

const STARTER_SCHEDULES = [
  {
    name: 'Daily News Briefing',
    prompt: 'Provide a concise briefing of the most important global technology news today. Format as bullet points with 1-sentence summaries.',
    cronLabel: 'daily',
    model: 'gemini-2.5-flash',
  },
  {
    name: 'Weekly Market Summary',
    prompt: 'Summarize key financial market trends, notable stock movements, and economic indicators from this week. Keep it under 300 words.',
    cronLabel: 'weekly',
    model: 'gemini-2.5-flash',
  },
  {
    name: 'Daily Code Review Reminder',
    prompt: 'Give me 3 software engineering best practices I should focus on today. Make them practical and specific.',
    cronLabel: 'daily',
    model: 'gemini-2.0-flash',
  },
]

function ScheduleCard({ schedule, onDelete, onToggle, onResult }) {
  const [running,    setRunning]    = useState(false)
  const [showResult, setShowResult] = useState(false)

  const runNow = async () => {
    setRunning(true)
    try {
      const res = await apiJSON(`/api/schedules/${schedule.id}/run-now`, { method: 'POST' })
      onResult(schedule.id, res.result)
      setShowResult(true)
      toast.success('Task executed successfully!')
    } catch (e) {
      toast.error('Execution failed: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  const cron = CRON_OPTIONS.find(c => c.id === schedule.cronLabel) || CRON_OPTIONS[1]

  return (
    <div className={`card p-4 transition-all ${!schedule.enabled ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{cron.emoji}</span>
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {schedule.name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
            >
              {cron.label}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{schedule.model}</span>
            {schedule.runCount > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{schedule.runCount} runs</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onToggle(schedule.id, !schedule.enabled)}
            className="p-1.5 rounded-lg transition-colors"
            style={schedule.enabled ? {
              color: '#4ade80',
              backgroundColor: 'rgba(74,222,128,0.1)',
            } : {
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-input)',
            }}
            title={schedule.enabled ? 'Disable' : 'Enable'}
            onMouseEnter={e => {
              if (schedule.enabled) e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.2)'
              else e.currentTarget.style.backgroundColor = 'var(--bg-card)'
            }}
            onMouseLeave={e => {
              if (schedule.enabled) e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.1)'
              else e.currentTarget.style.backgroundColor = 'var(--bg-input)'
            }}
          >
            <Power className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(schedule.id)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.backgroundColor = 'rgba(248,113,113,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Prompt preview */}
      <p
        className="text-xs rounded-lg p-2.5 line-clamp-2 mb-3 font-mono"
        style={{ color: 'var(--text-muted)', backgroundColor: 'color-mix(in srgb, var(--bg-app) 60%, transparent)' }}
      >
        {schedule.prompt}
      </p>

      {/* Last result */}
      {schedule.lastResult && (
        <div className="mb-3">
          <button
            onClick={() => setShowResult(v => !v)}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <CheckCircle className="w-3 h-3 text-green-400" />
            Last result
            <ChevronDown className={`w-3 h-3 transition-transform ${showResult ? 'rotate-180' : ''}`} />
          </button>
          {showResult && (
            <div
              className="mt-2 text-xs rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'color-mix(in srgb, var(--bg-app) 60%, transparent)',
                border: '1px solid var(--border-color)',
              }}
            >
              {schedule.lastResult}
            </div>
          )}
        </div>
      )}

      {/* Run now */}
      <button
        onClick={runNow}
        disabled={running}
        className="btn-primary w-full justify-center text-xs gap-1.5"
      >
        {running ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            Run Now
          </>
        )}
      </button>
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    prompt: '',
    model: 'gemini-2.5-flash',
    cronLabel: 'daily',
    enabled: true,
    systemPrompt: '',
  })
  const [saving, setSaving] = useState(false)

  const fromTemplate = (t) => {
    setForm(f => ({ ...f, name: t.name, prompt: t.prompt, cronLabel: t.cronLabel, model: t.model }))
  }

  const submit = async () => {
    if (!form.name.trim() || !form.prompt.trim()) {
      toast.error('Name and prompt are required')
      return
    }
    setSaving(true)
    try {
      const created = await apiJSON('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      onCreate(created)
      onClose()
      toast.success('Schedule created!')
    } catch { toast.error('Failed to create schedule') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>New Scheduled Task</h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates */}
        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Quick start templates:</p>
          <div className="flex flex-wrap gap-2">
            {STARTER_SCHEDULES.map(t => (
              <button
                key={t.name}
                onClick={() => fromTemplate(t)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Task Name *</label>
            <input
              className="input w-full text-sm"
              placeholder="e.g. Daily News Briefing"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Prompt *</label>
            <textarea
              className="input w-full text-sm resize-none"
              rows={4}
              placeholder="What should the AI do on each run?"
              value={form.prompt}
              onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Frequency</label>
              <select
                className="input w-full text-sm"
                value={form.cronLabel}
                onChange={e => setForm(f => ({ ...f, cronLabel: e.target.value }))}
              >
                {CRON_OPTIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Model</label>
              <select
                className="input w-full text-sm"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              >
                {MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating…' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Schedules() {
  const [schedules, setSchedules]   = useState([])
  const [loading,   setLoading]     = useState(true)
  const [showCreate,setShowCreate]  = useState(false)

  useEffect(() => {
    apiJSON('/api/schedules')
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false))
  }, [])

  const deleteSchedule = async (id) => {
    try {
      await apiJSON(`/api/schedules/${id}`, { method: 'DELETE' })
      setSchedules(p => p.filter(s => s.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Delete failed') }
  }

  const toggleSchedule = async (id, enabled) => {
    try {
      await apiJSON(`/api/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })
      setSchedules(p => p.map(s => s.id === id ? { ...s, enabled } : s))
    } catch { toast.error('Update failed') }
  }

  const setResult = (id, result) => {
    setSchedules(p => p.map(s => s.id === id ? { ...s, lastResult: result } : s))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" style={{ backgroundColor: 'var(--bg-app)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
            <CalendarClock className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Scheduled Tasks</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Automate AI workflows on a recurring schedule
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </div>

      {/* Info banner */}
      <div
        className="card p-4 mb-6 flex items-start gap-3"
        style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}
      >
        <Zap className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-primary-light)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-primary-light)' }}>Automated AI Tasks</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Create schedules to automatically run AI prompts. Results are saved to your conversations.
            Click "Run Now" to test any schedule immediately.
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          Loading schedules…
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20">
          <CalendarClock className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No scheduled tasks yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Create a schedule to automate AI workflows</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary gap-2">
            <Plus className="w-4 h-4" /> Create your first schedule
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map(s => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onDelete={deleteSchedule}
              onToggle={toggleSchedule}
              onRunNow={() => {}}
              onResult={setResult}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={s => setSchedules(p => [s, ...p])}
        />
      )}
    </div>
  )
}
