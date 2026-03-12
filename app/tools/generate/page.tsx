'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, Video, Loader2, Music, RefreshCw, Download,
  Mic2, Volume2, CheckCircle2, Clapperboard, X, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'audio' | 'video'

// ── HuggingFace text-to-video (free, anonymous) ──────────────────────────────
// ModelScope / DAMO text-to-video-ms-1.7b — generates real MP4 clips from text
const HF_MODEL = 'https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b'
const MAX_WAIT_MS = 8 * 60 * 1000 // 8 min max (handles cold-start)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const EXAMPLES = [
  'ocean waves crashing at sunset',
  'golden retriever running on a beach',
  'cherry blossoms falling in the wind',
  'campfire burning at night in forest',
  'timelapse clouds over mountains',
  'city skyline at dusk with lights',
]

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState<Tab>('video')

  /* ── Audio ── */
  const [audioText,    setAudioText]    = useState('')
  const [audioVoice,   setAudioVoice]   = useState(0)
  const [audioRate,    setAudioRate]    = useState(1)
  const [audioPitch,   setAudioPitch]   = useState(1)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioVoices,  setAudioVoices]  = useState<SpeechSynthesisVoice[]>([])

  /* ── Video ── */
  const [vidPrompt,  setVidPrompt]  = useState('')
  const [vidLoading, setVidLoading] = useState(false)
  const [vidStatus,  setVidStatus]  = useState('')   // progress label
  const [vidError,   setVidError]   = useState('')
  const [videoUrl,   setVideoUrl]   = useState('')   // blob: URL of generated video
  const [elapsed,    setElapsed]    = useState(0)    // seconds elapsed

  const cancelRef     = useRef(false)
  const generatingRef = useRef(false)   // guard: prevents double-submit without causing re-render
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoBlobRef  = useRef('')

  /* ── TTS voices ── */
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
      if (v.length) setAudioVoices(v)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  /* ── Cleanup ── */
  useEffect(() => () => {
    clearInterval(timerRef.current!)
    if (videoBlobRef.current) URL.revokeObjectURL(videoBlobRef.current)
  }, [])

  /* ───────────── AUDIO ───────────── */
  const playAudio = () => {
    if (!audioText.trim()) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(audioText)
    if (audioVoices[audioVoice]) u.voice = audioVoices[audioVoice]
    u.rate = audioRate; u.pitch = audioPitch; u.volume = 1
    u.onstart = () => setAudioPlaying(true)
    u.onend   = () => setAudioPlaying(false)
    u.onerror = () => setAudioPlaying(false)
    window.speechSynthesis.speak(u)
  }
  const stopAudio = () => { window.speechSynthesis.cancel(); setAudioPlaying(false) }

  /* ───────────── VIDEO ───────────── */
  const cancelGeneration = () => {
    cancelRef.current = true
    generatingRef.current = false
    clearInterval(timerRef.current!)
    setVidLoading(false)
    setVidStatus('')
    setElapsed(0)
  }

  const generateVideo = useCallback(async () => {
    if (!vidPrompt.trim() || generatingRef.current) return

    cancelRef.current = false
    generatingRef.current = true
    setVidLoading(true)
    setVidError('')
    setVideoUrl('')
    setElapsed(0)
    if (videoBlobRef.current) { URL.revokeObjectURL(videoBlobRef.current); videoBlobRef.current = '' }

    // Elapsed timer
    const start = Date.now()
    clearInterval(timerRef.current!)
    timerRef.current = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000)

    setVidStatus('Connecting to Hugging Face AI…')

    try {
      let attempt = 0
      while (Date.now() - start < MAX_WAIT_MS) {
        if (cancelRef.current) return
        attempt++

        let res: Response
        try {
          res = await fetch(HF_MODEL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: vidPrompt.trim() }),
            signal: AbortSignal.timeout(90_000),
          })
        } catch {
          if (cancelRef.current) return
          setVidStatus(`Connection error — retrying… (attempt ${attempt})`)
          await sleep(5000)
          continue
        }

        if (cancelRef.current) return

        // ── Success ──
        if (res.ok) {
          setVidStatus('Processing video…')
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          videoBlobRef.current = url
          setVideoUrl(url)
          clearInterval(timerRef.current!)
          generatingRef.current = false
          setVidLoading(false)
          setVidStatus('')
          toast.success('AI video ready! 🎬')
          return
        }

        // ── Model loading (503) ──
        if (res.status === 503) {
          let waitSec = 30
          try {
            const j = await res.json()
            waitSec = Math.min(Math.ceil(j.estimated_time ?? 30), 180)
          } catch { /* ignore */ }
          setVidStatus(`AI model warming up… ~${waitSec}s`)
          await sleep(waitSec * 1000)
          if (!cancelRef.current) setVidStatus('Generating your video…')
          continue
        }

        // ── Rate limited (429) ──
        if (res.status === 429) {
          setVidStatus('Rate limited — waiting 30s before retry…')
          await sleep(30_000)
          continue
        }

        // ── Other error ──
        throw new Error(`HuggingFace returned ${res.status}`)
      }

      if (!cancelRef.current) {
        throw new Error('Timed out after 8 minutes. The AI service is overloaded — please try again later.')
      }
    } catch (err: any) {
      if (!cancelRef.current) {
        setVidError(err.message || 'Video generation failed. Please try again.')
        clearInterval(timerRef.current!)
      }
    } finally {
      generatingRef.current = false
      clearInterval(timerRef.current!)
      if (!cancelRef.current) {
        setVidLoading(false)
        setVidStatus('')
      }
    }
  }, [vidPrompt])

  const downloadVideo = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl; a.download = 'pyxis-ai-video.mp4'
    document.body.appendChild(a); a.click()
    document.body.removeChild(a)
    toast.success('Video downloaded!')
  }

  /* ─── RENDER ─── */
  const tabs = [
    { id: 'audio' as Tab, icon: Music,  label: 'Audio TTS' },
    { id: 'video' as Tab, icon: Video,  label: 'AI Video',  badge: 'Free' },
  ]

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center shadow-lg">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">AI Video &amp; Audio</h1>
            <p className="text-sm text-text-secondary">Generate real AI videos · Text to speech</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 mb-8 w-fit">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.id ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}>
                <Icon size={16} />{t.label}
                {t.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-green-500/20 text-green-400">{t.badge}</span>}
              </button>
            )
          })}
        </div>

        {/* ── AUDIO ── */}
        {activeTab === 'audio' && (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <Mic2 size={15} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Uses your browser&apos;s built-in Text-to-Speech — <strong className="text-text-primary">100% free, works offline.</strong> Chrome Desktop has the best voices.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Text to Speak</label>
              <textarea value={audioText} onChange={e => setAudioText(e.target.value)}
                placeholder="Enter any text you want to convert to speech…" rows={7}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent transition-colors"
              />
              <p className="text-[11px] text-text-tertiary mt-1">{audioText.length} characters</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Voice</label>
                <select value={audioVoice} onChange={e => setAudioVoice(Number(e.target.value))}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent">
                  {audioVoices.length > 0 ? audioVoices.map((v, i) => <option key={i} value={i}>{v.name}</option>) : <option>Loading voices…</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Speed: {audioRate}x</label>
                <input type="range" min="0.5" max="2" step="0.1" value={audioRate} onChange={e => setAudioRate(Number(e.target.value))} className="w-full accent-accent mt-3" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Pitch: {audioPitch.toFixed(1)}</label>
              <input type="range" min="0.5" max="2" step="0.1" value={audioPitch} onChange={e => setAudioPitch(Number(e.target.value))} className="w-full accent-accent" />
            </div>
            <div className="flex gap-3">
              {audioPlaying
                ? <button onClick={stopAudio} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">Stop</button>
                : <button onClick={playAudio} disabled={!audioText.trim()} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold disabled:opacity-50 shadow-lg hover:from-cyan-600 hover:to-blue-600 transition-all">
                    <Volume2 size={16} />Play Audio
                  </button>}
            </div>
          </div>
        )}

        {/* ── VIDEO ── */}
        {activeTab === 'video' && (
          <div className="space-y-5">

            {/* Info banner */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-green-500/5 border border-green-500/20">
              <CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-text-secondary leading-relaxed">
                <strong className="text-green-400">Real AI video generation</strong> — powered by Hugging Face&apos;s text-to-video AI model.
                Generates actual video with motion from your prompt. <strong className="text-text-primary">Free, no account needed.</strong>
                <span className="text-text-tertiary"> May take 1–3 minutes while the model loads.</span>
              </p>
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Describe your video</label>
                <span className={`text-xs ${vidPrompt.length > 130 ? 'text-amber-400' : 'text-text-tertiary'}`}>{vidPrompt.length}/150</span>
              </div>
              <textarea
                value={vidPrompt}
                onChange={e => setVidPrompt(e.target.value.slice(0, 150))}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generateVideo() }}
                placeholder="e.g. 'ocean waves crashing at sunset on a tropical beach'"
                rows={3}
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent transition-colors"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map(ex => (
                  <button key={ex} onClick={() => setVidPrompt(ex)}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-surface border border-border text-text-tertiary hover:text-text-primary hover:border-accent/40 transition-all">
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate / Cancel */}
            {!vidLoading ? (
              <button onClick={generateVideo} disabled={!vidPrompt.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
                <Clapperboard size={16} />Generate AI Video
              </button>
            ) : (
              <button onClick={cancelGeneration}
                className="w-full py-3.5 rounded-xl bg-surface border border-border text-text-secondary hover:bg-surface-hover text-sm font-medium flex items-center justify-center gap-2 transition-all">
                <X size={16} />Cancel
              </button>
            )}

            {/* ── Video player / Loading / Error ── */}
            <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-border"
              style={{ aspectRatio: '16/9' }}>

              {/* Loading */}
              {vidLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
                  {/* Animated ring */}
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Clapperboard size={28} className="text-violet-400" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-white text-sm font-medium">{vidStatus || 'Generating…'}</p>
                    {elapsed > 0 && <p className="text-white/40 text-xs">{elapsed}s elapsed</p>}
                  </div>
                  <p className="text-white/25 text-[10px] text-center max-w-xs px-4">
                    First-time generation warms up the AI model. Subsequent videos are faster.
                  </p>
                </div>
              )}

              {/* Error */}
              {!vidLoading && vidError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-6">
                  <AlertCircle size={32} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm text-center leading-relaxed">{vidError}</p>
                  <button onClick={() => { setVidError(''); generateVideo() }}
                    className="px-5 py-2 rounded-xl bg-accent/20 text-accent text-xs font-semibold hover:bg-accent/30 transition-colors">
                    Try Again
                  </button>
                </div>
              )}

              {/* Empty */}
              {!vidLoading && !vidError && !videoUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Video size={44} className="text-white/10" />
                  <p className="text-white/30 text-sm">Your AI video will appear here</p>
                  <p className="text-white/15 text-xs">Enter a prompt and click Generate</p>
                </div>
              )}

              {/* ── Actual AI Video ── */}
              {videoUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="w-full h-full object-contain bg-black"
                />
              )}
            </div>

            {/* Action buttons (post-generation) */}
            {videoUrl && !vidLoading && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setVideoUrl(''); setVidError('') }}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-border text-text-secondary hover:bg-surface-hover text-xs font-medium transition-colors">
                  <RefreshCw size={13} />Generate New
                </button>
                <button onClick={downloadVideo}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 text-xs font-medium transition-colors">
                  <Download size={13} />Download Video
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
