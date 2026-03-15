'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Sparkles, Download, Maximize2, RotateCcw, Paperclip, ChevronDown,
  X, Loader2, Wand2, Image as ImageIcon, Zap, Clock, RefreshCw, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string
  url: string
  prompt: string
  style: string
  timestamp: number
  aspectRatio: string
  isNew?: boolean
  width: number
  height: number
  source?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'flux-ultra', label: 'FLUX Ultra', badge: 'Best' },
  { id: 'flux-pro', label: 'FLUX Pro', badge: 'Popular' },
  { id: 'photo-v2', label: 'Photorealistic v2', badge: null },
  { id: 'anime-xl', label: 'Anime XL', badge: null },
  { id: 'cinematic-4k', label: 'Cinematic 4K', badge: null },
]

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', short: '1:1', width: 1024, height: 1024 },
  { id: '16:9', label: 'Landscape', short: '16:9', width: 1920, height: 1080 },
  { id: '9:16', label: 'Portrait', short: '9:16', width: 1080, height: 1920 },
  { id: '21:9', label: 'Wide', short: '21:9', width: 2560, height: 1080 },
]

const STYLE_PRESETS = [
  { id: 'none', label: 'Default', suffix: '' },
  { id: 'photorealistic', label: 'Photorealistic', suffix: ', photorealistic, 4K, ultra detailed, sharp focus, DSLR' },
  { id: 'cinematic', label: 'Cinematic', suffix: ', cinematic lighting, movie still, anamorphic lens, dramatic atmosphere' },
  { id: 'anime', label: 'Anime', suffix: ', anime style, Studio Ghibli, vibrant colors, detailed illustration' },
  { id: 'digital-art', label: 'Digital Art', suffix: ', digital art, concept art, artstation trending, highly detailed' },
  { id: 'oil-painting', label: 'Oil Painting', suffix: ', oil painting, classical art, textured brushstrokes, museum quality' },
  { id: 'watercolor', label: 'Watercolor', suffix: ', watercolor painting, soft edges, pastel colors, artistic' },
  { id: 'cyberpunk', label: 'Cyberpunk', suffix: ', cyberpunk, neon lights, futuristic city, rain, dark atmosphere' },
  { id: 'fantasy', label: 'Fantasy', suffix: ', fantasy art, magical, epic, ethereal glow, intricate detail' },
  { id: 'sketch', label: 'Sketch', suffix: ', pencil sketch, hand drawn, detailed linework, graphite' },
  { id: '3d-render', label: '3D Render', suffix: ', 3D render, octane render, subsurface scattering, photorealistic lighting' },
  { id: 'architecture', label: 'Architecture', suffix: ', architectural visualization, clean lines, modern design, professional render' },
]

const QUALITY_OPTIONS = [
  { id: 'draft', label: 'Draft', desc: 'Fast' },
  { id: 'standard', label: 'Standard', desc: 'Balanced' },
  { id: 'hd', label: 'HD', desc: 'Best' },
]

