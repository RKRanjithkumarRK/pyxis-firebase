import { useState, useRef, useEffect } from 'react'
import {
  FlaskConical, Search, Loader2, CheckCircle2, Copy, Download,
  ExternalLink, ChevronRight, Sparkles, Globe, RefreshCw,
  ChevronDown, Paperclip, X, FileText, Image, Wand2, Zap,
  Clock, Trash2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSearchParams } from 'react-router-dom'
import { apiJSON, streamChat, parseFile } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

const LS_RESEARCH_HISTORY = 'pyxis_research_history'
const MAX_RESEARCH_HISTORY = 20

function loadResearchHistory() {
  try { return JSON.parse(localStorage.getItem(LS_RESEARCH_HISTORY) || '[]') } catch { return [] }
}
function saveResearchHistory(h) {
  try { localStorage.setItem(LS_RESEARCH_HISTORY, JSON.stringify(h.slice(0, MAX_RESEARCH_HISTORY))) } catch {}
}

const DEPTHS = [
  { id: 'rapid',     label: 'Rapid Scan',     desc: 'Quick briefing in ~30s',     icon: '⚡' },
  { id: 'strategic', label: 'Strategic Brief', desc: 'Balanced synthesis',          icon: '🎯' },
  { id: 'deep',      label: 'Deep Dossier',   desc: 'Comprehensive memo',          icon: '🔬' },
]

const STARTERS = [
  'GPT-4o vs Gemini 2.5 competitive landscape',
  'State of AI coding assistants 2025',
  'Retrieval-augmented generation market trends',
  'Open-source LLM ecosystem overview',
]

const STAGE_LABELS = {
  search:     'Discovering sources',
  synthesize: 'Synthesizing insights',
  done:       'Complete',
}

