'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sparkles, Video, Music, RefreshCw, Download,
  Mic2, Volume2, X, Film, Upload, ZoomIn, ZoomOut,
  ArrowLeft, ArrowRight, RotateCcw, ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ─── types ─────────────────────────────────────────────────────── */
type Tab      = 'img2vid' | 'txt2vid' | 'audio'
type Motion   = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'orbit' | 'cinematic'
type Duration = 6 | 10 | 15

/* ─── constants ─────────────────────────────────────────────────── */
const VW = 1280, VH = 720, FPS = 30

const MOTIONS: { id: Motion; label: string; Icon: any }[] = [
  { id: 'zoom-in',   label: 'Zoom In',   Icon: ZoomIn    },
  { id: 'zoom-out',  label: 'Zoom Out',  Icon: ZoomOut   },
  { id: 'pan-left',  label: 'Pan Left',  Icon: ArrowLeft },
  { id: 'pan-right', label: 'Pan Right', Icon: ArrowRight },
  { id: 'orbit',     label: 'Orbit',     Icon: RotateCcw  },
  { id: 'cinematic', label: 'Cinematic', Icon: Film       },
]

const EXAMPLES = [
  'ocean waves crashing at sunset',
  'golden retriever running on a beach',
  'cherry blossoms falling in the wind',
  'campfire burning at night in forest',
  'timelapse clouds over mountains',
  'city skyline at dusk with lights',
]

/* ─── canvas / video helpers ─────────────────────────────────────── */
function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: number,
  motion: Motion,
) {
  const p  = ease(t)
  const ar = img.width / img.height
  const canAR = VW / VH
  const bW = ar > canAR ? VH * ar : VW
  const bH = ar > canAR ? VH : VW / ar

  let scale = 1, dx = 0, dy = 0

  switch (motion) {
    case 'zoom-in':   scale = 1 + p * 0.35; break
    case 'zoom-out':  scale = 1.35 - p * 0.35; break
    case 'pan-left':  scale = 1.35; dx = p * -VW * 0.18; break
    case 'pan-right': scale = 1.35; dx = p * VW * 0.18; break
    case 'orbit':
      scale = 1.2
      dx = Math.sin(t * Math.PI * 2) * VW * 0.07
      dy = Math.cos(t * Math.PI * 2) * VH * 0.05
      break
    case 'cinematic':
      scale = 1 + p * 0.28
      dx = Math.sin(p * Math.PI) * VW * 0.08
      dy = -p * VH * 0.04
      break
  }

  const dW = bW * scale, dH = bH * scale
  ctx.clearRect(0, 0, VW, VH)
  ctx.drawImage(img, (VW - dW) / 2 + dx, (VH - dH) / 2 + dy, dW, dH)
}

function loadImgFromURL(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => res(img)
    img.onerror = () => rej(new Error('Failed to load image'))
    img.src = url
  })
}

function loadImgFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = e => {
      const img = new Image()
      img.onload  = () => res(img)
      img.onerror = () => rej(new Error('Cannot decode image file'))
      img.src = e.target!.result as string
    }
    r.onerror = () => rej(new Error('Cannot read file'))
    r.readAsDataURL(file)
  })
}

/**
 * Renders the image with smooth motion onto an off-screen canvas,
 * records via MediaRecorder → returns a real playable WebM blob.
 */
