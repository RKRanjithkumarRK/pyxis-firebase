import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User, Copy, RefreshCw, ChevronRight, Square, Sparkles, Zap, ChevronDown, Paperclip, X, FileText, Loader2, Wrench, Search, Calculator, Cloud, Clock, Image, Code, Globe, Database, BookOpen, BarChart2, Hash, Terminal, Thermometer, Layers } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, streamChatTools, parseFile } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

// ── MCP tool icons ─────────────────────────────────────────────────────
const MCP_ICONS = {
  web_search:            <Search    className="w-3.5 h-3.5" />,
  get_news:              <Globe     className="w-3.5 h-3.5" />,
  calculate:             <Calculator className="w-3.5 h-3.5" />,
  convert_units:         <Thermometer className="w-3.5 h-3.5" />,
  get_weather:           <Cloud     className="w-3.5 h-3.5" />,
  get_datetime:          <Clock     className="w-3.5 h-3.5" />,
  read_url:              <FileText  className="w-3.5 h-3.5" />,
  generate_image:        <Image     className="w-3.5 h-3.5" />,
  enhance_prompt:        <Sparkles  className="w-3.5 h-3.5" />,
  run_code:              <Terminal  className="w-3.5 h-3.5" />,
  save_memory:           <Database  className="w-3.5 h-3.5" />,
  recall_memory:         <Database  className="w-3.5 h-3.5" />,
  list_prompt_templates: <BookOpen  className="w-3.5 h-3.5" />,
  summarize_text:        <Layers    className="w-3.5 h-3.5" />,
  extract_keywords:      <Hash      className="w-3.5 h-3.5" />,
  format_json:           <Code      className="w-3.5 h-3.5" />,
}

