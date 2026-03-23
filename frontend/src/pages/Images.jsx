import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Wand2, Download, RefreshCw, Loader2, X, Sparkles, Zap, MessageSquare, History, Trash2 } from 'lucide-react'
import { streamChat } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import { useImageGeneration } from '../context/ImageGenerationContext'
import toast from 'react-hot-toast'

const EXAMPLE_PROMPTS = [
  'Young woman in red Hanfu, intricate embroidery, photorealistic, cinematic lighting',
  'A majestic dragon soaring through clouds at sunset, scales shimmering, epic fantasy',
  'Cozy coffee shop interior, warm lighting, rain on windows, plants on shelves, vintage aesthetic',
  'Astronaut riding a horse on Mars, cinematic lighting, sci-fi, hyper-realistic',
  'Portrait of a wise old wizard with a long white beard, holding a glowing staff',
  'Futuristic city at night, neon reflections on wet streets, cyberpunk aesthetic',
]

const STYLES = [
  { id: '',               label: 'None'           },
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'cinematic',      label: 'Cinematic'      },
  { id: 'anime',          label: 'Anime'          },
  { id: 'digital art',    label: 'Digital Art'    },
  { id: 'oil painting',   label: 'Oil Painting'   },
  { id: 'watercolor',     label: 'Watercolor'     },
  { id: 'cyberpunk',      label: 'Cyberpunk'      },
]

const SIZES = [
  { label: '1:1',  w: 1024, h: 1024 },
  { label: '4:3',  w: 1024, h: 768  },
  { label: '3:4',  w: 768,  h: 1024 },
  { label: '16:9', w: 1024, h: 576  },
]

const SOURCE_LABELS = {
  gemini:      { text: '✨ Gemini',       bg: 'rgba(37,99,235,0.2)',   color: '#93c5fd'  },
  openai:      { text: '🟢 DALL-E 3',    bg: 'rgba(16,185,129,0.2)',  color: '#34d399'  },
  huggingface: { text: '⚡ FLUX.1',      bg: 'rgba(234,88,12,0.2)',   color: '#fb923c'  },
  pollinations:{ text: '🌸 Pollinations', bg: 'rgba(124,58,237,0.2)', color: '#a78bfa'  },
}