function makeVideo(
  img: HTMLImageElement,
  motion: Motion,
  durSec: Duration,
  onPct: (n: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = VW; canvas.height = VH
  const ctx = canvas.getContext('2d')!

  const stream = canvas.captureStream(FPS)
  const mime = (
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(m => MediaRecorder.isTypeSupported(m))
  ) ?? 'video/webm'

  const rec    = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  return new Promise((resolve, reject) => {
    rec.onstop  = () => resolve(new Blob(chunks, { type: mime }))
    rec.onerror = reject

    const totalMs    = durSec * 1000
    const msPerFrame = 1000 / FPS
    let lastFrame    = -1
    const startTime  = performance.now()

    rec.start(100)
    drawFrame(ctx, img, 0, motion) // first frame

    function tick() {
      const elapsed = performance.now() - startTime

      if (elapsed >= totalMs) {
        drawFrame(ctx, img, 1, motion)
        onPct(100)
        setTimeout(() => rec.stop(), 400)
        return
      }

      const targetFrame = Math.floor(elapsed / msPerFrame)
      if (targetFrame > lastFrame) {
        lastFrame = targetFrame
        const t = Math.min(elapsed / totalMs, 1)
        drawFrame(ctx, img, t, motion)
        onPct(Math.round(t * 100))
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

/* ─── history ───────────────────────────────────────────────────── */
interface HistItem { id: string; url: string; label: string }

/* ══════════════════════════════════════════════════════════════════ */
export default function GeneratePage() {
  const [tab, setTab] = useState<Tab>('txt2vid')

  /* img2vid */
  const [imgFile,    setImgFile]    = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string>('')

  /* txt2vid */
  const [txtPrompt, setTxtPrompt] = useState('')

  /* shared video settings */
  const [motion,   setMotion]   = useState<Motion>('cinematic')
  const [duration, setDuration] = useState<Duration>(6)

  /* generation */
  const [generating, setGenerating] = useState(false)
  const [pct,        setPct]        = useState(0)
  const [genLabel,   setGenLabel]   = useState('')
  const [videoUrl,   setVideoUrl]   = useState('')
  const [vidError,   setVidError]   = useState('')
  const [history,    setHistory]    = useState<HistItem[]>([])

  /* audio */
  const [audioText,    setAudioText]    = useState('')
  const [audioVoice,   setAudioVoice]   = useState(0)
  const [audioRate,    setAudioRate]    = useState(1)
  const [audioPitch,   setAudioPitch]   = useState(1)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioVoices,  setAudioVoices]  = useState<SpeechSynthesisVoice[]>([])

  const cancelRef  = useRef(false)
  const genRef     = useRef(false)
  const blobUrls   = useRef<string[]>([])

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

  /* cleanup on unmount */
  useEffect(() => () => {
    blobUrls.current.forEach(u => URL.revokeObjectURL(u))
  }, [])

  /* image file handler */
  const handleImgFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image (JPG, PNG, etc.)'); return }
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
    setGenLabel('')
  }, [])

  /* generate */
  const generate = useCallback(async () => {
    if (genRef.current) return
    const isImg = tab === 'img2vid'
    if (isImg && !imgFile) { toast.error('Please upload an image first'); return }
    if (!isImg && !txtPrompt.trim()) { toast.error('Please enter a prompt'); return }

    cancelRef.current = false
    genRef.current    = true
    setGenerating(true)
    setPct(0)
    setVidError('')
    setVideoUrl('')

    try {
      let img: HTMLImageElement

      if (isImg) {
        setGenLabel('Loading image…')
        setPct(5)
        img = await loadImgFromFile(imgFile!)
        if (cancelRef.current) return
        setPct(15)
      } else {
        setGenLabel('Generating AI image from prompt…')
        setPct(5)

        const seed = Date.now()
        const res = await fetch(
          `/api/frame?prompt=${encodeURIComponent(txtPrompt.trim())}&seed=${seed}&idx=0`
        )
        if (!res.ok) throw new Error(`AI image generation failed (${res.status})`)
        if (cancelRef.current) return

        const blob = await res.blob()
        if (blob.size === 0) throw new Error('AI image returned empty — please try again')

        setPct(20)
        setGenLabel('Animating…')

        const blobUrl = URL.createObjectURL(blob)
        blobUrls.current.push(blobUrl)
        img = await loadImgFromURL(blobUrl)
        if (cancelRef.current) return
      }

      setPct(isImg ? 5 : 22)
      setGenLabel('Creating video…')

      const videoBlob = await makeVideo(img, motion, duration, p => {
        if (!cancelRef.current) setPct(isImg ? p : Math.round(22 + p * 0.78))
      })

      if (cancelRef.current) return

      if (videoBlob.size < 500) {
        throw new Error('Video generation produced an empty file — try a different browser or motion style')
      }

      const url = URL.createObjectURL(videoBlob)
      blobUrls.current.push(url)
      setVideoUrl(url)

      const label = isImg
        ? (imgFile?.name?.replace(/\.[^.]+$/, '') ?? 'Uploaded image')
        : txtPrompt.trim().slice(0, 40)

      setHistory(h => [{ id: Date.now().toString(), url, label }, ...h].slice(0, 8))
      setPct(100)
      setGenLabel('')
      toast.success('Video ready! 🎬')

    } catch (err: any) {
      if (!cancelRef.current) setVidError(err.message ?? 'Generation failed. Please try again.')
    } finally {
      genRef.current = false
      if (!cancelRef.current) setGenerating(false)
    }
  }, [tab, imgFile, txtPrompt, motion, duration])

  /* download */
  const download = useCallback(() => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `pyxis-video-${Date.now()}.webm`
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

  const canGenerate = tab === 'img2vid' ? !!imgFile : tab === 'txt2vid' ? !!txtPrompt.trim() : false

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary">AI Video Studio</h1>
          <p className="text-[11px] text-text-secondary">Generate real videos from images or text — 100% free</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-4 flex shrink-0">
        {([
          { id: 'img2vid' as Tab, label: 'Image to Video', Icon: ImageIcon },
          { id: 'txt2vid' as Tab, label: 'Text to Video',  Icon: Film      },
          { id: 'audio'   as Tab, label: 'Audio TTS',      Icon: Music     },
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
      {(tab === 'img2vid' || tab === 'txt2vid') && (
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 112px)' }}>

          {/* Left: Controls */}
          <div className="w-[360px] shrink-0 border-r border-border overflow-y-auto p-5 space-y-5">

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
                      <p className="text-xs opacity-60">JPG · PNG · WebP up to 10 MB</p>
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
                {tab === 'txt2vid' ? 'Prompt' : 'Prompt (Optional)'}
              </label>
              <textarea
                value={tab === 'txt2vid' ? txtPrompt : ''}
                onChange={e => {
                  const v = e.target.value.slice(0, 200)
                  if (tab === 'txt2vid') setTxtPrompt(v)
                }}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate() }}
                placeholder={tab === 'txt2vid' ? 'Describe what you want to see…' : 'Optional: describe motion or mood…'}
                rows={4}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none focus:border-accent transition-colors"
              />
              {tab === 'txt2vid' && (
                <>
                  <p className="text-[10px] text-text-tertiary text-right mt-0.5">{txtPrompt.length} / 200</p>
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

            {/* Motion Style */}
            <div>
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                Motion Style
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {MOTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id} onClick={() => setMotion(id)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      motion === id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
                    }`}
                  >
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                Duration
              </label>
              <div className="flex gap-2">
                {([6, 10, 15] as Duration[]).map(d => (
                  <button
                    key={d} onClick={() => setDuration(d)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                      duration === d
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            {/* Generate / Cancel */}
            {!generating ? (
              <button
                onClick={generate} disabled={!canGenerate}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Video size={16} />Generate
              </button>
            ) : (
              <button
                onClick={cancelGen}
                className="w-full py-3 rounded-xl bg-surface border border-border text-text-secondary hover:bg-surface-hover text-sm font-medium flex items-center justify-center gap-2"
              >
                <X size={16} />Cancel
              </button>
            )}

            <p className="text-[10px] text-text-tertiary text-center">
              720p · WebM · plays in VLC, Chrome, Firefox
            </p>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0d]">

            {/* Main preview */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden">

              {/* Idle */}
              {!generating && !videoUrl && !vidError && (
                <div className="text-center space-y-2 select-none">
                  <Video size={52} className="text-white/10 mx-auto" />
                  <p className="text-white/50 text-xl font-medium">Bring your ideas to life.</p>
                  <p className="text-white/25 text-sm">
                    {tab === 'img2vid' ? 'Upload an image to start creating.' : 'Enter a prompt to start creating.'}
                  </p>
                </div>
              )}

              {/* Progress — big % like bach.art */}
              {generating && (
                <div className="text-center w-full max-w-sm space-y-4">
                  <div className="text-[80px] font-bold text-white leading-none tabular-nums">
                    {pct}<span className="text-4xl text-white/40 ml-1">%</span>
                  </div>
                  <p className="text-white text-lg font-semibold">Generation in Progress</p>
                  <p className="text-white/40 text-sm min-h-[1.25rem]">{genLabel}</p>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {!generating && vidError && (
                <div className="text-center space-y-3 max-w-sm">
                  <p className="text-red-400 text-sm leading-relaxed">{vidError}</p>
                  <button
                    onClick={() => { setVidError(''); generate() }}
                    className="px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Video result */}
              {!generating && videoUrl && !vidError && (
                <div className="w-full max-w-2xl space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {tab === 'img2vid' ? 'Image to Video' : 'Text to Video'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/60">720p</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/60">{duration}s</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-white/60 capitalize">{motion}</span>
                  </div>

                  <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-white/10">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      src={videoUrl}
                      autoPlay loop muted playsInline controls
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setVideoUrl(''); setPct(0) }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 text-xs font-medium transition-colors"
                    >
                      <RefreshCw size={12} />Regenerate
                    </button>
                    <button
                      onClick={download}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30 text-xs font-medium transition-colors"
                    >
                      <Download size={12} />Download .webm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* History */}
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
              <strong className="text-text-primary">100% free, works offline.</strong>{' '}
              Chrome Desktop has the best voices.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Text to Speak
            </label>
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
              <select
                value={audioVoice} onChange={e => setAudioVoice(Number(e.target.value))}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
              >
                {audioVoices.length > 0
                  ? audioVoices.map((v, i) => <option key={i} value={i}>{v.name}</option>)
                  : <option>Loading voices…</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Speed: {audioRate}x
              </label>
              <input type="range" min="0.5" max="2" step="0.1"
                value={audioRate} onChange={e => setAudioRate(Number(e.target.value))}
                className="w-full accent-accent mt-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Pitch: {audioPitch.toFixed(1)}
            </label>
            <input type="range" min="0.5" max="2" step="0.1"
              value={audioPitch} onChange={e => setAudioPitch(Number(e.target.value))}
              className="w-full accent-accent" />
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
    </div>
  )
}