// ── Simplified tool call card for agent view ───────────────────────────
function AgentToolCard({ call }) {
  const [open, setOpen] = useState(false)
  const hasResult = call.result !== undefined
  const isError   = hasResult && call.result?.error
  const icon      = MCP_ICONS[call.name] || <Wrench className="w-3.5 h-3.5" />
  const isImage   = call.name === 'generate_image'
  const imgUrl    = isImage && hasResult && !isError ? call.result?.url : null

  return (
    <div
      className="my-1.5 rounded-xl overflow-hidden border text-xs"
      style={{
        borderColor: isError ? 'rgba(239,68,68,0.3)' : 'var(--border-color)',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <span style={{ color: isError ? '#f87171' : 'var(--color-primary)' }}>{icon}</span>
        <span className="flex-1">{call.name.replace(/_/g, ' ')}</span>
        {!hasResult && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--text-muted)' }} />}
        {hasResult && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isError ? 'text-red-400' : 'text-green-400'}`}
            style={{ backgroundColor: isError ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)' }}>
            {isError ? '✗ error' : '✓ done'}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* Expanded: show image or JSON */}
      {open && (
        <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border-color)' }}>
          {call.input && (
            <pre className="text-[10px] overflow-x-auto p-2 rounded mt-1.5"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
              {JSON.stringify(call.input, null, 2)}
            </pre>
          )}
          {imgUrl && (
            <img src={imgUrl} alt={call.input?.prompt || 'generated'}
              className="w-full rounded-lg object-contain max-h-64 mt-1"
              style={{ backgroundColor: 'var(--bg-input)' }} />
          )}
          {hasResult && !imgUrl && (
            <pre className="text-[10px] overflow-x-auto p-2 rounded max-h-40 mt-1"
              style={{ backgroundColor: isError ? 'rgba(239,68,68,0.08)' : 'var(--bg-input)', color: isError ? '#fca5a5' : 'var(--text-secondary)' }}>
              {typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline image from generate_image tool ─────────────────────────────
function InlineToolImage({ toolCalls }) {
  const imgCall = toolCalls?.find(c => c.name === 'generate_image' && c.result?.url)
  if (!imgCall) return null
  return (
    <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
      <img src={imgCall.result.url} alt={imgCall.input?.prompt}
        className="w-full object-contain max-h-56" style={{ backgroundColor: 'var(--bg-app)' }} />
    </div>
  )
}

const MODELS = [
  { id: 'gemini-2.5-flash',              label: 'Gemini 2.5 Flash',       badge: 'Best'   },
  { id: 'gemini-2.0-flash',              label: 'Gemini 2.0 Flash',       badge: 'Fast'   },
  { id: 'gemini-2.0-flash-lite',         label: 'Gemini Lite',            badge: 'Lite'   },
  { id: 'llama-3.3-70b-versatile',       label: 'Llama 3.3 70B',          badge: 'Fast'   },
  { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B',           badge: 'Instant'},
  { id: 'llama3.3-70b',                  label: 'Llama 3.3 (Cerebras)',   badge: '2k t/s' },
  { id: 'gpt-4o-mini',                   label: 'GPT-4o Mini',            badge: 'Smart'  },
  { id: 'gpt-4o',                        label: 'GPT-4o',                 badge: 'Best'   },
  { id: 'Meta-Llama-3.3-70B-Instruct',   label: 'Llama 3.3 (SambaNova)', badge: 'Free'   },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 (OR)', badge: 'Free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small', badge: 'Free' },
]

const AGENTS = [
  {
    id: 'research',  name: 'Research Pro',       emoji: '🔬',
    desc: 'Deep web synthesis & competitive intelligence with citations',
    tags: ['Research', 'Analysis'],
    color: '#60a5fa', bg: 'rgba(37,99,235,0.15)',
    systemPrompt: 'You are Research Pro, an expert research analyst. Provide comprehensive, well-cited analysis with numbered sources. Structure your responses with clear sections: Overview, Key Findings, Analysis, and Sources.',
    starters: ['Analyze the AI assistant market in 2025', 'Compare top Python web frameworks', 'What are the latest trends in LLM fine-tuning?'],
  },
  {
    id: 'content',   name: 'Content Specialist', emoji: '✍️',
    desc: 'Long-form content, copywriting & compelling storytelling',
    tags: ['Writing', 'Content'],
    color: '#a78bfa', bg: 'rgba(124,58,237,0.15)',
    systemPrompt: 'You are Content Specialist, an expert content creator and copywriter. Write engaging, well-structured content tailored to the target audience. Use clear headlines and compelling narratives.',
    starters: ['Write a blog post about AI productivity', 'Create a product launch announcement', 'Draft a LinkedIn article about Python'],
  },
  {
    id: 'code',      name: 'Code Expert',         emoji: '⚡',
    desc: 'Code generation, debugging, refactoring & architecture',
    tags: ['Engineering', 'Code'],
    color: '#fbbf24', bg: 'rgba(217,119,6,0.15)',
    systemPrompt: 'You are Code Expert, a senior software engineer with 15+ years experience. Write clean, efficient, well-documented code. Explain architectural decisions and suggest best practices. Always include error handling.',
    starters: ['Build a rate limiter in Python', 'Refactor this for better performance', 'Design a microservices auth system'],
  },
  {
    id: 'data',      name: 'Data Analyst',        emoji: '📊',
    desc: 'Data analysis, SQL, statistics & visualization insights',
    tags: ['Data', 'Analytics'],
    color: '#34d399', bg: 'rgba(5,150,105,0.15)',
    systemPrompt: 'You are Data Analyst, a data science expert. Provide statistical insights, write optimal queries, and suggest the right visualizations. Always explain the "why" behind your analysis.',
    starters: ['Write a SQL query for monthly revenue', 'Explain A/B test significance', 'How to visualize churn analysis?'],
  },
  {
    id: 'legal',     name: 'Legal Analyst',       emoji: '⚖️',
    desc: 'Contract review, compliance & legal document analysis',
    tags: ['Legal', 'Compliance'],
    color: '#fb923c', bg: 'rgba(234,88,12,0.15)',
    systemPrompt: 'You are Legal Analyst, an expert in contract law and compliance. Review documents for risks, explain legal concepts clearly, and highlight key clauses. Note: For informational purposes only — always consult a qualified attorney.',
    starters: ['Review this NDA for red flags', 'Explain GDPR compliance requirements', 'What should a SaaS contract include?'],
  },
  {
    id: 'marketing', name: 'Marketing Strategist', emoji: '🚀',
    desc: 'Growth strategy, campaign planning & brand positioning',
    tags: ['Marketing', 'Growth'],
    color: '#f472b6', bg: 'rgba(219,39,119,0.15)',
    systemPrompt: 'You are Marketing Strategist, an expert in digital marketing and growth. Create actionable strategies with clear KPIs, target audience analysis, and channel recommendations. Focus on measurable outcomes.',
    starters: ['Create a go-to-market strategy', 'Plan a product launch campaign', 'How to improve conversion rates?'],
  },
  {
    id: 'finance',   name: 'Finance Advisor',     emoji: '💹',
    desc: 'Financial modeling, market analysis & investment insights',
    tags: ['Finance', 'Investment'],
    color: '#2dd4bf', bg: 'rgba(20,184,166,0.15)',
    systemPrompt: 'You are Finance Advisor, an expert in financial analysis and modeling. Provide clear financial insights, model scenarios, and explain complex financial concepts simply. Note: For informational purposes only.',
    starters: ['Explain DCF valuation simply', 'Build a startup financial model', 'Analyze SaaS unit economics'],
  },
  {
    id: 'product',   name: 'Product Manager',     emoji: '🎯',
    desc: 'Product strategy, roadmaps, user stories & PRDs',
    tags: ['Product', 'Strategy'],
    color: '#818cf8', bg: 'rgba(99,102,241,0.15)',
    systemPrompt: 'You are Product Manager, an expert in product development. Create clear PRDs, prioritize features using frameworks like RICE or ICE, and write actionable user stories. Focus on user value and business impact.',
    starters: ['Write a PRD for a search feature', 'Prioritize these features for Q1', 'Create user stories for onboarding'],
  },
]

function AgentCard({ agent, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl transition-all duration-150"
      style={{
        border: `1px solid ${selected ? agent.color + '60' : 'var(--border-color)'}`,
        backgroundColor: selected ? agent.bg : 'transparent',
        transform: selected ? 'none' : 'none',
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'var(--bg-input)'
          e.currentTarget.style.borderColor = agent.color + '40'
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'var(--border-color)'
        }
      }}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg shrink-0 leading-none mt-0.5">{agent.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className="text-sm font-semibold truncate" style={{ color: selected ? agent.color : 'var(--text-primary)' }}>
              {agent.name}
            </p>
          </div>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{agent.desc}</p>
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {agent.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: selected ? agent.color + '20' : 'var(--bg-input)', color: selected ? agent.color : 'var(--text-muted)' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

export default function Agents() {
  const [agentId, setAgentId]   = useState(AGENTS[0].id)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [model,    setModel]    = useState('gemini-2.5-flash')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [parsingFile,  setParsing]      = useState(false)
  const [toolsMode,    setToolsMode]    = useState(false)  // ← MCP tools toggle
  const abortRef  = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const modelPickerRef = useRef(null)

  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()

  useEffect(() => {
    const handler = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) setShowModelPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    try {
      const result = await parseFile(file)
      setAttachedFile({ name: file.name, text: result.text, chars: result.chars })
      toast.success(`${file.name} attached`)
    } catch (err) {
      toast.error(err.message || 'Could not parse file')
    } finally {
      setParsing(false)
    }
  }

  const agent = AGENTS.find(a => a.id === agentId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const switchAgent = (id) => {
    abortRef.current?.()
    setAgentId(id)
    setMessages([])
    setInput('')
    setBusy(false)
  }

  const stop = () => {
    abortRef.current?.()
    setBusy(false)
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m))
  }

  const trimHistory = (msgs) =>
    msgs.slice(-20).map(m => ({ role: m.role, content: (m.content || '').slice(0, 2000) }))

  const send = (text = input) => {
    if (!text.trim() || busy) return

    // Prepend file context if attached
    const fileContext = attachedFile
      ? `[Attached: ${attachedFile.name}]\n${attachedFile.text.slice(0, 6000)}\n\n---\n\n`
      : ''
    const fullMessage = fileContext + text

    setInput('')
    setAttachedFile(null)
    setBusy(true)

    const userMsg = { id: Date.now(), role: 'user', content: text, fileName: attachedFile?.name }
    setMessages(prev => [...prev, userMsg])

    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true, toolCalls: [] }])

    let full = ''
    const wsCtx = getContextString()
    const agentSystem = wsCtx ? `${wsCtx}\n\n---\n\n${agent.systemPrompt}` : agent.systemPrompt

    if (toolsMode) {
      // ── MCP tools mode ─────────────────────────────────────────────
      abortRef.current = streamChatTools(
        {
          message: fullMessage,
          model,
          history: trimHistory(messages),
          systemPrompt: agentSystem,
        },
        // onToken
        token => {
          full += token
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m))
        },
        // onToolCall — add new pending tool call
        (ev) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, toolCalls: [...(m.toolCalls || []), { id: ev.id, name: ev.name, input: ev.input }] }
              : m
          ))
        },
        // onToolResult — fill in the result
        (ev) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, toolCalls: (m.toolCalls || []).map(tc => tc.id === ev.id ? { ...tc, result: ev.result } : tc) }
              : m
          ))
        },
        // onDone
        () => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
          setBusy(false)
          abortRef.current = null
        },
        // onError
        err => {
          setMessages(prev => prev.map(m => m.id === assistantId
            ? { ...m, content: full || '⚠️ ' + err.message, streaming: false } : m))
          setBusy(false)
        },
      )
    } else {
      // ── Standard mode ───────────────────────────────────────────────
      abortRef.current = streamChat(
        {
          message: fullMessage,
          model,
          history: trimHistory(messages),
          systemPrompt: agentSystem,
        },
        token => {
          full += token
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m))
        },
        () => {
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
          setBusy(false)
          abortRef.current = null
        },
        err => {
          setMessages(prev => prev.map(m => m.id === assistantId
            ? { ...m, content: full || '⚠️ ' + err.message, streaming: false } : m))
          setBusy(false)
        },
      )
    }
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Agent list ─────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="p-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #059669, #34d399)' }}>
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Agent Fleet</h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{AGENTS.length} specialist agents</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {AGENTS.map(a => (
            <AgentCard key={a.id} agent={a} selected={agentId === a.id} onClick={() => switchAgent(a.id)} />
          ))}
        </div>
      </div>

      {/* ── Chat area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Agent header */}
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: agent.bg }}>
            {agent.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: agent.color }}>{agent.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{agent.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* MCP Tools toggle */}
            <button
              onClick={() => setToolsMode(v => !v)}
              title={toolsMode ? 'Disable MCP tools' : 'Enable MCP tools (web search, images, code execution…)'}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all border"
              style={{
                backgroundColor: toolsMode ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--bg-input)',
                borderColor: toolsMode ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'transparent',
                color: toolsMode ? 'var(--color-primary)' : 'var(--text-muted)',
              }}
            >
              <Wrench className="w-3 h-3" />
              <span className="hidden sm:inline">Tools</span>
              {toolsMode && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            </button>

            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setBusy(false); abortRef.current?.() }}
                className="btn-ghost text-xs py-1.5 px-3 rounded-lg gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Clear
              </button>
            )}
            {/* Model selector */}
            <div className="relative" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker(v => !v)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all border"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: showModelPicker ? agent.color : 'transparent',
                  color: 'var(--text-muted)',
                }}
              >
                <Sparkles className="w-3 h-3" style={{ color: agent.color }} />
                <span className="hidden sm:inline">{MODELS.find(m => m.id === model)?.label || model}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelPicker && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  <div className="p-1">
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m.id); setShowModelPicker(false) }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left"
                        style={{
                          backgroundColor: model === m.id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                          color: model === m.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                        }}
                        onMouseEnter={e => { if (model !== m.id) e.currentTarget.style.backgroundColor = 'var(--bg-input)' }}
                        onMouseLeave={e => { if (model !== m.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>{m.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 py-10">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl" style={{ backgroundColor: agent.bg }}>
                  {agent.emoji}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: agent.color }}>
                  <Zap className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="text-center max-w-xs">
                <p className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{agent.name}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{agent.desc}</p>
              </div>
              <div className="grid gap-2 w-full max-w-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Suggested prompts</p>
                {agent.starters.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 transition-all"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = agent.color + '60'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = agent.bg }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
                  >
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: agent.color }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : agent.bg }}>
                  {msg.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-white" />
                    : <span className="text-sm leading-none">{agent.emoji}</span>
                  }
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
                  style={msg.role === 'user'
                    ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' }
                    : { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }
                  }>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <>
                      {/* Tool calls */}
                      {msg.toolCalls?.length > 0 && (
                        <div className="mb-2">
                          {msg.toolCalls.map((tc, i) => (
                            <AgentToolCard key={tc.id || i} call={tc} />
                          ))}
                        </div>
                      )}
                      {/* Text response */}
                      {(msg.content || msg.streaming) && (
                        <div className={`prose-chat ${msg.streaming && !msg.toolCalls?.some(tc => !tc.result) ? 'typing-cursor' : ''}`}>
                          {msg.content
                            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                            : msg.streaming && (
                              <div className="flex gap-1 items-end h-5 py-1">
                                {[0,1,2].map(i => (
                                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                                    style={{ backgroundColor: 'var(--text-muted)', animationDelay: `${i*0.15}s` }} />
                                ))}
                              </div>
                            )
                          }
                        </div>
                      )}
                      {/* Inline image from generate_image tool */}
                      <InlineToolImage toolCalls={msg.toolCalls} />
                    </>
                  )}
                  {msg.role === 'assistant' && !msg.streaming && msg.content && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied') }}
                        className="p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {activeWorkspace && (
                        <button
                          onClick={() => { addArtifact({ type: 'chat', title: msg.content.slice(0, 60), content: msg.content.slice(0, 800), source: '/agents' }); toast.success('Added to workspace') }}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all"
                          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--color-primary-light)' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
                        >
                          <Zap className="w-3 h-3" /> Add to Workspace
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-5 pt-3">
          {/* Attached file chip */}
          {attachedFile && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl border text-xs"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
              <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} style={{ color: 'var(--text-muted)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.json" className="hidden" onChange={handleFileChange} />
          <div className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all"
            style={{ backgroundColor: 'var(--bg-input)', border: `1px solid var(--border-color)` }}
            onFocusCapture={e => { e.currentTarget.style.borderColor = agent.color + '80' }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
          >
            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingFile || busy}
              title="Attach file"
              className="shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              {parsingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={`Ask ${agent.name}…`}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none py-0.5"
              style={{ minHeight: '24px', maxHeight: '120px', color: 'var(--text-primary)' }}
            />
            {busy ? (
              <button
                onClick={stop}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                style={{ backgroundColor: '#dc2626' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#b91c1c' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#dc2626' }}
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40"
                style={{ backgroundColor: agent.color }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for new line · {MODELS.find(m => m.id === model)?.label || model}
            {toolsMode && <span style={{ color: 'var(--color-primary)' }}> · MCP Tools active</span>}
          </p>
        </div>
      </div>
    </div>
  )
}