const EXAMPLE_PROMPTS = [
  { prompt: 'majestic lion golden hour savanna photorealistic 4K', w: 512, h: 512 },
  { prompt: 'neon cyberpunk city rain night futuristic', w: 512, h: 768 },
  { prompt: 'beautiful woman beach sunset cinematic', w: 512, h: 768 },
  { prompt: 'mystical forest with glowing mushrooms fantasy', w: 512, h: 512 },
  { prompt: 'modern luxury interior architecture minimal', w: 768, h: 512 },
  { prompt: 'astronaut floating space earth view cinematic', w: 512, h: 512 },
  { prompt: 'japanese cherry blossom temple anime style', w: 512, h: 768 },
  { prompt: 'delicious gourmet food restaurant photorealistic', w: 512, h: 512 },
  { prompt: 'abstract colorful digital art geometric', w: 512, h: 512 },
  { prompt: 'cute puppy golden retriever studio portrait', w: 512, h: 512 },
  { prompt: 'epic mountain landscape aurora borealis', w: 768, h: 512 },
  { prompt: 'vintage sports car classic photography', w: 768, h: 512 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pollinationsUrl(prompt: string, w: number, h: number) {
  const seed = Math.floor(Math.random() * 999999)
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&model=turbo&seed=${seed}`
}

function clampSize(width: number, height: number, maxEdge = 512) {
  const safeW = Number.isFinite(width) && width > 0 ? width : 512
  const safeH = Number.isFinite(height) && height > 0 ? height : 512
  const maxDim = Math.max(safeW, safeH)
  if (maxDim <= maxEdge) return { width: Math.round(safeW), height: Math.round(safeH) }
  const scale = maxEdge / maxDim
  return {
    width: Math.max(256, Math.round(safeW * scale)),
    height: Math.max(256, Math.round(safeH * scale)),
  }
}

function timeAgo(ts: number) {
  const d = Date.now() - ts
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  return `${Math.floor(d / 3600000)}h ago`
}

// ─── Image Card ───────────────────────────────────────────────────────────────
// Simple, clean image card — loads image directly, shows spinner, retry on failure.
// No complex queue needed because we disable Generate while a Pollinations image loads.

interface ImageCardProps {
  img: GalleryImage
  onExpand: (img: GalleryImage) => void
  onDownload: (img: GalleryImage) => void
  onRemix: (prompt: string) => void
  onResolved?: (id: string, resolvedUrl: string) => void
  onLoadStateChange?: (id: string, loading: boolean) => void
}

function ImageCard({ img, onExpand, onDownload, onRemix, onResolved, onLoadStateChange }: ImageCardProps) {
  const [src, setSrc] = useState(img.url)
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const isDataUrl = img.url.startsWith('data:') || img.url.startsWith('blob:')

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  // If it's a data/blob URL, it's already loaded — show immediately
  useEffect(() => {
    if (isDataUrl) { setLoaded(true); return }
    setSrc(img.url)
    setLoaded(false)
    setErrored(false)
    onLoadStateChange?.(img.id, true)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (elapsedRef.current) clearInterval(elapsedRef.current)
    }
  }, [img.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick elapsed while loading
  useEffect(() => {
    if (isDataUrl || loaded || errored) {
      if (elapsedRef.current) clearInterval(elapsedRef.current)
      return
    }
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [src, loaded, errored, isDataUrl])

  // At 60s auto-retry with a new seed (silent). At 120s show error.
  useEffect(() => {
    if (isDataUrl || loaded || errored) return
    // 60s: silently swap to a new seed — Pollinations may have been slow on this seed
    const retryTimer = setTimeout(() => {
      if (mountedRef.current && !loaded) {
        const newUrl = pollinationsUrl(img.prompt, img.width, img.height)
        setSrc(newUrl)
      }
    }, 60000)
    // 120s: give up and show error
    const giveUpTimer = setTimeout(() => {
      if (mountedRef.current && !loaded) {
        setErrored(true)
        onLoadStateChange?.(img.id, false)
      }
    }, 120000)
    return () => { clearTimeout(retryTimer); clearTimeout(giveUpTimer) }
  }, [src, loaded, errored, isDataUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    setLoaded(true)
    onLoadStateChange?.(img.id, false)
    onResolved?.(img.id, src)
  }

  const handleError = () => {
    // onError fires on HTTP error (not slow). Retry once with new seed before giving up.
    if (timerRef.current) clearTimeout(timerRef.current)
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    if (!mountedRef.current) return
    // Try a different seed immediately on HTTP error
    const newUrl = pollinationsUrl(img.prompt, img.width, img.height)
    setSrc(newUrl)
    // If new seed also fails within 60s, show error
    timerRef.current = setTimeout(() => {
      if (mountedRef.current && !loaded) {
        setErrored(true)
        onLoadStateChange?.(img.id, false)
      }
    }, 60000)
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    setErrored(false)
    setLoaded(false)
    onLoadStateChange?.(img.id, true)
    const newUrl = pollinationsUrl(img.prompt, img.width, img.height)
    setSrc(newUrl)
  }

  const resolvedImg = { ...img, url: src }

  return (
    <div
      className="break-inside-avoid mb-4 group relative rounded-2xl overflow-hidden bg-surface-muted shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
      style={{ transform: 'translateZ(0)' }}
    >
      {/* Loading overlay */}
      {!loaded && !errored && (
        <div className="flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface-hover to-surface-muted" style={{ minHeight: 200 }}>
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
            <Sparkles className="w-4 h-4 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-primary text-xs font-medium">
              {elapsed < 5 ? 'Generating…' : `Generating… ${elapsed}s`}
            </p>
            {elapsed > 15 && (
              <p className="text-muted text-[10px] mt-1">AI image takes 15–50s</p>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {errored && (
        <div className="w-full h-48 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface-muted to-bg px-4">
          <AlertCircle className="w-8 h-8 text-muted" />
          <p className="text-muted text-xs text-center leading-relaxed line-clamp-2">{img.prompt}</p>
          <p className="text-muted text-[10px] text-center">Service busy or slow — try again</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-semibold hover:from-purple-500 hover:to-pink-400 transition-all shadow-sm"
          >
            <RefreshCw className="w-3 h-3" /> Try Again
          </button>
        </div>
      )}

      {/* Image */}
      {!errored && (
        <img
          key={src}
          src={src}
          alt={img.prompt}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0 absolute inset-0 w-full h-full'}`}
          loading="lazy"
        />
      )}

      {/* Hover overlay */}
      {loaded && !errored && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onExpand(resolvedImg) }}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center transition-all"
              title="Expand"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(resolvedImg) }}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center transition-all"
              title="Download"
            >
              <Download className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemix(img.prompt) }}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center transition-all"
              title="Remix"
            >
              <RotateCcw className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white text-xs leading-snug line-clamp-2 font-medium">{img.prompt}</p>
            {img.timestamp > 0 && (
              <p className="text-white/50 text-[10px] mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {timeAgo(img.timestamp)}
              </p>
            )}
          </div>
        </div>
      )}

      {img.isNew && (
        <div className="absolute top-3 left-3">
          <span className="px-2 py-0.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-semibold rounded-full shadow-lg">NEW</span>
        </div>
      )}

      {/* Source badge */}
      {img.source && img.source !== 'pollinations' && loaded && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="px-1.5 py-0.5 bg-black/40 backdrop-blur-sm text-white/70 text-[9px] rounded uppercase tracking-wide">
            {img.source === 'dalle3' ? 'DALL·E 3' : img.source === 'huggingface' ? 'FLUX' : img.source}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Lightbox Image ───────────────────────────────────────────────────────────

function LightboxImage({ url, prompt }: { url: string; prompt: string }) {
  const [src, setSrc] = useState(url)
  useEffect(() => setSrc(url), [url])
  return (
    <img
      src={src}
      alt={prompt}
      onError={() => {
        if (!src.startsWith('blob:') && !src.startsWith('data:') && !src.startsWith('/api/images/proxy') && !src.includes('pollinations.ai')) {
          setSrc(`/api/images/proxy?url=${encodeURIComponent(url)}`)
        }
      }}
      className="w-full max-h-[70vh] object-contain bg-surface-muted"
    />
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImagesPage() {
  const { getToken } = useAuth()

  // Input state
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0])
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0])
  const [selectedQuality, setSelectedQuality] = useState(QUALITY_OPTIONS[1])
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageName, setUploadedImageName] = useState('')

  // UI state
  const [generating, setGenerating] = useState(false)
  const [generatingStatus, setGeneratingStatus] = useState('Generating…')
  const [enhancing, setEnhancing] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null)

  // Gallery
  const [generatedImages, setGeneratedImages] = useState<GalleryImage[]>([])
  const [exampleImages, setExampleImages] = useState<GalleryImage[]>([])

  // Track Pollinations images that are currently loading (to prevent concurrent requests)
  const [pollinationsLoadingIds, setPollinationsLoadingIds] = useState<Set<string>>(new Set())

  // History
  const [history, setHistory] = useState<GalleryImage[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  const pollinationsLoading = pollinationsLoadingIds.size > 0

  // Load example images from Picsum (reliable CDN, no rate limits)
  useEffect(() => {
    const examples: GalleryImage[] = EXAMPLE_PROMPTS.map((ep, i) => ({
      id: `example-${i}`,
      url: `https://picsum.photos/seed/${i + 20}/${ep.w}/${ep.h}`,
      prompt: ep.prompt,
      style: 'Default',
      timestamp: 0,
      aspectRatio: ep.w > ep.h ? '16:9' : ep.w === ep.h ? '1:1' : '9:16',
      isNew: false,
      width: ep.w,
      height: ep.h,
    }))
    setExampleImages(examples)
  }, [])

  // Close model dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLoadStateChange = useCallback((id: string, loading: boolean) => {
    setPollinationsLoadingIds(prev => {
      const next = new Set(prev)
      if (loading) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    setUploadedImageName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    toast.success('Image uploaded — it will be used as style reference')
  }

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || enhancing) return
    setEnhancing(true)
    await new Promise(r => setTimeout(r, 900))
    const enhancements = ['highly detailed', 'professional quality', 'sharp focus', 'beautiful composition', 'stunning lighting', 'award winning photography']
    setPrompt(p => p.trim() + `, ${enhancements.slice(0, 3).join(', ')}`)
    setEnhancing(false)
    toast.success('Prompt enhanced!')
  }

  const handleGenerate = useCallback(async () => {
    const base = prompt.trim()
    if (!base || generating) return

    const finalPrompt = uploadedImage
      ? base + ', maintain the style and composition of the reference image' + selectedStyle.suffix
      : base + selectedStyle.suffix
    const safeSize = clampSize(selectedRatio.width, selectedRatio.height)

    setGenerating(true)
    setGeneratingStatus('Connecting to AI…')

    try {
      let token = await getToken()
      if (!token) {
        await new Promise(r => setTimeout(r, 350))
        token = await getToken()
      }

      if (!token) {
        // No token — go straight to Pollinations
        const url = pollinationsUrl(finalPrompt, safeSize.width, safeSize.height)
        addImage({ url, prompt: base, source: 'pollinations', safeSize })
        toast.success('Generating image…')
        return
      }

      setGeneratingStatus('Generating your image…')

      const ctrl = new AbortController()
      const clientTimeout = setTimeout(() => ctrl.abort(), 25000)

      let res: Response
      try {
        res = await fetch('/api/images', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: finalPrompt,
            model: selectedModel.id,
            width: selectedRatio.width,
            height: selectedRatio.height,
          }),
          signal: ctrl.signal,
        })
      } catch {
        clearTimeout(clientTimeout)
        // Network error or timeout — fall back to Pollinations
        const url = pollinationsUrl(finalPrompt, safeSize.width, safeSize.height)
        addImage({ url, prompt: base, source: 'pollinations', safeSize })
        toast.success('Generating image (free mode)…')
        return
      }
      clearTimeout(clientTimeout)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 502) {
          toast.error(data.error || 'Image generation failed')
          return
        }
        // Any other error → Pollinations fallback
        const url = pollinationsUrl(finalPrompt, safeSize.width, safeSize.height)
        addImage({ url, prompt: base, source: 'pollinations', safeSize })
        toast.success('Generating image (free mode)…')
        return
      }

      const data = await res.json()

      if (data.source === 'dalle3') setGeneratingStatus('Generated with DALL·E 3!')
      else if (data.source === 'huggingface') setGeneratingStatus('Generated with FLUX AI!')
      else setGeneratingStatus('Generating…')

      addImage({ url: data.url, prompt: data.prompt || base, source: data.source, safeSize })
      toast.success(
        data.source === 'dalle3' ? 'Generated with DALL·E 3!' :
        data.source === 'huggingface' ? 'Generated with FLUX AI!' : 'Image generated!'
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate'
      toast.error(msg)
    } finally {
      setGenerating(false)
      setGeneratingStatus('Generating…')
      setPrompt('')
      setUploadedImage(null)
      setUploadedImageName('')
    }
  }, [prompt, generating, selectedStyle, selectedRatio, selectedModel, uploadedImage, getToken]) // eslint-disable-line react-hooks/exhaustive-deps

  function addImage({ url, prompt: imgPrompt, source, safeSize }: { url: string; prompt: string; source: string; safeSize: { width: number; height: number } }) {
    const newImg: GalleryImage = {
      id: `gen-${Date.now()}`,
      url,
      prompt: imgPrompt,
      style: selectedStyle.label,
      timestamp: Date.now(),
      aspectRatio: selectedRatio.id,
      isNew: true,
      width: source === 'pollinations' ? safeSize.width : selectedRatio.width,
      height: source === 'pollinations' ? safeSize.height : selectedRatio.height,
      source,
    }
    setGeneratedImages(prev => [newImg, ...prev])
    setHistory(prev => [newImg, ...prev].slice(0, 8))
  }

  const handleResolved = useCallback((id: string, resolvedUrl: string) => {
    setGeneratedImages(prev => prev.map(img => img.id === id ? { ...img, url: resolvedUrl } : img))
    setHistory(prev => prev.map(img => img.id === id ? { ...img, url: resolvedUrl } : img))
    setLightbox(prev => prev?.id === id ? { ...prev, url: resolvedUrl } : prev)
  }, [])

  const handleDownload = async (img: GalleryImage) => {
    const slug = img.prompt.slice(0, 24).replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '')
    const filename = `pyxis-${slug}.png`
    try {
      let blob: Blob
      if (img.url.startsWith('blob:')) {
        const res = await fetch(img.url)
        blob = await res.blob()
      } else if (img.url.startsWith('data:')) {
        const [header, b64] = img.url.split(',')
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: mime })
      } else if (img.url.includes('pollinations.ai')) {
        window.open(img.url, '_blank')
        toast.success('Opened in new tab — right-click to save')
        return
      } else {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 20000)
        try {
          const fetchUrl = img.url.startsWith('/api/images/proxy') ? img.url : '/api/images/proxy?url=' + encodeURIComponent(img.url)
          const res = await fetch(fetchUrl, { signal: controller.signal })
          clearTimeout(timer)
          if (!res.ok) throw new Error('proxy failed')
          blob = await res.blob()
        } catch {
          clearTimeout(timer)
          window.open(img.url, '_blank')
          toast.success('Opened in new tab — right-click to save')
          return
        }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 200)
      toast.success('Downloaded!')
    } catch {
      toast.error('Download failed')
    }
  }

  const handleRemix = (p: string) => {
    setPrompt(p)
    textareaRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isDisabled = generating || (pollinationsLoading && generatedImages.some(img => img.source === 'pollinations' && img.isNew))
  const allGalleryImages = [...generatedImages, ...exampleImages]

  return (
    <div className="min-h-0 flex flex-col bg-transparent text-text-primary">

      {/* ── Hero Header ───────────────────────────────────────────── */}
      <div className="w-full px-6 pt-10 pb-6 flex flex-col items-center text-center border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">AI Image Studio</h1>
        </div>
        <p className="text-secondary text-base max-w-lg">
          Generate stunning AI images — powered by DALL·E 3, FLUX, and more
        </p>
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Prompt Card ─────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">

          {/* Model selector bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-muted/60">
            <span className="text-xs text-muted font-medium uppercase tracking-wide">Model</span>
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setModelOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm font-medium text-primary hover:border-purple-400 transition-all shadow-sm"
              >
                {selectedModel.label}
                {selectedModel.badge && (
                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 text-[10px] font-semibold rounded">
                    {selectedModel.badge}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              </button>
              {modelOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-surface border border-border rounded-xl shadow-xl z-30 min-w-[200px] overflow-hidden">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m); setModelOpen(false) }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors ${
                        selectedModel.id === m.id ? 'text-purple-400 font-medium bg-surface-hover' : 'text-primary'
                      }`}
                    >
                      <span>{m.label}</span>
                      {m.badge && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-600 rounded font-semibold">{m.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show "waiting" hint when a Pollinations image is loading */}
            {pollinationsLoading && (
              <span className="ml-auto text-[11px] text-amber-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Image loading — wait before generating again
              </span>
            )}
          </div>

          {/* Textarea */}
          <div className="relative p-4">
            {uploadedImage && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl">
                <img src={uploadedImage} alt="ref" className="w-8 h-8 rounded object-cover" />
                <span className="text-xs text-purple-700 font-medium flex-1 truncate">{uploadedImageName}</span>
                <button onClick={() => { setUploadedImage(null); setUploadedImageName('') }}>
                  <X className="w-3.5 h-3.5 text-purple-400 hover:text-purple-600" />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, 5000))}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
              placeholder="Describe your image… e.g. 'a lion in golden hour, photorealistic 4K'"
              className="w-full resize-none outline-none bg-transparent text-primary text-base placeholder:text-muted min-h-[100px] leading-relaxed"
              rows={4}
              disabled={generating}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-secondary hover:bg-surface-hover rounded-lg transition-all text-xs"
                  title="Upload reference image"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
                <button
                  onClick={handleEnhancePrompt}
                  disabled={!prompt.trim() || enhancing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-40 rounded-lg transition-all text-xs font-medium"
                >
                  {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Enhance</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{prompt.length}/5000</span>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isDisabled}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-purple-200 hover:shadow-purple-300 transition-all active:scale-95"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="max-w-[120px] truncate">{generatingStatus}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Settings Row ───────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted font-medium uppercase tracking-wide w-20 shrink-0">Ratio</span>
            <div className="flex items-center gap-2">
              {ASPECT_RATIOS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRatio(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedRatio.id === r.id
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-secondary border-border hover:border-border-light'
                  }`}
                >
                  <span>{r.label}</span>
                  <span className={`ml-1 ${selectedRatio.id === r.id ? 'text-white/70' : 'text-muted'}`}>{r.short}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted font-medium uppercase tracking-wide">Quality</span>
              {QUALITY_OPTIONS.map(q => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuality(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedQuality.id === q.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-surface text-secondary border-border hover:border-purple-400'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-medium uppercase tracking-wide w-20 shrink-0">Style</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border flex-shrink-0 ${
                    selectedStyle.id === s.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border-transparent shadow-sm'
                      : 'bg-surface text-secondary border-border hover:border-purple-400 hover:text-purple-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Gallery ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-primary">
              Gallery
              <span className="ml-2 text-sm font-normal text-muted">
                {generatedImages.length > 0 ? `${generatedImages.length} generated · ` : ''}
                {exampleImages.length} examples
              </span>
            </h2>
            {generatedImages.length > 0 && (
              <button
                onClick={() => setGeneratedImages([])}
                className="text-xs text-muted hover:text-red-400 transition-colors"
              >
                Clear generated
              </button>
            )}
          </div>

          <div className="columns-2 md:columns-4 gap-4">
            {allGalleryImages.map(img => (
              <ImageCard
                key={img.id}
                img={img}
                onExpand={setLightbox}
                onDownload={handleDownload}
                onRemix={handleRemix}
                onResolved={handleResolved}
                onLoadStateChange={handleLoadStateChange}
              />
            ))}
          </div>
        </div>

        {/* ── History Strip ────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="border-t border-border pt-6">
            <h3 className="text-xs text-muted font-medium uppercase tracking-wide mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Recent Generations
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {history.map(img => (
                <button
                  key={img.id}
                  onClick={() => setLightbox(img)}
                  className="flex-shrink-0 group relative w-16 h-16 rounded-xl overflow-hidden border-2 border-transparent hover:border-purple-400 transition-all"
                  title={img.prompt}
                >
                  <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Lightbox Modal ───────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-surface rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <LightboxImage url={lightbox.url} prompt={lightbox.prompt} />

            <div className="p-5 border-t border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary mb-1 leading-snug">{lightbox.prompt}</p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">{lightbox.style}</span>
                    <span>{lightbox.aspectRatio}</span>
                    {lightbox.timestamp > 0 && <span>{timeAgo(lightbox.timestamp)}</span>}
                    {lightbox.source && lightbox.source !== 'pollinations' && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium uppercase text-[10px]">
                        {lightbox.source === 'dalle3' ? 'DALL·E 3' : lightbox.source === 'huggingface' ? 'FLUX' : lightbox.source}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { handleRemix(lightbox.prompt); setLightbox(null) }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-surface-hover hover:bg-surface-active rounded-lg text-sm text-primary transition-all"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Remix
                  </button>
                  <button
                    onClick={() => handleDownload(lightbox)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 rounded-lg text-sm text-white font-medium transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
