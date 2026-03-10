'use client'

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Phase   = 'idle' | 'listening' | 'thinking' | 'speaking'
type MsgRole = 'user' | 'assistant' | 'error'
type Message = { id: number; role: MsgRole; text: string; searched?: boolean }

/* ─── Constants ──────────────────────────────────────────────────────────── */
const SILENCE_MS = 1200
const SYSTEM =
  'You are Pyxis, a friendly and helpful voice AI assistant. ' +
  'Reply in 1–3 short conversational sentences. ' +
  'No markdown, bullets, headers, or lists — plain spoken language only. ' +
  'Never reveal your underlying model name, provider, or that you are built on any other AI. ' +
  'You are Pyxis. Always.'

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function VoicePage() {
  const router       = useRouter()
  const { getToken } = useAuth()

  const [phase,     setPhase]     = useState<Phase>('idle')
  const [active,    setActive]    = useState(false)
  const [userText,  setUserText]  = useState('')
  const [textInput, setTextInput] = useState('')
  const [messages,  setMessages]  = useState<Message[]>([])

  /* ── stable refs ── */
  const phaseRef       = useRef<Phase>('idle')
  const activeRef      = useRef(false)
  const recRef         = useRef<any>(null)
  const silenceRef     = useRef<any>(null)
  const accRef         = useRef('')
  const lastFullRef    = useRef('')
  const historyRef     = useRef<{ role: string; content: string }[]>([])
  const startListenRef = useRef<() => void>(() => {})
  const inputRef       = useRef<HTMLInputElement>(null)
  const msgEndRef      = useRef<HTMLDivElement>(null)
  const msgIdRef       = useRef(0)

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  /* ── add a message to chat history ── */
  const addMsg = useCallback((role: MsgRole, text: string) => {
    setMessages(prev => [...prev, { id: ++msgIdRef.current, role, text }])
  }, [])

  /* ── auto-scroll on new messages ── */
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ─── kill recognition ────────────────────────────────────────────────── */
  const stopRec = () => {
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null }
    if (recRef.current)     { try { recRef.current.abort() } catch {} recRef.current = null }
  }

  /* ─── TTS → then auto-restart listening ─────────────────────────────── */
  const speakThenListen = useCallback((text: string) => {
    if (!activeRef.current) return
    setP('speaking')

    window.speechSynthesis.cancel()

    setTimeout(() => {
      if (!activeRef.current) return

      const utter = new SpeechSynthesisUtterance(text)

      /* pick best English voice — wait for voices to load if needed */
      const trySpeak = () => {
        const voices = window.speechSynthesis.getVoices()
        utter.voice =
          voices.find(v => v.name === 'Google US English') ||
          voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
          voices.find(v => !v.localService && v.lang.startsWith('en')) ||
          voices.find(v => v.lang.startsWith('en')) ||
          null
        utter.rate = 1.05; utter.pitch = 1; utter.volume = 1

        let fired = false
        let ttsStarted = false
        const done = () => {
          if (fired) return; fired = true
          clearInterval(pollId); clearInterval(keepAlive); clearTimeout(fallback)
          if (!activeRef.current) return
          setP('idle')
          setTimeout(() => startListenRef.current(), 150)
        }
        utter.onstart = () => { ttsStarted = true }
        utter.onend   = done
        utter.onerror = done
        window.speechSynthesis.speak(utter)

        /* poll: catches Chrome bug where onend never fires */
        const pollId = setInterval(() => {
          if (ttsStarted && !window.speechSynthesis.speaking) done()
        }, 300)

        /* keep-alive: Chrome pauses TTS after ~15 s */
        const keepAlive = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause()
            window.speechSynthesis.resume()
          }
        }, 10000)

        /* absolute fallback — never get stuck */
        const fallback = setTimeout(done, Math.max(text.length * 75, 5000))
      }

      /* if no voices loaded yet, wait for voiceschanged */
      if (window.speechSynthesis.getVoices().length > 0) {
        trySpeak()
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null
          trySpeak()
        }
        /* fallback if voiceschanged never fires */
        setTimeout(trySpeak, 500)
      }
    }, 120)
  }, [])

  /* ─── Call AI ─────────────────────────────────────────────────────────── */
  const callAI = useCallback(async (text: string) => {
    if (!text.trim() || !activeRef.current) return

    setP('thinking')
    setUserText(text.trim())

    historyRef.current = [...historyRef.current, { role: 'user', content: text.trim() }]

    try {
      const token = await getToken()
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: historyRef.current, systemPrompt: SYSTEM }),
      })

      if (!activeRef.current) return

      let data: any
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }

      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      const reply   = (data.reply || "Sorry, I didn't get a response.").trim()
      const searched = !!data.searched
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }]
      setMessages(prev => [...prev, { id: ++msgIdRef.current, role: 'assistant', text: reply, searched }])
      speakThenListen(reply)

    } catch (err: any) {
      const msg = err.message || 'Connection error'
      addMsg('error', msg)
      if (activeRef.current) {
        setP('idle')
        setUserText('')
        setTimeout(() => startListenRef.current(), 300)
      }
    }
  }, [speakThenListen, addMsg, getToken])

  /* ─── Start listening ─────────────────────────────────────────────────── */
  const startListening = useCallback(() => {
    if (!activeRef.current || phaseRef.current !== 'idle') return

    stopRec()
    accRef.current = ''
    lastFullRef.current = ''
    setUserText('')
    setP('listening')

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SR) {
      alert('Voice mode requires Chrome or Edge. Please switch browsers.')
      return
    }

    const r = new SR()
    recRef.current = r
    r.continuous     = true
    r.interimResults = true
    r.lang           = 'en-US'

    r.onresult = (e: any) => {
      if (!activeRef.current) return
      if (silenceRef.current) clearTimeout(silenceRef.current)

      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) accRef.current += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      const full = (accRef.current + interim).trim()
      if (full) {
        lastFullRef.current = full
        setUserText(full)
      }

      if (full) {
        silenceRef.current = setTimeout(() => {
          const toSend = (accRef.current || lastFullRef.current).trim()
          if (toSend && activeRef.current) {
            addMsg('user', toSend)
            stopRec()
            callAI(toSend)
          }
        }, SILENCE_MS)
      }
    }

    r.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        alert('Microphone access denied. Click the 🔒 in the address bar → allow microphone.')
        activeRef.current = false; setActive(false); setP('idle'); return
      }
      if (activeRef.current && phaseRef.current === 'listening') {
        setTimeout(() => startListenRef.current(), 400)
      }
    }

    r.onend = () => {
      if (silenceRef.current) clearTimeout(silenceRef.current)
      if (!activeRef.current || phaseRef.current !== 'listening') return
      const text = (accRef.current || lastFullRef.current).trim()
      if (text) {
        addMsg('user', text)
        callAI(text)
      } else {
        setTimeout(() => startListenRef.current(), 200)
      }
    }

    try { r.start() } catch { setP('idle') }
  }, [callAI, addMsg])

  /* keep ref fresh */
  useEffect(() => { startListenRef.current = startListening }, [startListening])

  /* ─── Send typed text ────────────────────────────────────────────────── */
  const sendText = useCallback(() => {
    const t = textInput.trim()
    if (!t || phase === 'thinking' || phase === 'speaking') return
    setTextInput('')
    stopRec()
    if (!activeRef.current) {
      activeRef.current = true
      setActive(true)
      historyRef.current = []
      setMessages([])
    }
    addMsg('user', t)
    setUserText(t)
    callAI(t)
  }, [textInput, phase, callAI, addMsg])

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); sendText() }
  }

  /* ─── Start / End voice session ──────────────────────────────────────── */
  const startVoice = () => {
    activeRef.current = true
    setActive(true)
    historyRef.current = []
    setMessages([])
    setUserText('')
    setP('idle')
    setTimeout(() => startListenRef.current(), 80)
  }

  const endVoice = useCallback(() => {
    activeRef.current = false
    setActive(false)
    window.speechSynthesis.cancel()
    stopRec()
    setP('idle')
    router.push('/hub')
  }, [router])

  /* ─── Orb tap ──────────────────────────────────────────────────────────── */
  const tapOrb = () => {
    if (!active) { startVoice(); return }
    if (phase === 'speaking') {
      window.speechSynthesis.cancel()
      setP('idle')
      setTimeout(() => startListenRef.current(), 150)
    }
  }

  /* ─── Cleanup on unmount ──────────────────────────────────────────────── */
  useEffect(() => () => {
    activeRef.current = false
    window.speechSynthesis.cancel()
    if (silenceRef.current) clearTimeout(silenceRef.current)
    if (recRef.current) { try { recRef.current.abort() } catch {} }
  }, [])

  /* ─── Derived booleans ─────────────────────────────────────────────────── */
  const isListening = phase === 'listening'
  const isThinking  = phase === 'thinking'
  const isSpeaking  = phase === 'speaking'
  const isIdle      = phase === 'idle'

  /* ─── Orb appearance by phase ─────────────────────────────────────────── */
  const orbBg = !active
    ? 'radial-gradient(circle at 38% 32%, #3f3f46, #18181b)'
    : isListening
    ? 'radial-gradient(circle at 38% 32%, #818cf8, #4f46e5, #3730a3)'
    : isThinking
    ? 'radial-gradient(circle at 38% 32%, #fde68a, #f59e0b, #b45309)'
    : isSpeaking
    ? 'radial-gradient(circle at 38% 32%, #6ee7b7, #10b981, #059669)'
    : 'radial-gradient(circle at 38% 32%, #6366f1, #4338ca, #3730a3)'

  const orbGlow = !active
    ? 'none'
    : isListening
    ? '0 0 80px rgba(99,102,241,0.5), 0 0 160px rgba(99,102,241,0.12)'
    : isThinking
    ? '0 0 60px rgba(245,158,11,0.4)'
    : isSpeaking
    ? '0 0 80px rgba(16,185,129,0.5), 0 0 160px rgba(16,185,129,0.12)'
    : '0 0 50px rgba(99,102,241,0.25)'

  const orbAnim = !active
    ? 'none'
    : isThinking
    ? 'orbSpin 4s linear infinite'
    : 'orbBreathe 2s ease-in-out infinite'

  const ringColor = isSpeaking ? 'rgba(16,185,129,' : 'rgba(99,102,241,'

  /* ─── Status ───────────────────────────────────────────────────────────── */
  const statusText = !active ? 'Tap orb to start'
    : isListening ? 'Listening…'
    : isThinking  ? 'Thinking…'
    : isSpeaking  ? 'Speaking…'
    : 'Ready'

  const statusColor = !active ? 'text-zinc-600'
    : isListening ? 'text-indigo-400'
    : isThinking  ? 'text-amber-400'
    : isSpeaking  ? 'text-emerald-400'
    : 'text-zinc-500'

  /* ─── JSX ─────────────────────────────────────────────────────────────── */
  return (
    <div className="h-[100dvh] bg-black flex flex-col items-center overflow-hidden select-none">

      {/* ── Top bar ── */}
      <div className="w-full flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
        <button
          onClick={() => { endVoice() }}
          className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="text-[11px]">Hub</span>
        </button>
        <span className="text-zinc-700 text-[10px] tracking-[0.3em] uppercase font-medium">
          Pyxis Voice
        </span>
        {active ? (
          <button
            onClick={endVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800
                       hover:bg-red-950/60 hover:border-red-900/50 transition-all duration-200"
          >
            <X size={12} className="text-zinc-500" />
            <span className="text-zinc-500 text-[11px]">End</span>
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* ── Orb section ── */}
      <div className="flex flex-col items-center gap-3 pt-1 pb-4 flex-shrink-0">

        {/* Live transcript above orb */}
        <div className="h-7 flex items-center justify-center w-full max-w-xs px-6">
          {userText && (isListening || isThinking) && (
            <p className="text-[12px] text-zinc-500 leading-relaxed truncate animate-appear">
              {userText}
            </p>
          )}
        </div>

        {/* THE ORB */}
        <div
          onClick={tapOrb}
          className="relative flex items-center justify-center cursor-pointer"
          style={{ width: 148, height: 148 }}
        >
          {/* Pulse rings */}
          {(isListening || isSpeaking) && [0, 1].map(i => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{
              width:  132 + i * 18,
              height: 132 + i * 18,
              background: `${ringColor}${i === 0 ? '0.08' : '0.04'})`,
              animation: `orbRing 2.2s ease-in-out ${i * 0.45}s infinite`,
            }} />
          ))}

          {/* Core orb */}
          <div
            className="rounded-full flex items-center justify-center relative"
            style={{
              width: 112, height: 112,
              background:  orbBg,
              boxShadow:   orbGlow,
              animation:   orbAnim,
              transition:  'background 0.6s ease, box-shadow 0.6s ease',
            }}
          >
            {!active && (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-zinc-600">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            )}

            {isListening && (
              <div className="flex gap-[3px] items-end" style={{ height: 34 }}>
                {[0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.8, 0.5, 0.9].map((h, i) => (
                  <div key={i} style={{
                    width: 3, height: `${h * 100}%`,
                    background: 'white', borderRadius: 4, opacity: 0.9,
                    animation: `waveBar 0.42s ease-in-out ${i * 0.055}s infinite alternate`,
                  }} />
                ))}
              </div>
            )}

            {isThinking && (
              <div className="flex gap-2 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', background: 'white', opacity: 0.9,
                    animation: `dotBounce 0.85s ease-in-out ${i * 0.14}s infinite`,
                  }} />
                ))}
              </div>
            )}

            {isSpeaking && (
              <div className="flex gap-[3px] items-center" style={{ height: 34 }}>
                {[0.45, 0.9, 0.55, 1, 0.35, 0.85, 0.6, 1, 0.5].map((h, i) => (
                  <div key={i} style={{
                    width: 3, height: `${h * 100}%`,
                    background: 'white', borderRadius: 4, opacity: 0.85,
                    animation: `waveBar 0.38s ease-in-out ${i * 0.05}s infinite alternate`,
                  }} />
                ))}
              </div>
            )}

            {isIdle && active && (
              <div style={{
                width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,255,255,0.55)',
                animation: 'idleDot 2s ease-in-out infinite',
              }} />
            )}

            {/* Specular */}
            <div className="absolute pointer-events-none rounded-full" style={{
              width: 44, height: 22, top: 12, left: 16,
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.17) 0%, transparent 70%)',
            }} />
          </div>
        </div>

        {/* Status */}
        <p className={`text-[12px] ${statusColor} transition-colors duration-300`}>
          {statusText}
          {isSpeaking && (
            <span className="text-zinc-700 text-[11px] ml-1.5">· tap to stop</span>
          )}
        </p>
      </div>

      {/* ── Message History ── */}
      <div className="flex-1 w-full max-w-sm overflow-y-auto px-4 space-y-2.5 pb-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full pb-4">
            <p className="text-zinc-700 text-xs text-center leading-relaxed">
              {active
                ? 'Speak now — or type below to chat'
                : 'Tap the orb to talk\nor type a message below'}
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`animate-appear flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'error' ? (
                <div className="max-w-[88%] px-3 py-2 rounded-2xl bg-red-950/30 border border-red-900/25">
                  <p className="text-[12px] text-red-400/75 leading-relaxed">⚠ {msg.text}</p>
                </div>
              ) : (
                <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-[13.5px] leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-zinc-800 text-zinc-200 rounded-br-sm'
                    : 'bg-zinc-900 border border-zinc-800/50 text-zinc-100 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                  {msg.searched && (
                    <span className="block mt-1.5 text-[10px] text-teal-500/60">
                      🌐 Used live web search
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={msgEndRef} />
      </div>

      {/* ── Bottom input ── */}
      <div className="w-full max-w-sm px-4 pt-2 flex-shrink-0" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2
                        transition-colors focus-within:border-zinc-700">
          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              isListening ? 'Listening…'
              : isThinking ? 'Thinking…'
              : isSpeaking ? 'Speaking…'
              : 'Type a message…'
            }
            disabled={phase === 'thinking' || phase === 'speaking'}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-700 outline-none"
          />
          <button
            onClick={sendText}
            disabled={!textInput.trim() || phase === 'thinking' || phase === 'speaking'}
            className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center
                       disabled:opacity-20 transition-opacity hover:bg-indigo-500"
          >
            <Send size={13} className="text-white" />
          </button>
        </div>
        {!active && (
          <p className="text-center text-zinc-700 text-[10px] mt-2">
            Chrome recommended for voice mode
          </p>
        )}
      </div>

    </div>
  )
}
