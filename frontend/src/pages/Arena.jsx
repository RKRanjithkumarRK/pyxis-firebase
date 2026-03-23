/**
 * Model Arena — side-by-side AI model battle.
 * Send the same prompt to 2 models simultaneously and vote for the winner.
 */
import { useState, useRef, useCallback } from 'react'
import { Swords, Send, RotateCcw, Copy, ThumbsUp, Zap, Trophy, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || ''

const MODELS = [
  { id: 'gemini-2.5-flash',                                    label: 'Gemini 2.5 Flash',   provider: 'Google',     color: '#60a5fa' },
  { id: 'gemini-2.0-flash',                                    label: 'Gemini 2.0 Flash',   provider: 'Google',     color: '#93c5fd' },
  { id: 'gemini-2.0-flash-lite',                               label: 'Gemini Flash Lite',  provider: 'Google',     color: '#38bdf8' },
  { id: 'liquid/lfm-2.5-1.2b-instruct:free',                  label: 'LFM 2.5',            provider: 'OpenRouter', color: '#4ade80' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',             label: 'Llama 3.3 70B',      provider: 'Meta',       color: '#fb923c' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free',      label: 'Mistral Small',      provider: 'Mistral',    color: '#c084fc' },
]

const MODES = [
  { id: 'chat',     label: '💬 General',   prompt: null },
  { id: 'code',     label: '⚡ Code',      prompt: 'You are an expert software engineer. Write precise, production-quality code with clear explanations.' },
  { id: 'research', label: '🔬 Research',  prompt: 'You are an expert researcher. Provide accurate, structured, well-sourced analysis.' },
  { id: 'creative', label: '✨ Creative',  prompt: 'You are a creative writer. Be expressive, imaginative, and compelling.' },
]

function ResponsePanel({ side, modelInfo, response, loading, time, isWinner, onVote, disabled }) {
  const tokens = response.length

  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        border: `2px solid ${isWinner ? modelInfo.color : 'var(--border-color)'}`,
        backgroundColor: 'var(--bg-card)',
        boxShadow: isWinner ? `0 0 30px ${modelInfo.color}30` : 'none',
      }}>

      {/* Panel header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: modelInfo.color }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: modelInfo.color }}>{modelInfo.label}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{modelInfo.provider}</p>
          </div>
          {isWinner && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
              style={{ backgroundColor: modelInfo.color + '20', color: modelInfo.color }}>
              <Trophy className="w-3 h-3" /> Winner
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: modelInfo.color, borderTopColor: 'transparent' }} />
              Thinking…
            </div>
          )}
          {time != null && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Zap className="w-3 h-3" style={{ color: modelInfo.color }} />
              {(time / 1000).toFixed(2)}s
            </span>
          )}
          {response && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ~{tokens} chars
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 prose-chat text-sm" style={{ minHeight: '280px', maxHeight: '420px' }}>
        {!response && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: modelInfo.color + '15' }}>
              <Swords className="w-5 h-5" style={{ color: modelInfo.color + '80' }} />
            </div>
            <p className="text-sm italic">Response will appear here…</p>
          </div>
        )}
        {response && (
          <div className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer */}
      {response && (
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { navigator.clipboard.writeText(response); toast.success('Copied!') }}
            className="btn-ghost text-xs gap-1.5 py-1.5 px-2.5 rounded-lg"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
          <button
            onClick={onVote}
            disabled={disabled}
            className="ml-auto text-xs gap-1.5 py-1.5 px-3 rounded-lg font-medium flex items-center transition-all"
            style={isWinner
              ? { backgroundColor: modelInfo.color + '20', color: modelInfo.color, border: `1px solid ${modelInfo.color}40` }
              : { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid transparent' }
            }
          >
            <ThumbsUp className="w-3 h-3" />
            {isWinner ? 'Winner ✓' : 'This is better'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Arena() {
  const { user } = useAuth()
  const [prompt, setPrompt]     = useState('')
  const [modelA, setModelA]     = useState(MODELS[0].id)
  const [modelB, setModelB]     = useState(MODELS[3].id)
  const [mode,   setMode]       = useState('chat')
  const [respA,  setRespA]      = useState('')
  const [respB,  setRespB]      = useState('')
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [timeA,  setTimeA]      = useState(null)
  const [timeB,  setTimeB]      = useState(null)
  const [winner, setWinner]     = useState(null)
  const [rounds, setRounds]     = useState({ A: 0, B: 0 })
  const [runCount, setRunCount] = useState(0)
  const abortA = useRef(null)
  const abortB = useRef(null)

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')
    return user.getIdToken()
  }, [user])

  const streamModel = async (model, setResp, setLoading, setTime, abortRef, systemPrompt) => {
    const token = await getToken()
    const t0 = Date.now()
    setLoading(true)
    setResp('')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: prompt, model, history: [], systemPrompt }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) setResp(r => r + parsed.content)
          } catch {}
        }
      }
      setTime(Date.now() - t0)
    } catch (e) {
      if (e.name !== 'AbortError') setResp('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const run = async () => {
    if (!prompt.trim()) return
    if (!user) { toast.error('Please sign in'); return }
    setWinner(null)
    setRunCount(n => n + 1)

    const systemPrompt = MODES.find(m => m.id === mode)?.prompt || null
    await Promise.all([
      streamModel(modelA, setRespA, setLoadingA, setTimeA, abortA, systemPrompt),
      streamModel(modelB, setRespB, setLoadingB, setTimeB, abortB, systemPrompt),
    ])
  }

  const vote = (side) => {
    setWinner(side)
    setRounds(r => ({ ...r, [side]: r[side] + 1 }))
    toast.success(`${side === 'A' ? modelAInfo.label : modelBInfo.label} wins this round! 🏆`)
  }

  const reset = () => {
    abortA.current?.abort()
    abortB.current?.abort()
    setRespA(''); setRespB('')
    setLoadingA(false); setLoadingB(false)
    setTimeA(null); setTimeB(null)
    setWinner(null); setPrompt('')
  }

  const modelAInfo = MODELS.find(m => m.id === modelA) || MODELS[0]
  const modelBInfo = MODELS.find(m => m.id === modelB) || MODELS[3]
  const isRunning = loadingA || loadingB

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Model Arena</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Battle AI models side-by-side in real-time</p>
        </div>
        {runCount > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <div className="text-center px-3 py-1.5 rounded-xl" style={{ backgroundColor: modelAInfo.color + '15', border: `1px solid ${modelAInfo.color}30` }}>
              <div className="font-bold text-base leading-none" style={{ color: modelAInfo.color }}>{rounds.A}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Model A wins</div>
            </div>
            <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>VS</div>
            <div className="text-center px-3 py-1.5 rounded-xl" style={{ backgroundColor: modelBInfo.color + '15', border: `1px solid ${modelBInfo.color}30` }}>
              <div className="font-bold text-base leading-none" style={{ color: modelBInfo.color }}>{rounds.B}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Model B wins</div>
            </div>
          </div>
        )}
        <button onClick={reset} className="btn-ghost text-xs gap-1.5 py-1.5 px-3 rounded-xl border" style={{ borderColor: 'var(--border-color)' }}>
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">

        {/* ── Controls ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Model A */}
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium mb-1.5" style={{ color: modelAInfo.color }}>
              Model A — {modelAInfo.provider}
            </label>
            <div className="relative">
              <select
                value={modelA}
                onChange={e => setModelA(e.target.value)}
                className="input pr-8 text-sm appearance-none font-medium"
                style={{ borderColor: modelAInfo.color + '40', color: modelAInfo.color }}
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: modelAInfo.color }} />
            </div>
          </div>

          {/* VS Badge */}
          <div className="pb-2 px-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)', color: 'white' }}>
              VS
            </div>
          </div>

          {/* Model B */}
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-medium mb-1.5" style={{ color: modelBInfo.color }}>
              Model B — {modelBInfo.provider}
            </label>
            <div className="relative">
              <select
                value={modelB}
                onChange={e => setModelB(e.target.value)}
                className="input pr-8 text-sm appearance-none font-medium"
                style={{ borderColor: modelBInfo.color + '40', color: modelBInfo.color }}
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: modelBInfo.color }} />
            </div>
          </div>

          {/* Mode pills */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Mode</label>
            <div className="flex gap-1.5">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={mode === m.id
                    ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' }
                    : { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Response Panels ───────────────────────────────────── */}
        <div className="flex gap-4 flex-1 overflow-hidden min-h-0">
          <ResponsePanel
            side="A"
            modelInfo={modelAInfo}
            response={respA}
            loading={loadingA}
            time={timeA}
            isWinner={winner === 'A'}
            onVote={() => vote('A')}
            disabled={isRunning || (!respA && !respB)}
          />
          <ResponsePanel
            side="B"
            modelInfo={modelBInfo}
            response={respB}
            loading={loadingB}
            time={timeB}
            isWinner={winner === 'B'}
            onVote={() => vote('B')}
            disabled={isRunning || (!respA && !respB)}
          />
        </div>

        {/* Speed comparison bar */}
        {timeA != null && timeB != null && (
          <div className="rounded-xl p-3 flex items-center gap-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>Speed</span>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs w-20 text-right truncate" style={{ color: modelAInfo.color }}>{modelAInfo.label}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((Math.min(timeA, timeB) / Math.max(timeA, timeB)) * 100)}%`,
                    backgroundColor: timeA < timeB ? modelAInfo.color : modelBInfo.color,
                  }} />
              </div>
              <span className="text-xs w-20 truncate" style={{ color: modelBInfo.color }}>{modelBInfo.label}</span>
            </div>
            <span className="text-xs font-semibold shrink-0" style={{ color: timeA < timeB ? modelAInfo.color : modelBInfo.color }}>
              {timeA < timeB ? modelAInfo.label : modelBInfo.label} faster by {Math.abs(timeA - timeB)}ms
            </span>
          </div>
        )}

        {/* ── Prompt input ──────────────────────────────────────── */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              className="input resize-none text-sm w-full pr-4"
              rows={2}
              placeholder="Enter your prompt and battle both models simultaneously…"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!isRunning) run()
                }
              }}
              style={{ paddingBottom: '8px' }}
            />
          </div>
          <button
            onClick={run}
            disabled={!prompt.trim() || isRunning}
            className="btn-primary px-5 self-end gap-2"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Racing…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Battle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