const MODELS = [
  { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash',    badge: 'Best'   },
  { id: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash',    badge: 'Fast'   },
  { id: 'gemini-2.0-flash-lite',       label: 'Gemini Lite',         badge: 'Lite'   },
  { id: 'llama-3.3-70b-versatile',     label: 'Llama 3.3 (Groq)',    badge: 'Fast'   },
  { id: 'llama-3.1-8b-instant',        label: 'Llama 3.1 8B (Groq)', badge: 'Instant'},
  { id: 'llama3.3-70b',                label: 'Llama 3.3 (Cerebras)',badge: '2k t/s' },
  { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini',         badge: 'Smart'  },
  { id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 (SambaNova)',badge: 'Free'  },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 (OR)', badge: 'Free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small', badge: 'Free' },
]

export default function Research() {
  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()
  const [searchParams] = useSearchParams()
  const [query,     setQuery]     = useState('')
  const [depth,     setDepth]     = useState('strategic')
  const [model,     setModel]     = useState('gemini-2.5-flash')
  const [stage,     setStage]     = useState(null)
  const [sources,   setSources]   = useState([])
  const [report,    setReport]    = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showModels, setShowModels] = useState(false)
  const [researchHistory, setResearchHistory] = useState(loadResearchHistory)
  const [showHistory, setShowHistory] = useState(true)
  // File upload state
  const [attachedFile,  setAttachedFile]  = useState(null)   // { name, text }
  const [parsingFile,   setParsing]       = useState(false)
  // Inline image generation
  const [visual,        setVisual]        = useState(null)   // { url, prompt, source }
  const [visualLoading, setVisualLoading] = useState(false)
  const fileInputRef = useRef(null)
  const modelPickerRef = useRef(null)
  const abortRef = useRef(null)

  const currentModel = MODELS.find(m => m.id === model) || MODELS[0]

  useEffect(() => {
    const voiceQuery = searchParams.get('q')
    if (voiceQuery) { setQuery(voiceQuery); setTimeout(() => run(voiceQuery), 300) }
    else if (activeWorkspace?.goal) { setQuery(activeWorkspace.goal) }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) setShowModels(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── File upload ────────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    try {
      const result = await parseFile(file)
      setAttachedFile({ name: file.name, text: result.text, chars: result.chars })
      toast.success(`${file.name} attached (${result.chars.toLocaleString()} chars)`)
    } catch (err) {
      toast.error(err.message || 'Could not parse file')
    } finally {
      setParsing(false)
    }
  }

  const run = async (q = query) => {
    if (!q.trim() || (stage && stage !== 'done') || streaming) return
    setQuery(q)
    setSources([])
    setReport('')
    setStage('synthesize')
    setStreaming(true)

    apiJSON(`/api/search?q=${encodeURIComponent(q)}`)
      .then(srcs => { if (srcs?.length) setSources(srcs) })
      .catch(() => {})

    const depthInstruction = {
      rapid:    'Write a concise 3-paragraph executive brief.',
      strategic:'Write a strategic brief with key findings, competitive signals, and 3 action items.',
      deep:     'Write a comprehensive deep dossier with sections: Executive Summary, Key Trends, Competitive Landscape, Opportunities & Risks, and Strategic Recommendations.',
    }[depth]

    const fileContext = attachedFile
      ? `\n\n[Attached Document: ${attachedFile.name}]\n${attachedFile.text.slice(0, 8000)}\n[End of Document]\n\n`
      : ''

    const prompt = `Research topic: "${q}"${fileContext}\n${depthInstruction}\n\nBased on your knowledge${attachedFile ? ' and the attached document' : ''}, provide a high-quality research brief. Format with markdown.`

    const wsContext = getContextString()
    const baseSystem = 'You are Pyxis Research, an expert analyst. Produce high-quality research briefs with structured insights and actionable recommendations.'
    let fullReport = ''
    abortRef.current = streamChat(
      {
        message: prompt,
        model,
        systemPrompt: wsContext ? `${wsContext}\n\n---\n\n${baseSystem}` : baseSystem,
      },
      token => { fullReport += token; setReport(r => r + token) },
      () => {
        setStage('done')
        setStreaming(false)
        abortRef.current = null
        // Save to persistent history
        setResearchHistory(prev => {
          const entry = { query: q, report: fullReport.slice(0, 2000), depth, ts: Date.now() }
          const next = [entry, ...prev.filter(h => h.query !== q)].slice(0, MAX_RESEARCH_HISTORY)
          saveResearchHistory(next)
          return next
        })
      },
      err => { toast.error(err.message); setStage('done'); setStreaming(false) },
    )
  }

  const copy = () => { navigator.clipboard.writeText(report); toast.success('Copied to clipboard') }

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`# ${query}\n\n${report}`], { type: 'text/markdown' }))
    a.download = `research-${Date.now()}.md`
    a.click()
  }

  const reset = () => {
    abortRef.current?.()
    setStage(null)
    setReport('')
    setSources([])
    setStreaming(false)
    setVisual(null)
  }

  const generateVisual = async () => {
    if (visualLoading || !query.trim()) return
    setVisualLoading(true)
    setVisual(null)
    toast.success('Generating research visual…', { duration: 2000 })
    try {
      const data = await apiJSON('/api/images', {
        method: 'POST',
        body: JSON.stringify({ prompt: `Visual representation of: ${query}`, width: 1024, height: 576 }),
      })
      setVisual(data)
    } catch (err) {
      toast.error(err.message || 'Image generation failed')
    } finally {
      setVisualLoading(false)
    }
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* Left panel */}
      <div
        className="w-72 shrink-0 flex flex-col"
        style={{ borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}
      >
        {/* Scrollable controls area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4" style={{ color: 'var(--color-primary-light)' }} />
          <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Research Studio</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto font-medium"
            style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Live</span>
        </div>

        {/* Model selector */}
        <div className="relative" ref={modelPickerRef}>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>AI Model</label>
          <button
            onClick={() => setShowModels(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition-all"
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: showModels ? 'var(--color-primary)' : 'var(--border-color)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="font-medium truncate">{currentModel.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                {currentModel.badge}
              </span>
              <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            </div>
          </button>
          {showModels && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="p-1">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setShowModels(false) }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left"
                    style={{
                      backgroundColor: model === m.id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                      color: model === m.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { if (model !== m.id) e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                    onMouseLeave={e => { if (model !== m.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>{m.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Query */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Research query</label>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.ctrlKey && run()}
            placeholder="What do you want to research?"
            rows={3}
            className="input resize-none text-xs"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Attach Document</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          {attachedFile ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} className="shrink-0" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all disabled:opacity-50"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {parsingFile
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Parsing…</>
                : <><Paperclip className="w-3.5 h-3.5" /> Attach PDF, DOCX, XLSX, TXT…</>
              }
            </button>
          )}
        </div>

        {/* Depth */}
        <div>
          <label className="text-xs mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Depth</label>
          <div className="space-y-1">
            {DEPTHS.map(d => (
              <button
                key={d.id}
                onClick={() => setDepth(d.id)}
                className="w-full text-left px-3 py-2 rounded-xl text-xs transition-all"
                style={depth === d.id ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                  color: 'var(--color-primary-light)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
                } : {
                  color: 'var(--text-secondary)',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => { if (depth !== d.id) e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                onMouseLeave={e => { if (depth !== d.id) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <div className="flex items-center gap-1.5">
                  <span>{d.icon}</span>
                  <span className="font-medium">{d.label}</span>
                </div>
                <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={() => run()}
            disabled={!query.trim() || (!!stage && stage !== 'done')}
            className="btn-primary justify-center w-full py-2.5"
          >
            {stage && stage !== 'done'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {STAGE_LABELS[stage]}…</>
              : <><Search className="w-4 h-4" /> Research</>
            }
          </button>
          {stage && (
            <button onClick={reset} className="btn-ghost w-full justify-center text-xs py-2">
              <RefreshCw className="w-3.5 h-3.5" /> New Research
            </button>
          )}
        </div>

        {/* Starters */}
        {!stage && (
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Try a starter:</p>
            <div className="space-y-1">
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => run(s)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>{/* end scrollable controls */}

        {/* History panel */}
        {researchHistory.length > 0 && (
          <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium uppercase tracking-wider text-[10px]">Past Research</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  {researchHistory.length}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? '' : '-rotate-90'}`} />
              </div>
            </button>
            {showHistory && (
              <div className="max-h-52 overflow-y-auto px-3 pb-3 space-y-1">
                <div className="flex justify-end pb-1">
                  <button
                    onClick={() => { if (window.confirm('Clear research history?')) { setResearchHistory([]); saveResearchHistory([]) } }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Clear
                  </button>
                </div>
                {researchHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(h.query)
                      setReport(h.report)
                      setStage('done')
                      setStreaming(false)
                      setSources([])
                      setVisual(null)
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <p className="truncate font-medium">{h.query}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(h.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {h.depth && <span className="ml-1 opacity-70">· {h.depth}</span>}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: report area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">

        {/* Sources bar */}
        {sources.length > 0 && (
          <div className="px-6 py-3 flex items-center gap-2 overflow-x-auto"
            style={{ borderBottom: '1px solid var(--border-color)' }}>
            <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{sources.length} sources</span>
            {sources.map((s, i) => (
              <a
                key={i} href={s.url} target="_blank" rel="noreferrer"
                className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs no-underline transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>[{i+1}]</span>
                <span className="max-w-[140px] truncate">{s.title}</span>
                <ExternalLink className="w-2.5 h-2.5" style={{ color: 'var(--text-muted)' }} />
              </a>
            ))}
          </div>
        )}

        {/* Report */}
        <div className="flex-1 p-6">
          {!stage ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                <FlaskConical className="w-8 h-8" style={{ color: 'var(--color-primary-light)' }} />
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Enter a research topic to get started</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pyxis will synthesize a professional research brief</p>
                <p className="text-xs mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
                  Powered by {currentModel.label} with web search integration · Attach documents for document-grounded research
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{query}</h2>
                  {attachedFile && (
                    <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--color-primary)' }}>
                      <FileText className="w-3.5 h-3.5" /> Grounded on: {attachedFile.name}
                    </p>
                  )}
                  {stage === 'done' && (
                    <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Research complete
                    </p>
                  )}
                  {stage === 'synthesize' && streaming && (
                    <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--color-primary-light)' }}>
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Synthesizing…
                    </p>
                  )}
                </div>
                {stage === 'done' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={generateVisual}
                      disabled={visualLoading}
                      className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border transition-all disabled:opacity-40"
                      style={{
                        backgroundColor: visual ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--bg-input)',
                        borderColor: visual ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-color)',
                        color: visual ? 'var(--color-primary)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => { if (!visual) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
                      onMouseLeave={e => { if (!visual) { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
                    >
                      {visualLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating visual…</>
                        : <><Wand2   className="w-3.5 h-3.5" /> {visual ? 'Regenerate Visual' : 'Generate Visual'}</>
                      }
                    </button>
                    <button onClick={copy} className="btn-ghost text-xs py-1.5 px-3">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button onClick={download} className="btn-ghost text-xs py-1.5 px-3">
                      <Download className="w-3.5 h-3.5" /> Export
                    </button>
                    {activeWorkspace && (
                      <button
                        onClick={() => {
                          addArtifact({ type: 'research', title: query, content: report, source: '/research' })
                          toast.success('Added to workspace')
                        }}
                        className="btn-ghost text-xs py-1.5 px-3"
                        style={{ color: 'var(--color-primary-light)' }}
                      >
                        <Zap className="w-3.5 h-3.5" /> Add to Workspace
                      </button>
                    )}
                  </div>
                )}
              </div>

              {report ? (
                <div className={`prose-chat text-sm max-w-none leading-relaxed ${streaming ? 'typing-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {STAGE_LABELS[stage]}…
                </div>
              )}

              {/* ── Inline Research Visual ──────────────────────────────── */}
              {(visual || visualLoading) && (
                <div className="mt-6 rounded-2xl overflow-hidden border"
                  style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2 px-4 py-2.5"
                    style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                    <Image className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Research Visual</span>
                    {visual && (
                      <button
                        onClick={() => setVisual(null)}
                        className="ml-auto p-0.5 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {visualLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3"
                      style={{ backgroundColor: 'var(--bg-card)' }}>
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
                          <Wand2 className="w-6 h-6 animate-pulse" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="absolute inset-0 rounded-xl animate-ping"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }} />
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Creating research visual…</p>
                    </div>
                  ) : visual && (
                    <img src={visual.url} alt={visual.prompt}
                      className="w-full object-contain max-h-[360px]"
                      style={{ backgroundColor: 'var(--bg-app)' }} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
