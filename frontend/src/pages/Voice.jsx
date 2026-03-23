import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic, Square, Bot, Loader2, Volume2, VolumeX, User, MicOff, Zap,
  Radio, PanelRight, PanelRightClose, Settings2, Image, ExternalLink,
  ChevronDown, X, FlaskConical, Code, Trash2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat, apiJSON } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition

const LS_VOICE_HISTORY = 'pyxis_voice_history'
const MAX_VOICE_HISTORY = 50

function loadVoiceHistory() {
  try { return JSON.parse(localStorage.getItem(LS_VOICE_HISTORY) || '[]') } catch { return [] }
}
function saveVoiceHistory(h) {
  try { localStorage.setItem(LS_VOICE_HISTORY, JSON.stringify(h.slice(0, MAX_VOICE_HISTORY))) } catch {}
}

// ── Available models ────────────────────────────────────────────────────────
const VOICE_MODELS = [
  { id: 'gemini-2.5-flash',            label: 'Gemini 2.5 Flash',    badge: 'Best'   },
  { id: 'gemini-2.0-flash',            label: 'Gemini 2.0 Flash',    badge: 'Fast'   },
  { id: 'gemini-2.0-flash-lite',       label: 'Gemini Lite',         badge: 'Lite'   },
  { id: 'llama-3.3-70b-versatile',     label: 'Llama 3.3 (Groq)',    badge: 'Fast'   },
  { id: 'llama-3.1-8b-instant',        label: 'Llama 3.1 8B (Groq)', badge: 'Instant'},
  { id: 'llama3.3-70b',                label: 'Llama 3.3 (Cerebras)',badge: '2k t/s' },
  { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini',         badge: 'Smart'  },
  { id: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 (SambaNova)',badge: 'Free'  },
]

// ── Web Audio VAD ──────────────────────────────────────────────────────────
function setupVAD(stream, onSilence) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  const source = audioCtx.createMediaStreamSource(stream)
  source.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)

  const SILENCE_THRESHOLD = 12
  const SILENCE_DURATION  = 600
  let silenceStart = null
  let active = true

  const checkVAD = () => {
    if (!active) return
    analyser.getByteFrequencyData(data)
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)

    if (rms < SILENCE_THRESHOLD) {
      if (!silenceStart) silenceStart = Date.now()
      else if (Date.now() - silenceStart > SILENCE_DURATION) {
        silenceStart = null
        active = false
        onSilence()
        return
      }
    } else {
      silenceStart = null
    }
    requestAnimationFrame(checkVAD)
  }
  checkVAD()

  return {
    audioCtx,
    cleanup: () => {
      active = false
      audioCtx.close().catch(() => {})
    },
  }
}

