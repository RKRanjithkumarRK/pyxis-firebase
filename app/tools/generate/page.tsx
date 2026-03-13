'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, Video, Music, RefreshCw, Download,
  Mic2, Volume2, X, Film, Upload, ImageIcon, AlertCircle,
  ExternalLink, CheckCircle2, Key, RefreshCcw, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ─── types ─────────────────────────────────────────────────────── */
type Tab = 'txt2vid' | 'img2vid' | 'audio'
type SetupState = 'checking' | 'ready' | 'needs-setup'

/* ─── helpers ────────────────────────────────────────────────────── */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => res(e.target!.result as string)
    r.onerror = () => rej(new Error('File read error'))
    r.readAsDataURL(file)
  })
}

interface HistItem { id: string; url: string; label: string }

/* ── Setup Required Card ── */
function SetupCard({ onReload }: { onReload: () => void }) {
  const steps = [
    {
      num: 1,
      title: 'Get a free Replicate account',
      desc: 'Takes about 2 minutes — no credit card required for the free tier.',
      link: { href: 'https://replicate.com', label: 'Open replicate.com →' },
    },
    {
      num: 2,
      title: 'Copy your API token',
      desc: 'Go to replicate.com/account/api-tokens and create a new token.',
      link: { href: 'https://replicate.com/account/api-tokens', label: 'Open API Tokens →' },
    },
    {
      num: 3,
      title: 'Add it to your environment',
      desc: 'In Vercel: Settings → Environment Variables → add REPLICATE_API_TOKEN.',
      code: 'REPLICATE_API_TOKEN=r8_xxxxxxxxxxxx',
    },
  ]

  return (
    <div className="min-h-0 flex flex-col bg-bg">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary">AI Video Studio</h1>
          <p className="text-[11px] text-text-secondary">Setup required</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">

          {/* Hero badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm font-medium">
              <Key size={14} />
              API key required for video generation
            </div>
          </div>

          {/* Main card */}
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            {/* Gradient top band */}
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500" />

            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-text-primary mb-1">
                  3 steps to unlock AI Video
                </h2>
                <p className="text-sm text-text-secondary">
                  Replicate offers free credits to get started — no payment info needed.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                {steps.map(step => (
                  <div key={step.num} className="flex gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                      {step.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary mb-0.5">{step.title}</p>
                      <p className="text-xs text-text-secondary leading-relaxed mb-1.5">{step.desc}</p>
                      {step.link && (
                        <a
                          href={step.link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                          {step.link.label}
                          <ExternalLink size={11} />
                        </a>
                      )}
                      {step.code && (
                        <code className="block mt-1 px-2.5 py-1.5 bg-black/40 border border-border rounded-lg text-xs text-cyan-300 font-mono break-all">
                          {step.code}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Audio highlight */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Audio TTS still works!</p>
                  <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                    Switch to the <strong className="text-text-primary">Audio TTS</strong> tab — it uses your
                    browser&apos;s built-in speech synthesis. No API key needed, works 100% offline.
                  </p>
                </div>
              </div>

              {/* Reload button */}
              <button
                onClick={onReload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
              >
                <RefreshCcw size={15} />
                I&apos;ve added my token — Reload
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-text-tertiary mt-4">
            Already have a token? Make sure you&apos;ve redeployed your app after adding the env variable.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function GeneratePage() {
  const [tab, setTab]           = useState<Tab>('txt2vid')
  const [setupState, setSetupState] = useState<SetupState>('checking')

  /* txt2vid */
  const [txtPrompt, setTxtPrompt] = useState('')

  /* img2vid */
  const [imgFile,    setImgFile]    = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string>('')
  const [imgPrompt,  setImgPrompt]  = useState('')

  /* generation */
  const [generating, setGenerating] = useState(false)
  const [pct,        setPct]        = useState(0)
  const [status,     setStatus]     = useState('')
  const [videoUrl,   setVideoUrl]   = useState('')
  const [videoType,  setVideoType]  = useState('')
  const [vidError,   setVidError]   = useState('')
  const [history,    setHistory]    = useState<HistItem[]>([])
  const [provider,   setProvider]   = useState<string>('replicate')

  /* audio */
  const [audioText,    setAudioText]    = useState('')
  const [audioVoice,   setAudioVoice]   = useState(0)
  const [audioRate,    setAudioRate]    = useState(1)
  const [audioPitch,   setAudioPitch]   = useState(1)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioVoices,  setAudioVoices]  = useState<SpeechSynthesisVoice[]>([])

  const cancelRef = useRef(false)
  const genRef    = useRef(false)
  const blobUrls  = useRef<string[]>([])

  /* Check setup status on mount */
  const checkSetup = useCallback(async () => {
    setSetupState('checking')
    try {
      const res = await fetch('/api/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: true }),
      })
      const data = await res.json()
      if (data.needsSetup) {
        setSetupState('needs-setup')
      } else {
        setSetupState('ready')
        if (data.provider) setProvider(data.provider)
      }
    } catch {
      setSetupState('ready') // Assume ready on network error, let generation attempt reveal the issue
    }
  }, [])

  useEffect(() => { checkSetup() }, [checkSetup])

  /* TTS voices */
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
      if (v.length) setAudioVoices(v)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  /* cleanup blob URLs */
  useEffect(() => () => { blobUrls.current.forEach(u => URL.revokeObjectURL(u)) }, [])

  /* image upload */
  const handleImgFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    if (imgPreview) URL.revokeObjectURL(imgPreview)
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
  }, [imgPreview])

  /* cancel */
  const cancelGen = useCallback(() => {
    cancelRef.current = true
    genRef.current    = false
    setGenerating(false)
    setPct(0)
    setStatus('')
  }, [])

  /* ── GENERATE ─────────────────────────────────────────────────── */
  const generate = useCallback(async () => {
    if (genRef.current) return
    const isImg = tab === 'img2vid'
    if (isImg && !imgFile) { toast.error('Please upload an image first'); return }
    if (!isImg && !txtPrompt.trim()) { toast.error('Please enter a prompt'); return }

    cancelRef.current = false
    genRef.current    = true
    setGenerating(true)
    setPct(0)
    setStatus('Connecting to AI server…')
    setVidError('')
    setVideoUrl('')
    setVideoType('')

    try {
      let imageData: string | undefined
      if (isImg && imgFile) {
        setStatus('Reading image…')
        imageData = await fileToBase64(imgFile)
      }
      if (cancelRef.current) return

      /* 1. Start the job */
      const startRes = await fetch('/api/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:    isImg ? (imgPrompt.trim() || 'smooth cinematic motion') : txtPrompt.trim(),
          mode:      isImg ? 'img2vid' : 'txt2vid',
          imageData,
        }),
      })
      const startData = await startRes.json()

      if (startData.needsSetup) {
        setSetupState('needs-setup')
        return
      }
      if (!startData.ok) throw new Error(startData.error ?? 'Could not start generation')
      if (cancelRef.current) return

      const { jobId, provider: prov = 'replicate', spaceName = 'AI' } = startData
      setProvider(prov)
      setStatus(`Started on ${spaceName} — waiting for GPU…`)
      setPct(5)
      setVideoType(isImg ? 'Image to Video' : 'Text to Video')

      /* 2. Poll for completion */
      const MAX_POLLS = 60
      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelRef.current) return
        await sleep(i === 0 ? 4000 : 8000)
        if (cancelRef.current) return

        const pollRes = await fetch(
          `/api/video/poll?jobId=${encodeURIComponent(jobId)}&provider=${encodeURIComponent(prov)}`,
        )
        const poll = await pollRes.json()

        if (poll.message) setStatus(poll.message)
        if (typeof poll.pct === 'number' && poll.pct > pct) setPct(poll.pct)

        if (poll.status === 'completed') {
          setVideoUrl(poll.videoData)
          setPct(100)
          setStatus('')
          const label = isImg
            ? (imgFile?.name?.replace(/\.[^.]+$/, '') ?? 'Uploaded image')
            : txtPrompt.trim().slice(0, 40)
          setHistory(h => [{ id: Date.now().toString(), url: poll.videoData, label }, ...h].slice(0, 8))
          toast.success('AI video ready!')
          return
        }

        if (poll.status === 'failed') {
          throw new Error(poll.error ?? 'Generation failed — please try again')
        }
        // 'queued' | 'generating' → keep polling
      }

      throw new Error('Generation timed out — the GPU queue was very busy. Please try again.')

    } catch (err: any) {
      if (!cancelRef.current) {
        setVidError(err.message ?? 'Generation failed. Please try again.')
      }
    } finally {
      genRef.current = false
      if (!cancelRef.current) setGenerating(false)
    }
  }, [tab, imgFile, imgPrompt, txtPrompt, pct])

  /* download */
  const download = useCallback(() => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `pyxis-ai-video-${Date.now()}.mp4`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    toast.success('Video downloaded!')
  }, [videoUrl])

  /* audio */
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

  const EXAMPLES = [
    'ocean waves crashing at sunset',
    'golden retriever running on a beach',
    'cherry blossoms falling in the wind',
    'campfire burning at night in forest',
    'timelapse clouds over mountains',
    'city skyline at dusk with lights',
  ]

  const canGenerate = tab === 'img2vid' ? !!imgFile : tab === 'txt2vid' ? !!txtPrompt.trim() : false

  /* ── Checking state ── */
  if (setupState === 'checking') {
    return (
      <div className="min-h-0 flex flex-1 items-center justify-center bg-bg">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">Checking configuration…</p>
        </div>
      </div>
    )
  }

  /* ── Setup required ── */
  if (setupState === 'needs-setup' && (tab === 'txt2vid' || tab === 'img2vid')) {
    return (
      <div className="min-h-0 flex flex-col bg-bg">
        {/* Tabs visible even in setup mode so user can switch to Audio */}
        <div className="border-b border-border px-4 flex shrink-0">
          {([
            { id: 'txt2vid' as Tab, label: 'Text to Video', Icon: Film      },
            { id: 'img2vid' as Tab, label: 'Image to Video', Icon: ImageIcon },
            { id: 'audio'   as Tab, label: 'Audio TTS',     Icon: Music     },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <SetupCard onReload={checkSetup} />
      </div>
    )
  }

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="min-h-0 flex flex-col bg-bg">

      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-text-primary">AI Video Studio</h1>
          <p className="text-[11px] text-text-secondary">
            Powered by{' '}
            <span className="text-violet-400 font-medium capitalize">{provider}</span>
            {' '}· Real AI video generation
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-4 flex shrink-0">
        {([
          { id: 'txt2vid' as Tab, label: 'Text to Video', Icon: Film      },
          { id: 'img2vid' as Tab, label: 'Image to Video', Icon: ImageIcon },
          { id: 'audio'   as Tab, label: 'Audio TTS',     Icon: Music     },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* ══ VIDEO TABS ══ */}
      {(tab === 'txt2vid' || tab === 'img2vid') && (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">

          {/* Left: Controls */}
          <div className="w-full lg:w-[360px] lg:shrink-0 min-h-0 border-r border-border overflow-y-visible lg:overflow-y-auto p-5 space-y-5">

            {/* Provider info banner */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-violet-500/5 border border-violet-500/20">
              <Sparkles size={13} className="text-violet-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {tab === 'txt2vid'
                  ? <><strong className="text-violet-400">ZeroScope v2 XL</strong> — real AI motion video via {provider}. Actual frames generated by AI, not animated images.</>
                  : <><strong className="text-violet-400">Stable Video Diffusion</strong> — AI predicts realistic motion from your image via {provider}.</>
                }
                {' '}<span className="text-text-tertiary">Async generation · 1–3 min typical.</span>
              </p>
            </div>

            {/* Image upload (img2vid only) */}
            {tab === 'img2vid' && (
              <div>
                <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                  Reference Image
                </label>
                <div
                  className={`relative rounded-xl border-2 border-dashed overflow-hidden cursor-pointer transition-colors ${
                    imgPreview ? 'border-accent/50' : 'border-border hover:border-accent/40'
                  }`}
                  style={{ aspectRatio: '16/9' }}
                  onClick={() => { if (!imgFile) document.getElementById('img-upload')?.click() }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImgFile(f) }}
                >
                  {imgPreview ? (
                    <>
                      <img src={imgPreview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); setImgFile(null); URL.revokeObjectURL(imgPreview); setImgPreview('') }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black/90"
                      >
                        <X size={11} />
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-tertiary select-none">
                      <Upload size={22} />
                      <p className="text-sm font-medium">Upload / Drop Image</p>
                      <p className="text-xs opacity-60">JPG · PNG · WebP</p>
                    </div>
                  )}
                </div>
                <input
                  id="img-upload" type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImgFile(f); e.target.value = '' }}
                />
              </div>
            )}

            {/* Prompt */}
            <div>
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                {tab === 'txt2vid' ? 'Prompt' : 'Motion Prompt (Optional)'}
              </label>
              <textarea
                value={tab === 'txt2vid' ? txtPrompt : imgPrompt}
                onChange={e => {
                  const v = e.target.value.slice(0, 300)
                  tab === 'txt2vid' ? setTxtPrompt(v) : setImgPrompt(v)
                }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate() }}
                placeholder={
                  tab === 'txt2vid'
                    ? 'e.g. "a golden retriever running on a beach, cinematic, 4K"'
                    : 'Optional: describe the motion you want…'
                }
                rows={4}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent transition-colors"
              />
              {tab === 'txt2vid' && (
                <>
                  <p className="text-[10px] text-text-tertiary text-right mt-0.5">{txtPrompt.length} / 300</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {EXAMPLES.map(ex => (
                      <button
                        key={ex} onClick={() => setTxtPrompt(ex)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-tertiary hover:text-text-primary hover:border-accent/40 transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* What to expect */}
            <div className="px-3 py-2.5 rounded-xl bg-surface border border-border space-y-1.5">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">What to expect</p>
              {[
                '~1–3 min async generation',
                'Real AI frames with actual motion',
                tab === 'txt2vid' ? 'Output: MP4 clip (2–6 seconds)' : 'Output: Video animated from your image',
                'Download as MP4 when done',
              ].map(t => (
                <p key={t} className="text-[11px] text-text-tertiary flex items-center gap-1.5">
                  <span className="text-green-400">✓</span>{t}
                </p>
              ))}
            </div>

            {/* Generate / Cancel */}
            {!generating ? (
              <button
                onClick={generate} disabled={!canGenerate}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
              >
                <Video size={16} />Generate AI Video
              </button>
            ) : (
              <button
                onClick={cancelGen}
                className="w-full py-3 rounded-xl bg-surface border border-border text-text-secondary hover:bg-surface-hover text-sm font-medium flex items-center justify-center gap-2"
              >
                <X size={16} />Cancel Generation
              </button>
            )}
          </div>

          {/* Right: Preview panel */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#0d0d0d]">

            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">

              {/* Idle */}
              {!generating && !videoUrl && !vidError && (
                <div className="text-center space-y-3 select-none">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                    <Video size={36} className="text-white/20" />
                  </div>
                  <p className="text-white/50 text-xl font-semibold">Bring your ideas to life.</p>
                  <p className="text-white/25 text-sm">
                    {tab === 'img2vid' ? 'Upload an image to animate with AI.' : 'Enter a prompt to generate a real AI video.'}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-white/30 text-xs capitalize">{provider} · Ready</p>
                  </div>
                </div>
              )}

              {/* Progress */}
              {generating && (
                <div className="text-center w-full max-w-sm space-y-5">
                  {/* Big percentage */}
                  <div className="relative">
                    <div className="text-[88px] font-black text-white leading-none tabular-nums">
                      {pct}<span className="text-5xl text-white/30 ml-1">%</span>
                    </div>
                    {/* Animated glow ring */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-32 h-32 rounded-full border border-violet-500/20 animate-ping opacity-20" />
                    </div>
                  </div>

                  <p className="text-white text-lg font-semibold">Generating your video…</p>
                  <p className="text-white/50 text-sm min-h-[1.5rem] px-4 text-center leading-snug">
                    {status || 'AI is working on your video…'}
                  </p>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>

                  {/* Animated dots */}
                  <div className="flex justify-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400/60"
                        style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>

                  <p className="text-white/20 text-xs">
                    Async generation via <span className="capitalize">{provider}</span> — polling every 8 seconds
                  </p>
                </div>
              )}

              {/* Error */}
              {!generating && vidError && (
                <div className="text-center space-y-4 max-w-md px-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle size={28} className="text-red-400" />
                  </div>
                  <p className="text-white/80 text-base font-semibold">Generation Failed</p>
                  <p className="text-red-400/80 text-sm leading-relaxed">{vidError}</p>
                  <p className="text-white/25 text-xs leading-relaxed">
                    The AI server may be busy or the model cold-starting. This usually succeeds on retry.
                  </p>
                  <button
                    onClick={() => { setVidError(''); generate() }}
                    className="px-6 py-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 text-sm font-medium hover:bg-violet-500/30 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw size={14} />Try Again
                  </button>
                </div>
              )}

              {/* Video result */}
              {!generating && videoUrl && !vidError && (
                <div className="w-full max-w-2xl space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{videoType}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/60">AI Generated</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/20 capitalize">{provider}</span>
                  </div>

                  <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-white/10 shadow-2xl">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={videoUrl}
                      autoPlay loop muted playsInline controls
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setVideoUrl(''); setPct(0); setVideoType('') }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/15 text-xs font-medium transition-colors"
                    >
                      <RefreshCw size={12} />Regenerate
                    </button>
                    <button
                      onClick={download}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 text-xs font-semibold transition-colors"
                    >
                      <Download size={12} />Download MP4
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* History strip */}
            {history.length > 0 && (
              <div className="border-t border-white/10 p-4 shrink-0">
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">History</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {history.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setVideoUrl(item.url)}
                      className={`shrink-0 w-28 rounded-xl overflow-hidden border transition-all ${
                        item.url === videoUrl ? 'border-accent' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={item.url} muted playsInline className="w-full aspect-video object-cover" />
                      <p className="text-[9px] text-white/40 px-1.5 py-1 truncate bg-black/60">{item.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ AUDIO TTS ══ */}
      {tab === 'audio' && (
        <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-5">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <Mic2 size={15} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-text-secondary leading-relaxed">
              Uses your browser&apos;s built-in Text-to-Speech —{' '}
              <strong className="text-text-primary">100% free, works offline, no API key needed.</strong>{' '}
              Chrome Desktop has the best voices.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Text to Speak</label>
            <textarea
              value={audioText} onChange={e => setAudioText(e.target.value)}
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
                {audioVoices.length > 0
                  ? audioVoices.map((v, i) => <option key={i} value={i}>{v.name}</option>)
                  : <option>Loading voices…</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Speed: {audioRate}x</label>
              <input type="range" min="0.5" max="2" step="0.1" value={audioRate}
                onChange={e => setAudioRate(Number(e.target.value))} className="w-full accent-accent mt-3" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Pitch: {audioPitch.toFixed(1)}</label>
            <input type="range" min="0.5" max="2" step="0.1" value={audioPitch}
              onChange={e => setAudioPitch(Number(e.target.value))} className="w-full accent-accent" />
          </div>
          <div className="flex gap-3">
            {audioPlaying ? (
              <button onClick={stopAudio}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">
                Stop
              </button>
            ) : (
              <button onClick={playAudio} disabled={!audioText.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold disabled:opacity-50 shadow-lg hover:from-cyan-600 hover:to-blue-600 transition-all">
                <Volume2 size={16} />Play Audio
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
