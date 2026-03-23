import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Send, Plus, Trash2, ChevronDown, Bot, User, Square,
  Wrench, Search, Calculator, Cloud, Clock, ChevronRight,
  Image, Code, Globe, Database, Zap, FileText, Layers,
  BookOpen, BarChart2, Hash, Terminal, Thermometer,
  Paperclip, X, Mic, MicOff, Copy, Check, RefreshCw,
  Edit3, AlertTriangle,
} from 'lucide-react'
import { apiJSON, streamChat, streamChatTools, parseFile } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

const MODELS = [
  // Gemini
  { id: 'gemini-2.5-flash',              label: 'Gemini 2.5 Flash',   provider: 'Google',    badge: 'Best'   },
  { id: 'gemini-2.0-flash',              label: 'Gemini 2.0 Flash',   provider: 'Google',    badge: 'Fast'   },
  { id: 'gemini-2.0-flash-lite',         label: 'Gemini Lite',        provider: 'Google',    badge: 'Lite'   },
  // Groq (ultra-fast free)
  { id: 'llama-3.3-70b-versatile',       label: 'Llama 3.3 70B',      provider: 'Groq',      badge: 'Fast'   },
  { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B',       provider: 'Groq',      badge: 'Instant'},
  // Cerebras (fastest free)
  { id: 'llama3.3-70b',                  label: 'Llama 3.3 (Cerebras)',provider: 'Cerebras',  badge: '2k t/s' },
  // OpenAI
  { id: 'gpt-4o-mini',                   label: 'GPT-4o Mini',        provider: 'OpenAI',    badge: 'Smart'  },
  { id: 'gpt-4o',                        label: 'GPT-4o',             provider: 'OpenAI',    badge: 'Best'   },
  // SambaNova
  { id: 'Meta-Llama-3.3-70B-Instruct',   label: 'Llama 3.3 (SambaNova)', provider: 'SambaNova', badge: 'Free' },
  // OpenRouter free
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 (OR)', provider: 'OpenRouter', badge: 'Free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small', provider: 'OpenRouter', badge: 'Free' },
]

const PERSONAS = {
  default:         { label: '🤖 Default',           system: '' },
  professional:    { label: '💼 Professional',       system: 'You are a professional consultant. Be formal, precise, and business-focused. Use structured responses with clear sections.' },
  creative:        { label: '🎨 Creative',           system: 'You are a creative thinker. Think outside the box, use vivid analogies, explore unconventional ideas, and make responses engaging and imaginative.' },
  technical:       { label: '⚙️ Technical',          system: 'You are a technical expert. Provide detailed technical explanations, code examples when relevant, and precise terminology.' },
  socratic:        { label: '🦉 Socratic',           system: 'You are a Socratic teacher. Guide the user to discover answers themselves through thoughtful questions and incremental hints rather than direct answers.' },
  devils_advocate: { label: "😈 Devil's Advocate",  system: "You are a devil's advocate. Challenge assumptions, present counterarguments, and help the user stress-test their ideas by arguing the opposite perspective." },
}

// ── Tool icon map — covers every MCP tool ──────────────────────────────
const TOOL_ICONS = {
  web_search:            <Search className="w-3.5 h-3.5" />,
  get_news:              <Globe className="w-3.5 h-3.5" />,
  calculate:             <Calculator className="w-3.5 h-3.5" />,
  convert_units:         <Thermometer className="w-3.5 h-3.5" />,
  get_weather:           <Cloud className="w-3.5 h-3.5" />,
  get_datetime:          <Clock className="w-3.5 h-3.5" />,
  read_url:              <FileText className="w-3.5 h-3.5" />,
  generate_image:        <Image className="w-3.5 h-3.5" />,
  enhance_prompt:        <Zap className="w-3.5 h-3.5" />,
  run_code:              <Terminal className="w-3.5 h-3.5" />,
  save_memory:           <Database className="w-3.5 h-3.5" />,
  recall_memory:         <Database className="w-3.5 h-3.5" />,
  list_prompt_templates: <BookOpen className="w-3.5 h-3.5" />,
  summarize_text:        <Layers className="w-3.5 h-3.5" />,
  extract_keywords:      <Hash className="w-3.5 h-3.5" />,
  format_json:           <Code className="w-3.5 h-3.5" />,
}

// All tools with display metadata for the toolbar chips
const ALL_TOOL_META = [
  { name: 'web_search',            label: 'Web Search',    group: 'web' },
  { name: 'get_news',              label: 'News',          group: 'web' },
  { name: 'get_weather',           label: 'Weather',       group: 'web' },
  { name: 'read_url',              label: 'Read URL',      group: 'web' },
  { name: 'calculate',             label: 'Calculate',     group: 'utility' },
  { name: 'convert_units',         label: 'Units',         group: 'utility' },
  { name: 'get_datetime',          label: 'DateTime',      group: 'utility' },
  { name: 'generate_image',        label: 'Images',        group: 'ai' },
  { name: 'enhance_prompt',        label: 'Prompt+',       group: 'ai' },
  { name: 'run_code',              label: 'Run Code',      group: 'code' },
  { name: 'save_memory',           label: 'Memory',        group: 'memory' },
  { name: 'recall_memory',         label: 'Recall',        group: 'memory' },
  { name: 'list_prompt_templates', label: 'Prompts',       group: 'memory' },
  { name: 'summarize_text',        label: 'Summarize',     group: 'data' },
  { name: 'extract_keywords',      label: 'Keywords',      group: 'data' },
  { name: 'format_json',           label: 'JSON',          group: 'data' },
]

// Starter prompts that showcase every tool category
const TOOL_STARTERS = [
  "What's the weather in Tokyo right now?",
  "Search the web: latest breakthroughs in quantum computing",
  "Calculate the compound interest on $10,000 at 7% for 10 years",
  "Convert 180 pounds to kilograms",
  "Get the latest AI news today",
  "Read and summarize this URL: https://en.wikipedia.org/wiki/Artificial_intelligence",
  "Generate an image of a futuristic city at night",
  "Run this Python code: print([x**2 for x in range(10)])",
  "What time and day is it right now?",
  "Remember that I prefer concise answers",
]

function ToolCallCard({ call }) {
  const [open, setOpen] = useState(false)
  const icon = TOOL_ICONS[call.name] || <Wrench className="w-3.5 h-3.5" />
  const hasResult = call.result !== undefined
  const hasError  = hasResult && call.result?.error

  // Summary line shown in collapsed header
  const getSummary = () => {
    if (!hasResult) return null
    const r = call.result
    if (call.name === 'web_search' || call.name === 'get_news')
      return `${r.count ?? r.results?.length ?? 0} results`
    if (call.name === 'get_weather')
      return r.temp_c != null ? `${r.temp_c}°C — ${r.description}` : r.error
    if (call.name === 'calculate')
      return r.result != null ? `= ${r.result}` : r.error
    if (call.name === 'convert_units')
      return r.to ?? r.error
    if (call.name === 'get_datetime')
      return r.date ? `${r.date}, ${r.time}` : null
    if (call.name === 'generate_image')
      return r.source ? `via ${r.source}` : r.error
    if (call.name === 'run_code')
      return r.status ? r.status : null
    if (call.name === 'read_url')
      return r.chars_returned ? `${r.chars_returned} chars read` : r.error
    if (call.name === 'save_memory')
      return r.saved ? 'saved ✓' : r.error
    if (call.name === 'recall_memory')
      return r.count != null ? `${r.count} facts` : null
    if (call.name === 'summarize_text')
      return r.sentences_extracted ? `${r.sentences_extracted} sentences extracted` : null
    if (call.name === 'extract_keywords')
      return r.top_keyword ? `top: ${r.top_keyword}` : null
    if (hasError) return `Error: ${r.error}`
    return null
  }
  const summary = getSummary()

  return (
    <div
      className="rounded-xl border text-xs overflow-hidden my-1"
      style={{
        borderColor: hasError ? 'rgba(239,68,68,0.4)' : 'var(--border-color)',
        backgroundColor: 'color-mix(in srgb, var(--bg-input) 60%, transparent)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-80 transition-opacity text-left"
      >
        <span style={{ color: hasError ? '#f87171' : 'var(--color-primary-light)' }}>{icon}</span>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {call.name.replace(/_/g, '\u00A0')}
        </span>
        {/* Show first arg value as hint */}
        {call.args && Object.keys(call.args).length > 0 && (
          <span className="truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
            {Object.values(call.args)[0]?.toString().slice(0, 40)}
          </span>
        )}
        {summary && (
          <span className={`ml-auto shrink-0 ${hasError ? 'text-red-400' : 'text-green-400'}`}>
            {summary}
          </span>
        )}
        {!hasResult && (
          <span className="ml-auto flex items-center gap-1 text-yellow-400 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            running…
          </span>
        )}
        <ChevronRight
          className={`w-3 h-3 transition-transform shrink-0 ml-1 ${open ? 'rotate-90' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
          {/* Args */}
          {call.args && Object.keys(call.args).length > 0 && (
            <div className="mt-2">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Input</p>
              <pre className="rounded p-2 overflow-x-auto text-xs" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
                {JSON.stringify(call.args, null, 2)}
              </pre>
            </div>
          )}
          {/* Special render: image result */}
          {hasResult && call.name === 'generate_image' && call.result?.url && (
            <div className="mt-2">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Generated Image</p>
              <img
                src={call.result.url}
                alt={call.result.prompt}
                className="rounded-lg max-h-48 object-contain border"
                style={{ borderColor: 'var(--border-color)' }}
              />
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Source: {call.result.source}</p>
            </div>
          )}
          {/* Special render: code result */}
          {hasResult && call.name === 'run_code' && (
            <div className="mt-2 space-y-1">
              <p className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                Output <span className={call.result.status === 'Accepted' ? 'text-green-400' : 'text-red-400'}>({call.result.status})</span>
              </p>
              {call.result.stdout && (
                <pre className="rounded p-2 overflow-x-auto text-xs" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
                  {call.result.stdout}
                </pre>
              )}
              {call.result.stderr && (
                <pre className="rounded p-2 overflow-x-auto text-xs text-red-400" style={{ backgroundColor: 'var(--bg-app)' }}>
                  {call.result.stderr}
                </pre>
              )}
            </div>
          )}
          {/* Special render: web search results */}
          {hasResult && (call.name === 'web_search' || call.name === 'get_news') && call.result?.results?.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Results</p>
              {call.result.results.slice(0, 4).map((r, i) => (
                <div key={i} className="p-2 rounded" style={{ backgroundColor: 'var(--bg-app)' }}>
                  <p className="font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{r.title}</p>
                  <p className="truncate" style={{ color: 'var(--text-muted)' }}>{r.snippet}</p>
                </div>
              ))}
            </div>
          )}
          {/* Generic JSON result for everything else */}
          {hasResult && !['generate_image', 'run_code', 'web_search', 'get_news'].includes(call.name) && (
            <div className="mt-2">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Result</p>
              <pre className="rounded p-2 overflow-x-auto text-xs" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
                {JSON.stringify(call.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg, suggestions, onSuggestionClick, onAddToWorkspace, onCopy, onEdit, onRegenerate }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)
  const [hover,  setHover]  = useState(false)
  const isError = !!msg.error

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center self-start mt-0.5"
        style={isUser ? { backgroundColor: 'var(--color-primary)' } : { backgroundColor: 'var(--bg-input)' }}
      >
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-primary-light)' }} />}
      </div>

      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>

        {/* Tool call cards */}
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-1 w-full">
            {msg.toolCalls.map(tc => <ToolCallCard key={tc.id} call={tc} />)}
          </div>
        )}

        {/* Error card */}
        {isError ? (
          <div
            className="rounded-2xl px-4 py-3 text-sm rounded-tl-sm flex flex-col gap-2"
            style={{ backgroundColor: 'color-mix(in srgb, #ef4444 8%, var(--bg-card))', border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)', color: 'var(--text-primary)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-medium text-red-400">Request failed</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {msg.error}
            </p>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(msg.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg self-start transition-all"
                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>
        ) : (
          /* Normal message content */
          (isUser || msg.content) && (
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm ${isUser ? 'text-white rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={isUser ? { backgroundColor: 'var(--color-primary)' } : {
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {isUser ? (
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className={`prose-chat ${msg.streaming ? 'typing-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          )
        )}

        {/* ── Action buttons (hover reveal) ── */}
        {!msg.streaming && !isError && (
          <div
            className="flex items-center gap-0.5 transition-all duration-150"
            style={{ opacity: hover ? 1 : 0, pointerEvents: hover ? 'auto' : 'none' }}
          >
            {/* Copy */}
            <button
              onClick={handleCopy}
              title="Copy message"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{ color: copied ? 'var(--color-primary)' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Edit (user only) */}
            {isUser && onEdit && (
              <button
                onClick={() => onEdit(msg)}
                title="Edit message"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {/* Regenerate (assistant only) */}
            {!isUser && onRegenerate && msg.content && (
              <button
                onClick={() => onRegenerate(msg.id)}
                title="Regenerate response"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            {/* Add to Workspace */}
            {!isUser && msg.content && onAddToWorkspace && (
              <button
                onClick={() => onAddToWorkspace(msg.content)}
                title="Save to workspace"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--color-primary-light)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            )}
          </div>
        )}

        {/* Suggestion chips */}
        {!isUser && !msg.streaming && suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(s)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function Chat() {
  const { id: urlId } = useParams()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [convos,         setConvos]      = useState([])
  const [convId,         setConvId]      = useState(urlId || null)
  const [messages,       setMessages]    = useState([])
  const [input,          setInput]       = useState('')
  const [model,          setModel]       = useState(MODELS[0].id)
  const [persona,        setPersona]     = useState('default')
  const [toolsEnabled,   setToolsEnabled]= useState(false)
  const [showAllTools,   setShowAllTools]= useState(false)
  const [busy,           setBusy]        = useState(false)
  const [loadingMsgs,    setLoadingMsgs] = useState(false)
  const [suggestions,    setSuggestions] = useState([])
  const [hovered,        setHovered]     = useState(null)
  const [attachedFile,   setAttachedFile]= useState(null)  // { name, text }
  const [slowStream,     setSlowStream]  = useState(false)
  const [parsingFile,    setParsing]     = useState(false)
  const [dictating,      setDictating]  = useState(false)

  const bottomRef          = useRef(null)
  const abortRef           = useRef(null)
  const textareaRef        = useRef(null)
  const fileInputRef       = useRef(null)
  const skipNextMsgLoadRef = useRef(false)
  const dictRecRef         = useRef(null)
  const slowTimerRef       = useRef(null)

  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()

  // ── File upload handler ──────────────────────────────────────────────
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

  // ── Mic dictation toggle ─────────────────────────────────────────────
  const toggleDictation = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) { toast.error('Voice input not supported — use Chrome or Edge'); return }

    if (dictating) {
      dictRecRef.current?.stop()
      setDictating(false)
      return
    }

    const rec = new SpeechRec()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        setInput(prev => {
          const next = prev ? prev.trimEnd() + ' ' + final.trim() : final.trim()
          // Auto-resize textarea
          setTimeout(() => {
            const ta = textareaRef.current
            if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px' }
          }, 0)
          return next
        })
      }
    }

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast.error('Microphone permission denied')
      else if (e.error === 'network') toast.error('Speech recognition: network issue', { id: 'voice-network-err', duration: 3000 })
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(`Voice error: ${e.error}`, { id: 'voice-err' })
      setDictating(false)
    }

    rec.onend = () => setDictating(false)

    dictRecRef.current = rec
    try { rec.start(); setDictating(true) }
    catch { toast.error('Could not start voice input') }
  }, [dictating])

  // ── Load conversation list ──────────────────────────────────────────
  useEffect(() => {
    apiJSON('/api/conversations').then(setConvos).catch(() => {})
  }, [])

  // ── Pre-fill from Prompt Library "Use in Chat" ───────────────────
  useEffect(() => {
    const starter = sessionStorage.getItem('pyxis_starter_prompt')
    if (starter) {
      sessionStorage.removeItem('pyxis_starter_prompt')
      setInput(starter)
      textareaRef.current?.focus()
    }
  }, [])

  // ── URL ?prompt= param — voice assistant intent routing ──────────
  useEffect(() => {
    const voicePrompt = searchParams.get('prompt')
    if (voicePrompt) {
      setInput(voicePrompt)
      setTimeout(() => {
        document.querySelector('[data-send-btn]')?.click()
      }, 500)
    }
  }, [])

  // ── Load messages when conversation changes ─────────────────────────
  useEffect(() => {
    if (!convId) { setMessages([]); return }
    if (skipNextMsgLoadRef.current) { skipNextMsgLoadRef.current = false; return }
    setLoadingMsgs(true)
    apiJSON(`/api/messages?conversationId=${convId}`)
      .then(data => setMessages(data))
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoadingMsgs(false))
  }, [convId])

  useEffect(() => { if (urlId && urlId !== convId) setConvId(urlId) }, [urlId])
  useEffect(() => { if (convId && convId !== urlId) navigate(`/chat/${convId}`, { replace: true }) }, [convId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Follow-up suggestions ─────────────────────────────────────────
  // ── History truncation helpers ───────────────────────────────────────
  // Cap at 20 most-recent messages, each content at 2000 chars.
  // Prevents context-limit errors and reduces network payload on long chats.
  const HIST_LIMIT    = 20
  const CONTENT_LIMIT = 2000
  const trimHistory = (msgs) =>
    msgs.slice(-HIST_LIMIT).map(m => ({ role: m.role, content: (m.content || '').slice(0, CONTENT_LIMIT) }))

  const generateSuggestions = useCallback(async (history) => {
    setSuggestions([])
    try {
      let raw = ''
      await new Promise((resolve, reject) => {
        streamChat(
          {
            message: 'Generate 3 short (max 8 words each) follow-up question suggestions for this conversation. Return as JSON array of strings only.',
            model,
            history: history.slice(-8).map(m => ({ role: m.role, content: (m.content || '').slice(0, 400) })),
          },
          (token) => { raw += token },
          resolve,
          reject,
        )
      })
      const match = raw.match(/\[[\s\S]*?\]/)
      if (match) {
        const arr = JSON.parse(match[0])
        if (Array.isArray(arr)) setSuggestions(arr.slice(0, 3))
      }
    } catch {}
  }, [model])

  const createConversation = async (firstMessage) => {
    const title = firstMessage.slice(0, 60) || 'New Conversation'
    const conv  = await apiJSON('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title, model, projectId: projectId || undefined }),
    })
    setConvos(prev => [conv, ...prev])
    skipNextMsgLoadRef.current = true
    setConvId(conv.id)
    return conv.id
  }

  const saveMessage = async (cid, role, content) => {
    try {
      await apiJSON('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ conversationId: cid, role, content }),
      })
    } catch {}
  }

  // ── Send ─────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return

    // Prepend file content if attached
    const fileCtx = attachedFile
      ? `[File: ${attachedFile.name}]\n${attachedFile.text.slice(0, 10000)}\n\n---\n\n`
      : ''
    const fullMessage = fileCtx + text

    setInput('')
    setAttachedFile(null)
    setBusy(true)
    setSlowStream(false)
    setSuggestions([])

    // Show "taking longer than usual" warning if no tokens arrive within 20s
    slowTimerRef.current = setTimeout(() => setSlowStream(true), 20000)

    // Add user message immediately so UI responds even if backend fails
    const userMsg = { id: Date.now(), role: 'user', content: text, fileName: attachedFile?.name }
    setMessages(prev => [...prev, userMsg])

    // Try to persist conversation — silently skip if auth fails (guest mode)
    let cid = convId
    if (!cid) {
      try {
        cid = await createConversation(text)
      } catch {
        cid = null  // run in ephemeral mode, no persistence
      }
    }

    if (cid) saveMessage(cid, 'user', text)

    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', streaming: true, toolCalls: [],
    }])

    let full = ''
    const wsCtx = getContextString()
    const personaBase = PERSONAS[persona]?.system || ''
    const personaSystem = wsCtx ? `${wsCtx}\n\n---\n\n${personaBase}` : personaBase

    const clearSlowTimer = () => {
      clearTimeout(slowTimerRef.current)
      slowTimerRef.current = null
      setSlowStream(false)
    }

    const onDone = () => {
      clearSlowTimer()
      setMessages(prev => {
        const updated = prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m)
        generateSuggestions(updated)
        return updated
      })
      if (cid) saveMessage(cid, 'assistant', full)
      setBusy(false)
      abortRef.current = null
    }

    const onError = (err) => {
      clearSlowTimer()
      setMessages(prev =>
        prev.map(m => m.id === assistantId
          ? { ...m, content: full || '', error: err.message, streaming: false }
          : m
        )
      )
      if (cid && full) saveMessage(cid, 'assistant', full)
      setBusy(false)
      abortRef.current = null
    }

    const historyForAPI = trimHistory(messages)

    if (toolsEnabled) {
      // ── Tools mode: use /api/chat-tools ────────────────────────────
      abortRef.current = streamChatTools(
        {
          message: fullMessage,
          model: model.startsWith('gemini') ? model : 'gemini-2.5-flash',
          history: historyForAPI,
          ...(personaSystem ? { systemPrompt: personaSystem } : {}),
          tools_enabled: true,
        },
        // onToken
        (token) => {
          full += token
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: full } : m)
          )
        },
        // onToolCall
        (ev) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, toolCalls: [...(m.toolCalls || []), { id: ev.id, name: ev.name, server: ev.server, args: ev.args }] }
              : m
          ))
        },
        // onToolResult
        (ev) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  toolCalls: (m.toolCalls || []).map(tc =>
                    tc.id === ev.id ? { ...tc, result: ev.result } : tc
                  ),
                }
              : m
          ))
        },
        onDone,
        onError,
      )
    } else {
      // ── Standard mode: use /api/chat ──────────────────────────────
      abortRef.current = streamChat(
        {
          message: fullMessage,
          model,
          conversationId: cid,
          history: historyForAPI,
          ...(personaSystem ? { systemPrompt: personaSystem } : {}),
        },
        (token) => {
          if (!full) clearSlowTimer()   // clear on first token
          full += token
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: full } : m)
          )
        },
        onDone,
        onError,
      )
    }
  }, [input, busy, convId, messages, model, persona, toolsEnabled, attachedFile, generateSuggestions])

  const handleSuggestionClick = useCallback((suggestion) => {
    setInput(suggestion)
    textareaRef.current?.focus()
    setTimeout(() => { document.querySelector('[data-send-btn]')?.click() }, 50)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const newChat = () => {
    abortRef.current?.()
    setConvId(null)
    setMessages([])
    setSuggestions([])
    navigate('/chat', { replace: true })
  }

  const deleteConvo = async (id, e) => {
    e.stopPropagation()
    try {
      await apiJSON(`/api/conversations/${id}`, { method: 'DELETE' })
      setConvos(prev => prev.filter(c => c.id !== id))
      if (convId === id) newChat()
    } catch { toast.error('Delete failed') }
  }

  // ── Edit a user message — restore to input, trim history ─────────────
  const handleEditMessage = useCallback((msg) => {
    const idx = messages.findIndex(m => m.id === msg.id)
    if (idx === -1) return
    abortRef.current?.()
    setBusy(false)
    setMessages(prev => prev.slice(0, idx))
    setInput(msg.content)
    setTimeout(() => {
      textareaRef.current?.focus()
      const ta = textareaRef.current
      if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px' }
    }, 50)
  }, [messages])

  // ── Regenerate — remove AI reply, re-send last user message ──────────
  const handleRegenerateMessage = useCallback((msgId) => {
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx === -1) return
    // Remove AI message and any trailing messages
    const before = messages.slice(0, idx)
    // Find the last user message
    const lastUser = [...before].reverse().find(m => m.role === 'user')
    if (!lastUser) return
    abortRef.current?.()
    setBusy(false)
    setMessages(before)
    setInput(lastUser.content)
    setTimeout(() => document.querySelector('[data-send-btn]')?.click(), 80)
  }, [messages])

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant' && !m.streaming)?.id

  return (
    <div className="flex h-screen">

      {/* ── Left: conversation list ──────────────────────────────── */}
      <div
        className="w-56 shrink-0 border-r flex flex-col"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 90%, transparent)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="p-3">
          <button onClick={newChat} className="btn-primary w-full justify-center py-2 text-xs">
            <Plus className="w-3.5 h-3.5" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {convos.map(c => (
            <div
              key={c.id}
              onClick={() => setConvId(c.id)}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs truncate flex items-center gap-2 group cursor-pointer transition-colors"
              style={
                c.id === convId
                  ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', color: 'var(--color-primary-light)' }
                  : hovered === c.id
                    ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-secondary)' }
              }
            >
              <span className="flex-1 truncate">{c.title}</span>
              <button
                onClick={e => deleteConvo(c.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: chat area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b backdrop-blur"
          style={{ backgroundColor: 'var(--bg-app)', borderColor: 'var(--border-color)' }}
        >
          {/* Model selector */}
          <div className="relative">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="appearance-none border rounded-lg pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:border-primary cursor-pointer"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              {['Google', 'Groq', 'Cerebras', 'OpenAI', 'SambaNova', 'OpenRouter'].map(provider => {
                const group = MODELS.filter(m => m.provider === provider)
                return group.length ? (
                  <optgroup key={provider} label={`── ${provider} ──`}>
                    {group.map(m => <option key={m.id} value={m.id}>{m.label} [{m.badge}]</option>)}
                  </optgroup>
                ) : null
              })}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Persona selector */}
          <div className="relative">
            <select
              value={persona}
              onChange={e => setPersona(e.target.value)}
              className="appearance-none border rounded-lg pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:border-primary cursor-pointer"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              {Object.entries(PERSONAS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Tools toggle */}
          <button
            onClick={() => setToolsEnabled(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all"
            style={toolsEnabled
              ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', borderColor: 'var(--color-primary)', color: 'var(--color-primary-light)' }
              : { backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }
            }
            title={toolsEnabled ? 'Tools enabled — AI can search the web, calculate, check weather…' : 'Enable MCP tools'}
          >
            <Wrench className="w-3.5 h-3.5" />
            Tools {toolsEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Tool pills when enabled — show all 16 tools */}
          {toolsEnabled && (
            <div className="flex items-center gap-1 ml-1 flex-wrap">
              {(showAllTools ? ALL_TOOL_META : ALL_TOOL_META.slice(0, 5)).map(t => (
                <span
                  key={t.name}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs whitespace-nowrap"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary-light)' }}
                >
                  {TOOL_ICONS[t.name] || <Wrench className="w-3 h-3" />}
                  {t.label}
                </span>
              ))}
              <button
                onClick={() => setShowAllTools(v => !v)}
                className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', backgroundColor: 'transparent' }}
              >
                {showAllTools ? '− less' : `+${ALL_TOOL_META.length - 5} more`}
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {loadingMsgs ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-24 gap-3">
              <Bot className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Start a conversation</p>
              <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                {toolsEnabled
                  ? `MCP Tools ON — ${ALL_TOOL_META.length} tools active: web search, news, weather, image gen, code runner, unit conversion, memory, summarizer, and more.`
                  : 'Ask anything — powered by Gemini with automatic fallback.'}
              </p>
              {toolsEnabled && (
                <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-lg">
                  {TOOL_STARTERS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus() }}
                      className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                      style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                suggestions={msg.id === lastAssistantId ? suggestions : []}
                onSuggestionClick={handleSuggestionClick}
                onEdit={msg.role === 'user' ? handleEditMessage : undefined}
                onRegenerate={msg.role === 'assistant' ? handleRegenerateMessage : undefined}
                onAddToWorkspace={activeWorkspace ? (content) => { addArtifact({ type: 'chat', title: content.slice(0, 60), content: content.slice(0, 800), source: '/chat' }); toast.success('Added to workspace') } : null}
              />
            ))
          )}
          {/* Slow stream banner */}
          {slowStream && busy && (
            <div className="flex items-center gap-2 px-4 py-2.5 mx-0 rounded-xl text-xs" style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 8%, var(--bg-card))', border: '1px solid color-mix(in srgb, #f59e0b 25%, transparent)', color: '#fbbf24' }}>
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
              <span>Taking longer than usual — using a fallback AI provider. Please wait…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4">
          {/* Attached file chip */}
          {attachedFile && (
            <div
              className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl border text-xs"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                {attachedFile.name} · {attachedFile.chars?.toLocaleString()} chars
              </span>
              <button onClick={() => setAttachedFile(null)} style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.json,.py,.js,.ts,.html,.css"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            className="flex items-end gap-2 rounded-2xl px-3 py-2 border transition-colors"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
            onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile || busy}
              title="Attach file (PDF, DOCX, XLSX, TXT, code…)"
              className="shrink-0 p-1.5 rounded-lg transition-colors mb-0.5 disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {parsingFile
                ? <Send className="w-4 h-4 animate-spin" style={{ animationName: 'spin' }} />
                : <Paperclip className="w-4 h-4" />
              }
            </button>

            {/* Mic dictation button */}
            <button
              onClick={toggleDictation}
              disabled={busy}
              title={dictating ? 'Stop dictation' : 'Dictate (voice to text)'}
              className="shrink-0 p-1.5 rounded-lg transition-all mb-0.5 disabled:opacity-40"
              style={{
                color: dictating ? '#ef4444' : 'var(--text-muted)',
                backgroundColor: dictating ? 'rgba(239,68,68,0.1)' : 'transparent',
                animation: dictating ? 'pulse 1.5s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={e => { if (!dictating) { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-input)' } }}
              onMouseLeave={e => { if (!dictating) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
            >
              {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={toolsEnabled ? 'Ask anything — web search, weather, math, or attach a file…' : 'Message Pyxis… or attach a file'}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none py-0.5 leading-relaxed placeholder-opacity-60"
              style={{ minHeight: '24px', maxHeight: '160px', color: 'var(--text-primary)' }}
            />
            {busy ? (
              <button
                onClick={() => { abortRef.current?.(); setBusy(false) }}
                className="shrink-0 w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                data-send-btn
                onClick={send}
                disabled={!input.trim() && !attachedFile}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--color-primary)' }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for newline · 📎 Attach files · 🎤 {dictating ? <span style={{ color: '#ef4444', fontWeight: 600 }}>Listening — tap mic to stop</span> : 'Tap mic to dictate'}
            {toolsEnabled && <span className="ml-2" style={{ color: 'var(--color-primary)' }}>· MCP Tools active</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