export default function Voice() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [listening,       setListening]       = useState(false)
  const [processing,      setProcessing]      = useState(false)
  const [isSpeaking,      setIsSpeaking]      = useState(false)
  const [transcript,      setTranscript]      = useState('')
  const [interim,         setInterim]         = useState('')
  const [response,        setResponse]        = useState('')
  const [history,         setHistory]         = useState(loadVoiceHistory)
  const [showHistory,     setShowHistory]     = useState(true)
  const [continuousMode,  setContinuousMode]  = useState(true)
  const [supported]                           = useState(!!SpeechRec)
  const [model,           setModel]           = useState('gemini-2.0-flash')
  const [showModelPicker, setShowModelPicker] = useState(false)
  // Inline image generation state
  const [imageLoading,    setImageLoading]    = useState(false)
  const [imageResult,     setImageResult]     = useState(null)   // { url, prompt, source }
  // Active intent for action links
  const [activeIntent,    setActiveIntent]    = useState(null)   // null | 'research' | 'code'

  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()

  // ── Refs ───────────────────────────────────────────────────────────────────
  const recRef        = useRef(null)
  const abortRef      = useRef(null)
  const finalRef      = useRef('')
  const vadActiveRef  = useRef(false)
  const vadCleanupRef = useRef(null)
  const streamRef     = useRef(null)
  const historyEndRef = useRef(null)
  const autoRestartRef           = useRef(false)
  const modelPickerRef           = useRef(null)
  const startListeningRef        = useRef(null) // holds latest startListeningContinuous to avoid stale closures

  // ── Auto-start continuous listening on mount ───────────────────────────────
  useEffect(() => {
    if (!supported) return
    const timer = setTimeout(() => {
      if (continuousMode) startListeningContinuous()
    }, 900)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => {
    autoRestartRef.current = false
    recRef.current?.abort()
    abortRef.current?.()
    vadCleanupRef.current?.cleanup()
    streamRef.current?.getTracks().forEach(t => t.stop())
    window.speechSynthesis?.cancel()
  }, [])

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── MCP: Inline Image Generation ──────────────────────────────────────────
  const generateImageInline = useCallback(async (prompt) => {
    setImageLoading(true)
    setImageResult(null)
    toast.success('Generating image…', { duration: 2000 })
    try {
      const data = await apiJSON('/api/images', {
        method: 'POST',
        body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
      })
      setImageResult(data)
      // Add to history
      setHistory(prev => {
        const next = [{ transcript: prompt, response: `[Image generated: ${prompt}]`, imageResult: data, ts: Date.now() }, ...prev].slice(0, MAX_VOICE_HISTORY)
        saveVoiceHistory(next)
        return next
      })
    } catch (err) {
      toast.error(err.message || 'Image generation failed')
    } finally {
      setImageLoading(false)
    }
  }, [])

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    if (!text || !window.speechSynthesis) { onDone?.(); return }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate   = 1.1
    utter.pitch  = 1.0
    utter.volume = 1.0

    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices[0]
      if (preferred) utter.voice = preferred
      setIsSpeaking(true)
      utter.onend   = () => { setIsSpeaking(false); onDone?.() }
      utter.onerror = () => { setIsSpeaking(false); onDone?.() }
      window.speechSynthesis.speak(utter)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoice()
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        loadVoice()
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  // ── Inline intent processing (research / code) ─────────────────────────────
  const processInline = useCallback((text, systemPrompt, intent) => {
    setProcessing(true)
    setResponse('')
    setImageResult(null)
    setActiveIntent(intent)
    let full = ''

    const wsCtx = getContextString()
    const finalSystemPrompt = wsCtx ? `${wsCtx}\n\n---\n\n${systemPrompt}` : systemPrompt

    abortRef.current = streamChat(
      { message: text, model, systemPrompt: finalSystemPrompt },
      token => {
        full += token
        setResponse(full)
      },
      () => {
        setProcessing(false)
        setHistory(prev => {
          const next = [{ transcript: text, response: full, intent, ts: Date.now() }, ...prev].slice(0, MAX_VOICE_HISTORY)
          saveVoiceHistory(next)
          return next
        })
        if (activeWorkspace) addArtifact({ type: 'voice', title: `Voice: ${text.slice(0, 40)}`, content: text, source: '/voice' })
        abortRef.current = null
        speak(full.slice(0, 280), () => {
          if (continuousMode && autoRestartRef.current) {
            setTimeout(() => { if (autoRestartRef.current) startListeningContinuous() }, 500)
          }
        })
      },
      err => {
        toast.error(err.message || 'Response failed')
        setProcessing(false)
        setActiveIntent(null)
        abortRef.current = null
      },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, model, continuousMode, activeWorkspace, addArtifact, getContextString])

  // ── Intent routing — fully inline MCP ─────────────────────────────────────
  const routeIntent = useCallback((text) => {
    const t = text.toLowerCase()

    // Image generation → inline, no navigation
    if (
      /generate|create|draw|make|paint|show me/.test(t) &&
      /image|picture|photo|art|artwork|illustration|portrait/.test(t)
    ) {
      const prompt = text
        .replace(/(?:please\s+)?(?:generate|create|draw|make|paint|show me)\s+(?:an?\s+)?(?:image|picture|photo|art|artwork|illustration|portrait)\s+(?:of\s+)?/gi, '')
        .trim() || text
      generateImageInline(prompt)
      return true
    }

    // Research → inline streaming (no navigation)
    if (
      /search for|research|look up|find out about|tell me about/.test(t) &&
      /latest|current|today|news|recent|trends/.test(t)
    ) {
      processInline(
        text,
        'You are Pyxis Research, an expert analyst. Provide a concise, well-structured research brief with key findings and actionable insights. Use markdown formatting with clear sections.',
        'research',
      )
      return true
    }

    // Code → inline streaming (no navigation)
    if (/write (the |some |a )?code|create (a |the )?program|code for|build a function|implement|write (a |an )?script/.test(t)) {
      processInline(
        text,
        'You are Pyxis Code Expert, a senior software engineer. Write clean, well-commented, production-ready code with a brief explanation. Always use markdown code blocks with the appropriate language.',
        'code',
      )
      return true
    }

    return false
  }, [generateImageInline, processInline])

  // ── Process text through AI ────────────────────────────────────────────────
  const processText = useCallback((text) => {
    if (!text.trim()) return

    if (routeIntent(text)) return

    setActiveIntent(null)
    setProcessing(true)
    setResponse('')
    setImageResult(null)
    let full = ''

    const wsCtx = getContextString()
    abortRef.current = streamChat(
      { message: text, model, ...(wsCtx ? { systemPrompt: wsCtx } : {}) },
      token => {
        full += token
        setResponse(full)
      },
      () => {
        setProcessing(false)
        setHistory(prev => {
          const next = [{ transcript: text, response: full, ts: Date.now() }, ...prev].slice(0, MAX_VOICE_HISTORY)
          saveVoiceHistory(next)
          return next
        })
        if (activeWorkspace) addArtifact({ type: 'voice', title: `Voice: ${text.slice(0, 40)}`, content: text, source: '/voice' })
        abortRef.current = null

        const afterSpeak = () => {
          if (continuousMode && autoRestartRef.current) {
            setTimeout(() => {
              if (autoRestartRef.current) startListeningContinuous()
            }, 500)
          }
        }
        speak(full, afterSpeak)
      },
      err => {
        toast.error(err.message || 'Response failed')
        setProcessing(false)
        abortRef.current = null
      },
      '/api/voice',
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, routeIntent, continuousMode, model, activeWorkspace, addArtifact, getContextString])

  // ── Open mic stream ────────────────────────────────────────────────────────
  const getMicStream = useCallback(async () => {
    if (streamRef.current && streamRef.current.active) return streamRef.current
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = s
      return s
    } catch {
      toast.error('Microphone permission denied. Please allow microphone access.')
      return null
    }
  }, [])

  // ── Continuous listening (with VAD) ────────────────────────────────────────
  const startListeningContinuous = useCallback(async () => {
    if (!supported) {
      toast.error('Voice recognition not supported (use Chrome or Edge)')
      return
    }
    stopSpeaking()
    abortRef.current?.()
    setProcessing(false)
    finalRef.current = ''
    setTranscript('')
    setInterim('')
    setResponse('')

    const stream = await getMicStream()
    if (!stream) return

    const rec = new SpeechRec()
    rec.continuous      = true
    rec.interimResults  = true
    rec.lang            = 'en-US'
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interimBuf = ''
      let finalBuf   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalBuf += t
        else interimBuf += t
      }
      if (finalBuf) {
        finalRef.current += finalBuf
        setTranscript(finalRef.current)
      }
      setInterim(interimBuf)
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
      vadActiveRef.current = false
      vadCleanupRef.current?.cleanup()
      const finalText = finalRef.current.trim()
      if (finalText) {
        processText(finalText)
      } else if (autoRestartRef.current) {
        // No speech detected — restart listening automatically so auto-listen stays active
        setTimeout(() => {
          if (autoRestartRef.current) startListeningRef.current?.()
        }, 300)
      }
    }

    rec.onerror = (e) => {
      setListening(false)
      setInterim('')
      vadActiveRef.current = false
      vadCleanupRef.current?.cleanup()
      if (e.error === 'no-speech') {
        // Restart silently on no-speech errors in continuous mode
        if (autoRestartRef.current) setTimeout(() => { if (autoRestartRef.current) startListeningRef.current?.() }, 300)
        return
      }
      if (e.error === 'not-allowed') { toast.error('Microphone permission denied.'); return }
      if (e.error !== 'aborted') toast.error(`Voice error: ${e.error}`)
    }

    recRef.current = rec
    vadActiveRef.current = true
    const vad = setupVAD(stream, () => {
      vadActiveRef.current = false
      recRef.current?.stop()
    })
    vadCleanupRef.current = vad

    try {
      rec.start()
      setListening(true)
      autoRestartRef.current = true
    } catch {
      toast.error('Could not start voice recognition')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, stopSpeaking, getMicStream, processText])

  // Keep ref updated so closures inside the callback can always call the latest version
  startListeningRef.current = startListeningContinuous

  // ── Push-to-talk ───────────────────────────────────────────────────────────
  const startListeningPTT = useCallback(() => {
    if (!supported) { toast.error('Voice recognition not supported (use Chrome or Edge)'); return }
    stopSpeaking()
    abortRef.current?.()
    setProcessing(false)
    finalRef.current = ''
    setTranscript('')
    setInterim('')
    setResponse('')
    autoRestartRef.current = false

    const rec = new SpeechRec()
    rec.continuous      = false
    rec.interimResults  = true
    rec.lang            = 'en-US'
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let interimBuf = ''
      let finalBuf   = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalBuf += t
        else interimBuf += t
      }
      if (finalBuf) { finalRef.current += finalBuf; setTranscript(finalRef.current) }
      setInterim(interimBuf)
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
      const finalText = finalRef.current.trim()
      if (finalText) processText(finalText)
    }

    rec.onerror = (e) => {
      setListening(false)
      setInterim('')
      if (e.error === 'no-speech') return
      if (e.error === 'not-allowed') { toast.error('Microphone permission denied.'); return }
      if (e.error !== 'aborted') toast.error(`Voice error: ${e.error}`)
    }

    recRef.current = rec
    try { rec.start(); setListening(true) }
    catch { toast.error('Could not start voice recognition') }
  }, [supported, stopSpeaking, processText])

  // ── Stop listening ─────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    autoRestartRef.current = false
    vadActiveRef.current   = false
    vadCleanupRef.current?.cleanup()
    recRef.current?.stop()
    setListening(false)
  }, [])

  // ── Main orb handler ───────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (isSpeaking)  { stopSpeaking(); return }
    if (listening)   { stopListening(); return }
    if (processing)  { abortRef.current?.(); setProcessing(false); autoRestartRef.current = false; return }
    if (continuousMode) startListeningContinuous()
    else                startListeningPTT()
  }, [isSpeaking, listening, processing, continuousMode,
      stopSpeaking, stopListening, startListeningContinuous, startListeningPTT])

  // ── Toggle mode ────────────────────────────────────────────────────────────
  const toggleMode = () => {
    if (listening) stopListening()
    autoRestartRef.current = false
    setContinuousMode(prev => !prev)
    if (continuousMode) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  // ── Derived status ─────────────────────────────────────────────────────────
  const statusText =
    imageLoading ? 'Generating image…' :
    listening  ? (interim || transcript || 'Listening…') :
    processing ? 'Generating response…' :
    isSpeaking ? 'Speaking…' :
    continuousMode ? 'Auto-listen mode ready' : 'Push-to-talk ready'

  const btnLabel =
    listening  ? (continuousMode ? 'Tap to cancel'  : 'Tap to send')  :
    processing ? 'Tap to stop'  :
    isSpeaking ? 'Tap to stop'  :
    continuousMode ? 'Tap to start auto-listen' : 'Tap to speak'

  const currentModel = VOICE_MODELS.find(m => m.id === model) || VOICE_MODELS[0]

  // ── Waveform ───────────────────────────────────────────────────────────────
  const WaveformBars = ({ count = 12, colorClass = 'bg-red-400', color = null }) => (
    <div className="flex items-end gap-0.5 h-8">
      {[...Array(count)].map((_, i) => {
        const heights = [3, 6, 10, 14, 10, 7, 12, 8, 5, 14, 9, 4]
        return (
          <div
            key={i}
            className={`w-1 ${color ? '' : colorClass} rounded-full animate-pulse`}
            style={{
              height: `${heights[i % heights.length]}px`,
              animationDelay: `${(i * 0.07).toFixed(2)}s`,
              animationDuration: `${0.5 + (i % 4) * 0.15}s`,
              ...(color ? { backgroundColor: color } : {}),
            }}
          />
        )
      })}
    </div>
  )

  return (
    <div
      className="flex h-full min-h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      {/* ── LEFT: Conversation History Panel ─────────────────────────────── */}
      <aside
        className={[
          'flex-shrink-0 flex flex-col border-r transition-all duration-300 overflow-hidden',
          showHistory ? 'w-72' : 'w-0',
          'hidden md:flex',
        ].join(' ')}
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}
      >
        {showHistory && (
          <>
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                History
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
                >
                  {history.length}
                </span>
                {history.length > 0 && (
                  <button
                    onClick={() => { if (window.confirm('Clear all voice history?')) { setHistory([]); saveVoiceHistory([]) } }}
                    className="p-1 rounded transition-colors"
                    title="Clear history"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 opacity-50">
                  <Radio className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No history yet</p>
                </div>
              ) : (
                [...history].map((h, i) => (
                  <div
                    key={i}
                    className="card px-3 py-2.5 cursor-default hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setTranscript(h.transcript)
                      setResponse(h.response || '')
                      if (h.imageResult) setImageResult(h.imageResult)
                    }}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <User className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                      <p className="text-xs leading-snug line-clamp-2 flex-1" style={{ color: 'var(--text-secondary)' }}>
                        {h.transcript}
                      </p>
                    </div>
                    {h.ts && (
                      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(h.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {h.imageResult ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Image className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Image generated</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <Bot className="w-3 h-3 mt-0.5 flex-shrink-0 text-teal-400" />
                        <p className="text-xs leading-snug line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                          {h.response}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={historyEndRef} />
            </div>
          </>
        )}
      </aside>

      {/* ── RIGHT: Main Voice Interface ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center overflow-y-auto">

        {/* Top bar */}
        <div
          className="w-full flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {/* Left: title */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
            >
              <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Voice Assistant
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {supported ? 'AI-powered · Images · Research · Code · all inline' : '⚠ Requires Chrome or Edge'}
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2">
            {/* Model picker */}
            <div className="relative" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: showModelPicker ? 'var(--color-primary)' : 'var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="hidden sm:inline">{currentModel.label}</span>
                <span className="sm:hidden">Model</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModelPicker && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-2xl overflow-hidden min-w-[200px]"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  <div className="p-1">
                    {VOICE_MODELS.map(m => (
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
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
                        >
                          {m.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mode toggle */}
            <button
              onClick={toggleMode}
              title={continuousMode ? 'Switch to Push-to-Talk' : 'Switch to Auto-listen (VAD)'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: continuousMode
                  ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                  : 'var(--bg-input)',
                color: continuousMode ? 'var(--color-primary)' : 'var(--text-secondary)',
                border: `1px solid ${continuousMode ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-color)'}`,
                transition: 'background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease',
              }}
            >
              {continuousMode ? <Radio className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {continuousMode ? 'Auto-listen' : 'Push-to-talk'}
              </span>
            </button>

            {/* History toggle */}
            <button
              onClick={() => setShowHistory(v => !v)}
              className="btn-ghost hidden md:flex p-2 rounded-lg"
              title={showHistory ? 'Hide history' : 'Show history'}
            >
              {showHistory
                ? <PanelRightClose className="w-4 h-4" />
                : <PanelRight      className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center area */}
        <div className="flex-1 w-full max-w-2xl px-6 py-8 flex flex-col items-center">

          {/* ── Microphone Orb ──────────────────────────────────── */}
          <div className="flex flex-col items-center gap-5 mb-10">
            <div className="relative flex items-center justify-center w-44 h-44">

              {/* Listening pulse rings */}
              {listening && <>
                <span className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', animationDuration: '1s' }} />
                <span className="absolute inset-3 rounded-full animate-ping"
                  style={{ backgroundColor: 'rgba(239,68,68,0.09)', animationDuration: '1.4s' }} />
                <span className="absolute inset-6 rounded-full animate-ping"
                  style={{ backgroundColor: 'rgba(239,68,68,0.06)', animationDuration: '1.8s' }} />
              </>}

              {/* Speaking pulse rings */}
              {isSpeaking && <>
                <span className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', animationDuration: '0.9s' }} />
                <span className="absolute inset-4 rounded-full animate-ping"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', animationDuration: '1.3s' }} />
              </>}

              {/* Processing / image loading rings */}
              {(processing || imageLoading) && <>
                <span className="absolute inset-2 rounded-full animate-ping"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', animationDuration: '1.1s' }} />
              </>}

              {/* Orb button */}
              <button
                onClick={handleTap}
                disabled={!supported || imageLoading}
                className="relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  backgroundColor: !supported
                    ? 'var(--bg-input)'
                    : imageLoading
                      ? 'color-mix(in srgb, var(--color-primary) 60%, black)'
                      : listening
                        ? '#dc2626'
                        : processing
                          ? 'var(--bg-card)'
                          : isSpeaking
                            ? 'color-mix(in srgb, var(--color-primary) 80%, #0d9488)'
                            : 'var(--color-primary)',
                  transform: listening ? 'scale(1.06)' : 'scale(1)',
                  boxShadow: listening
                    ? '0 0 40px rgba(239,68,68,0.35)'
                    : processing || isSpeaking
                      ? '0 0 40px color-mix(in srgb, var(--color-primary) 25%, transparent)'
                      : '0 0 40px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                  opacity: !supported ? 0.4 : 1,
                  cursor: (!supported || imageLoading) ? 'not-allowed' : 'pointer',
                }}
              >
                {imageLoading
                  ? <Image    className="w-11 h-11 text-white animate-pulse" />
                  : processing
                    ? <Loader2  className="w-11 h-11 text-white animate-spin" />
                    : listening
                      ? <Square   className="w-11 h-11 text-white fill-white" />
                      : isSpeaking
                        ? <VolumeX  className="w-11 h-11 text-white" />
                        : <Mic      className="w-11 h-11 text-white" />
                }
              </button>
            </div>

            {/* Waveform — always reserve space to prevent layout shift */}
            <div
              className="flex items-center gap-3 transition-opacity duration-200"
              style={{ opacity: (listening || isSpeaking) ? 1 : 0, pointerEvents: 'none' }}
            >
              {listening
                ? <WaveformBars count={12} colorClass="bg-red-400" />
                : <WaveformBars count={12} color="var(--color-primary)" />
              }
            </div>

            {/* Status */}
            <div className="flex flex-col items-center gap-1 min-h-[44px] text-center px-4">
              <div className="flex items-center gap-2">
                {imageLoading && <Image   className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--color-primary)' }} />}
                {isSpeaking  && <Volume2  className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--color-primary)' }} />}
                {processing  && <Loader2  className="w-3.5 h-3.5 animate-spin"  style={{ color: 'var(--color-primary)' }} />}
                {listening   && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                <p
                  className="text-sm font-medium"
                  style={{
                    color: listening   ? '#f87171'
                         : imageLoading ? 'var(--color-primary)'
                         : isSpeaking  ? 'var(--color-primary)'
                         : processing  ? 'var(--color-primary)'
                         : 'var(--text-muted)',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {statusText}
                </p>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                {btnLabel}
              </p>
            </div>
          </div>

          {/* ── Inline Image Result ───────────────────────────── */}
          {(imageResult || imageLoading) && (
            <div
              className="w-full rounded-2xl overflow-hidden mb-6 border"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              {imageLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)' }}>
                      <Image className="w-7 h-7 animate-pulse" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="absolute inset-0 rounded-xl animate-ping"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Generating your image…</p>
                </div>
              ) : imageResult && (
                <>
                  <div className="relative group">
                    <img
                      src={imageResult.url}
                      alt={imageResult.prompt}
                      className="w-full object-contain max-h-[400px]"
                      style={{ backgroundColor: 'var(--bg-app)' }}
                    />
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => navigate(`/images?prompt=${encodeURIComponent(imageResult.prompt)}`)}
                        className="flex items-center gap-2 text-white text-xs px-3 py-2 rounded-xl backdrop-blur"
                        style={{ backgroundColor: 'rgba(9,9,11,0.85)' }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open in Image Studio
                      </button>
                      <button
                        onClick={() => window.open(imageResult.url, '_blank')}
                        className="text-white text-xs p-2 rounded-xl backdrop-blur"
                        style={{ backgroundColor: 'rgba(9,9,11,0.85)' }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => setImageResult(null)}
                      className="absolute top-2 right-2 text-white p-1 rounded-lg backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: 'rgba(9,9,11,0.6)' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <Image className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-xs flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{imageResult.prompt}</p>
                    <button
                      onClick={() => navigate(`/images?prompt=${encodeURIComponent(imageResult.prompt)}`)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                      style={{ color: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}
                    >
                      <ExternalLink className="w-3 h-3" /> Studio
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Current Exchange ──────────────────────────────── */}
          {(transcript || interim || response || processing) ? (
            <div className="w-full space-y-4">

              {/* User bubble */}
              {(transcript || interim) && (
                <div className="flex gap-3 flex-row-reverse">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <p className="text-sm text-white leading-relaxed">
                      {transcript || interim}
                      {interim && !transcript && (
                        <span style={{ opacity: 0.6 }} className="ml-0.5">▌</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* AI bubble */}
              {(response || processing) && (
                <div className="flex gap-3">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                  >
                    <Bot className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div
                    className="card max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}
                  >
                    {response ? (
                      <div className={`prose-chat text-sm ${processing ? 'typing-cursor' : ''}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{response}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex gap-1 items-end h-5 py-1">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ backgroundColor: 'var(--text-muted)', animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Speaking indicator */}
                    {isSpeaking && response && (
                      <div
                        className="flex items-center gap-2 mt-2 pt-2"
                        style={{ borderTop: '1px solid var(--border-color)' }}
                      >
                        <div className="flex gap-0.5 items-end h-4">
                          {[...Array(6)].map((_, i) => (
                            <div
                              key={i}
                              className="w-0.5 rounded-full animate-pulse"
                              style={{
                                backgroundColor: 'var(--color-primary)',
                                height: `${5 + (i % 4) * 3}px`,
                                animationDelay: `${i * 0.1}s`,
                                animationDuration: '0.6s',
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-xs" style={{ color: 'var(--color-primary)' }}>Speaking…</span>
                        <button
                          onClick={stopSpeaking}
                          className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          <VolumeX className="w-3 h-3" /> Stop
                        </button>
                      </div>
                    )}

                    {/* Intent action links — Open in Studio */}
                    {!processing && response && activeIntent && (
                      <div className="flex items-center gap-2 mt-2 pt-2"
                        style={{ borderTop: '1px solid var(--border-color)' }}>
                        {activeIntent === 'research' && (
                          <button
                            onClick={() => navigate(`/research?q=${encodeURIComponent(transcript)}`)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}
                          >
                            <FlaskConical className="w-3.5 h-3.5" /> Open in Research Studio
                          </button>
                        )}
                        {activeIntent === 'code' && (
                          <button
                            onClick={() => navigate(`/code?task=${encodeURIComponent(transcript)}`)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}
                          >
                            <Code className="w-3.5 h-3.5" /> Open in Code Studio
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : !imageResult && !imageLoading && (
            <div className="text-center py-10 opacity-50 select-none">
              <MicOff className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {supported ? 'Ready to listen' : 'Browser not supported'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {supported
                  ? continuousMode
                    ? 'Tap the orb · "Generate image of…" · "Research latest…" · "Write code for…"'
                    : 'Tap the orb to speak, release when done'
                  : 'Use Chrome or Edge for voice support'}
              </p>
            </div>
          )}

          {/* ── Mobile history ───────────────────────────────── */}
          {history.length > 0 && (
            <div className="w-full mt-8 md:hidden">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl mb-2"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Session History ({history.length})
                </span>
                {showHistory
                  ? <PanelRightClose className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  : <PanelRight      className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
              </button>

              {showHistory && (
                <div className="space-y-2">
                  {[...history].map((h, i) => (
                    <div key={i} className="card px-3 py-2.5 opacity-70 hover:opacity-90 transition-opacity cursor-default">
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        <span className="mr-1.5" style={{ color: 'var(--color-primary)' }}>You:</span>{h.transcript}
                      </p>
                      {h.imageResult ? (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="mr-1.5" style={{ color: 'var(--color-primary)' }}>Pyxis:</span>[Image generated]
                        </p>
                      ) : (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          <span className="text-teal-400 mr-1.5">Pyxis:</span>{h.response}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