export default function Images() {
  const { activeWorkspace, addArtifact } = useWorkspace()
  const {
    status, genPrompt, result, error, history, isLoading,
    startGeneration, cancelGeneration, clearResult, clearHistory,
  } = useImageGeneration()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [prompt,    setPrompt]    = useState('')
  const [style,     setStyle]     = useState('')
  const [size,      setSize]      = useState(SIZES[0])
  const [imgLoaded, setImgLoaded] = useState(false)
  const [lightbox,  setLightbox]  = useState(null)
  const [enhancing, setEnhancing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const resultRef = useRef(null)

  // Auto-generate from voice intent routing (?prompt=...)
  useEffect(() => {
    const voicePrompt = searchParams.get('prompt')
    if (voicePrompt) {
      setPrompt(voicePrompt)
      setTimeout(() => generate(voicePrompt), 400)
    } else if (activeWorkspace?.goal && !prompt) {
      setPrompt(`Visual for: ${activeWorkspace.goal}`)
    }
  }, [])

  // Scroll to result when done
  useEffect(() => {
    if (status === 'done' && result) {
      setImgLoaded(false)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [status, result])

  // Sync prompt field when result comes in from background generation
  useEffect(() => {
    if (result && genPrompt && !prompt) setPrompt(genPrompt)
  }, [result])

  const buildPrompt = () => {
    let p = prompt.trim()
    if (style) p = `${p}, ${style} style`
    return p
  }

  const generate = async (customPrompt) => {
    const p = customPrompt || buildPrompt()
    if (!p || isLoading) return
    startGeneration(p, size)
  }

  const enhancePrompt = () => {
    if (!prompt.trim() || enhancing) return
    setEnhancing(true)
    let enhanced = ''
    streamChat(
      {
        message: `Enhance this image generation prompt to be more vivid and detailed (one sentence only, no explanation): "${prompt}"`,
        model: 'gemini-2.0-flash',
      },
      token => { enhanced += token },
      () => {
        if (enhanced.trim()) setPrompt(enhanced.trim().replace(/^\"|\"$/g, ''))
        setEnhancing(false)
      },
      () => { toast.error('Enhancement failed'); setEnhancing(false) },
      '/api/tool-chat',
    )
  }

  const download = (url) => {
    if (url.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = url; a.download = 'pyxis-image.png'; a.click()
      return
    }
    window.open(url, '_blank')
  }

  const srcInfo = result ? (SOURCE_LABELS[result.source] || { text: result.source, bg: 'var(--bg-input)', color: 'var(--text-secondary)' }) : null
  const loading = isLoading

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* Prompt + controls */}
      <div className="w-full max-w-3xl mx-auto px-6 pt-10 pb-6 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(234,88,12,0.2)' }}>
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Image Studio</h1>
            {/* History toggle */}
            <button
              onClick={() => setShowHistory(v => !v)}
              className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
              style={{
                backgroundColor: showHistory ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--bg-input)',
                borderColor: showHistory ? 'var(--color-primary)' : 'var(--border-color)',
                color: showHistory ? 'var(--color-primary-light)' : 'var(--text-muted)',
              }}
            >
              <History className="w-3.5 h-3.5" />
              History {history.length > 0 && `(${history.length})`}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ultra-fast AI image generation · Powered by FLUX.1 · Runs in background while you navigate
          </p>
        </div>

        {/* Prompt card */}
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Your Prompt</span>
          </div>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.ctrlKey && generate()}
            placeholder="Describe the image you want to create…"
            rows={3}
            className="input resize-none text-sm leading-relaxed"
          />

          {/* Style + Size */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1 flex-wrap">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all border"
                  style={style === s.id ? {
                    backgroundColor: 'rgba(234,88,12,0.2)',
                    color: '#fb923c',
                    borderColor: 'rgba(234,88,12,0.4)',
                  } : {
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              {SIZES.map(s => (
                <button
                  key={s.label}
                  onClick={() => setSize(s)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all border"
                  style={size === s ? {
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                    color: 'var(--color-primary-light)',
                    borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                  } : {
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => loading ? cancelGeneration() : generate()}
              disabled={!loading && (!prompt.trim())}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all text-white active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{
                background: loading
                  ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                  : 'linear-gradient(135deg, #f97316, #f59e0b)',
                boxShadow: loading ? '0 4px 15px rgba(220,38,38,0.25)' : '0 4px 15px rgba(249,115,22,0.25)',
              }}
            >
              {loading
                ? <><X className="w-4 h-4" /> Stop Generation</>
                : <><Wand2 className="w-4 h-4" /> Generate Image</>
              }
            </button>
            <button
              onClick={enhancePrompt}
              disabled={!prompt.trim() || enhancing || loading}
              title="Enhance prompt with AI"
              className="px-3 py-3 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.color = '#fbbf24'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)' } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}
            >
              {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Example prompts */}
        {!loading && !result && (
          <div>
            <p className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-muted)' }}>
              <span>💡</span> Try these prompts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {EXAMPLE_PROMPTS.map(ex => (
                <button
                  key={ex}
                  onClick={() => { setPrompt(ex); generate(ex) }}
                  className="text-left text-xs px-3 py-2 rounded-xl border transition-all truncate"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {(loading || result) && (
        <div ref={resultRef} className="w-full max-w-3xl mx-auto px-6 pb-8">
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}>
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: 'rgba(249,115,22,0.05)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Generating your image…</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    FLUX.1 · ~5–10 seconds · You can navigate away — we'll notify you when ready
                  </p>
                </div>
              </div>
            ) : result && (
              <>
                <div className="relative group cursor-pointer" onClick={() => setLightbox(result)}>
                  {!imgLoaded && (
                    <div className="w-full flex flex-col items-center justify-center py-24 gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading image…</p>
                    </div>
                  )}
                  <img
                    src={result.url}
                    alt={result.prompt}
                    className={`w-full object-contain max-h-[600px] ${imgLoaded ? '' : 'hidden'}`}
                    style={{ backgroundColor: 'var(--bg-app)' }}
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { setImgLoaded(true); e.target.style.display = 'none' }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={e => { e.stopPropagation(); download(result.url) }}
                      className="text-white p-3 rounded-xl transition-colors shadow-xl backdrop-blur"
                      style={{ backgroundColor: 'rgba(9,9,11,0.85)' }}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setPrompt(result.prompt); clearResult() }}
                      className="text-white p-3 rounded-xl transition-colors shadow-xl backdrop-blur"
                      style={{ backgroundColor: 'rgba(9,9,11,0.85)' }}
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border-color)' }}>
                  {srcInfo && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: srcInfo.bg, color: srcInfo.color }}>
                      {srcInfo.text}
                    </span>
                  )}
                  <p className="flex-1 text-xs truncate" style={{ color: 'var(--text-muted)' }}>{result.prompt}</p>
                  <button
                    onClick={() => navigate(`/chat?prompt=${encodeURIComponent('Describe and analyze this AI-generated image with the prompt: "' + result.prompt + '"')}`)}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all shrink-0"
                    style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    <MessageSquare className="w-3 h-3" /> Analyze in Chat
                  </button>
                  {activeWorkspace && (
                    <button
                      onClick={() => {
                        addArtifact({ type: 'image', title: result.prompt.slice(0, 60), content: `Image generated with prompt: "${result.prompt}"`, imageUrl: result.url, source: '/images' })
                        toast.success('Added to workspace')
                      }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--color-primary)', color: 'var(--color-primary-light)' }}
                    >
                      <Zap className="w-3 h-3" /> Add to Workspace
                    </button>
                  )}
                  <button
                    onClick={() => download(result.url)}
                    className="transition-colors p-1 shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* History panel (persistent across sessions via localStorage) */}
      {showHistory && history.length > 0 && (
        <div className="w-full max-w-3xl mx-auto px-6 pb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              History ({history.length})
            </h2>
            <button
              onClick={() => { if (confirm('Clear all image history?')) clearHistory() }}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => setLightbox(item)}
                className="aspect-square rounded-xl overflow-hidden border transition-all group relative"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
              >
                <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 p-2 text-white rounded-xl hover:bg-white/10 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.prompt}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={e => { e.stopPropagation(); download(lightbox.url) }}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-xl transition-colors border backdrop-blur"
              style={{ backgroundColor: 'rgba(9,9,11,0.9)', borderColor: 'rgba(63,63,70,0.8)' }}
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button
              onClick={e => { e.stopPropagation(); setPrompt(lightbox.prompt); setLightbox(null); window.scrollTo(0,0) }}
              className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-xl transition-colors border backdrop-blur"
              style={{ backgroundColor: 'rgba(9,9,11,0.9)', borderColor: 'rgba(63,63,70,0.8)' }}
            >
              <RefreshCw className="w-4 h-4" /> Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
