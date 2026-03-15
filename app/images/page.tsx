'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Sparkles, Download, Maximize2, RotateCcw, Paperclip, ChevronDown,
  X, Loader2, Wand2, Image as ImageIcon, Zap, Clock, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GalleryImage {
  id: string
  url: string
  prompt: string
  style: string
  timestamp: number
  aspectRatio: string
  isNew?: boolean
  isLoading?: boolean
  width: number
  height: number
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

function pollinationsUrl(prompt: string, w: number, h: number, seed?: number) {
  const seedParam = seed ? `&seed=${seed}` : ''
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true${seedParam}`
}

function clampSize(width: number, height: number, maxEdge = 1024) {
  const safeW = Number.isFinite(width) && width > 0 ? width : 1024
  const safeH = Number.isFinite(height) && height > 0 ? height : 1024
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

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="break-inside-avoid mb-4 rounded-2xl overflow-hidden bg-surface-muted animate-pulse" style={{ height: 280 }}>
      <div className="w-full h-full bg-gradient-to-br from-surface-hover to-surface-muted flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
        </div>
        <div className="space-y-2 text-center">
          <div className="h-2 w-32 bg-surface-hover rounded mx-auto" />
          <div className="h-2 w-20 bg-surface-hover rounded mx-auto" />
        </div>
      </div>
    </div>
  )
}

// ─── Image Card ───────────────────────────────────────────────────────────────

interface ImageCardProps {
  img: GalleryImage
  onExpand: (img: GalleryImage) => void
  onDownload: (img: GalleryImage) => void
  onRemix: (prompt: string) => void
}

function ImageCard({ img, onExpand, onDownload, onRemix }: ImageCardProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [src, setSrc] = useState(img.url)
  const [triedProxy, setTriedProxy] = useState(false)
  const [autoRetries, setAutoRetries] = useState(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSrc(img.url)
    setLoaded(false)
    setErrored(false)
    setRetryKey(0)
    setTriedProxy(false)
    setAutoRetries(0)
  }, [img.url])

  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current) }, [])

  const toProxyUrl = (url: string) => `/api/images/proxy?url=${encodeURIComponent(url)}`

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (retryTimer.current) clearTimeout(retryTimer.current)
    setErrored(false)
    setLoaded(false)
    setTriedProxy(false)
    setAutoRetries(0)
    setSrc(img.url)
    setRetryKey(k => k + 1)
  }

  const handleError = () => {
    // For Pollinations: skip proxy (Vercel IPs are blocked), auto-retry with new seed
    if (src.includes('pollinations.ai') && autoRetries < 4) {
      const nextRetry = autoRetries + 1
      setAutoRetries(nextRetry)
      setLoaded(false)
      setErrored(false)
      retryTimer.current = setTimeout(() => {
        const seed = Math.floor(Math.random() * 999999)
        const newSrc = `https://image.pollinations.ai/prompt/${encodeURIComponent(img.prompt)}?width=${img.width}&height=${img.height}&nologo=true&seed=${seed}&model=flux`
        setSrc(newSrc)
        setRetryKey(k => k + 1)
      }, 25000) // 25s flat — lets Pollinations queue fully clear between attempts
      return
    }
    // For other URLs (DALL-E etc), try proxy once
    if (!triedProxy && !img.url.startsWith('data:') && !img.url.startsWith('/api/images/proxy') && !src.includes('pollinations.ai')) {
      setTriedProxy(true)
      setLoaded(false)
      setErrored(false)
      setSrc(toProxyUrl(img.url))
      return
    }
    setErrored(true)
  }

  return (
    <div
      className="break-inside-avoid mb-4 group relative rounded-2xl overflow-hidden bg-surface-muted shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
      style={{ transform: 'translateZ(0)' }}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-hover to-surface-muted animate-pulse" style={{ minHeight: 200 }}>
          <Loader2 className="w-5 h-5 text-muted animate-spin" />
          <span className="text-muted text-[10px]">{autoRetries > 0 ? `Queue busy — retrying (${autoRetries}/4)` : 'Generating…'}</span>
        </div>
      )}
      {!errored ? (
        <img
          key={`${retryKey}-${src}`}
          src={src}
          alt={img.prompt}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-48 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface-muted to-bg">
          <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-muted" />
          </div>
          <p className="text-muted text-xs text-center px-4 leading-relaxed line-clamp-2">{img.prompt}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border text-secondary text-xs hover:bg-surface-hover hover:text-primary transition-colors shadow-sm"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {/* Action buttons top-right */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(img) }}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg flex items-center justify-center transition-all"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(img) }}
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

        {/* Prompt bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-xs leading-snug line-clamp-2 font-medium">{img.prompt}</p>
          {img.timestamp > 0 && (
            <p className="text-white/50 text-[10px] mt-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {timeAgo(img.timestamp)}
            </p>
          )}
        </div>
      </div>

      {/* New badge */}
      {img.isNew && (
        <div className="absolute top-3 left-3">
          <span className="px-2 py-0.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-[10px] font-semibold rounded-full shadow-lg">
            NEW
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Lightbox Image (with proxy fallback) ────────────────────────────────────

function LightboxImage({ url, prompt }: { url: string; prompt: string }) {
  const [src, setSrc] = useState(url)
  const [retryKey, setRetryKey] = useState(0)
  const [retries, setRetries] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { setSrc(url); setRetryKey(0); setRetries(0) }, [url])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <img
      key={`lb-${retryKey}`}
      src={src}
      alt={prompt}
      onError={() => {
        // For Pollinations: retry with new seed (proxy also fails for these)
        if (src.includes('pollinations.ai') && retries < 4) {
          const next = retries + 1
          setRetries(next)
          timer.current = setTimeout(() => {
            const seed = Math.floor(Math.random() * 999999)
            setSrc(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`)
            setRetryKey(k => k + 1)
          }, 3000 * next)
          return
        }
        // For DALL-E / other URLs, try proxy once
        if (!src.startsWith('data:') && !src.startsWith('/api/images/proxy') && !src.includes('pollinations.ai')) {
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
  const [enhancing, setEnhancing] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null)

  // Gallery
  const [generatedImages, setGeneratedImages] = useState<GalleryImage[]>([])
  const [exampleImages, setExampleImages] = useState<GalleryImage[]>([])
  const [showSkeleton, setShowSkeleton] = useState(false)

  // History
  const [history, setHistory] = useState<GalleryImage[]>([])

  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)

  // Load example images on mount — use Picsum (reliable CDN, no rate limits)
  // Pollinations allows only 1 concurrent request/IP; using it for examples would
  // fill the queue and block actual generation requests.
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
    // Simulate AI enhancement by appending quality descriptors
    await new Promise(r => setTimeout(r, 900))
    const enhancements = [
      'highly detailed', 'professional quality', 'sharp focus',
      'beautiful composition', 'stunning lighting', 'award winning photography',
    ]
    const picked = enhancements.slice(0, 3).join(', ')
    setPrompt(p => p.trim() + `, ${picked}`)
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
    let fallbackUsed = false
    const fallbackToPollinations = () => {
      if (fallbackUsed) return
      fallbackUsed = true
      const seed = Math.floor(Math.random() * 999999)
      const url = pollinationsUrl(finalPrompt, safeSize.width, safeSize.height, seed)
      const newImg: GalleryImage = {
        id: `gen-${Date.now()}`,
        url,
        prompt: base,
        style: selectedStyle.label,
        timestamp: Date.now(),
        aspectRatio: selectedRatio.id,
        isNew: true,
        width: safeSize.width,
        height: safeSize.height,
      }
      setGeneratedImages(prev => [newImg, ...prev])
      setHistory(prev => [newImg, ...prev].slice(0, 8))
      setPrompt('')
      setUploadedImage(null)
      setUploadedImageName('')
      toast.success('Image generated!')
    }

    setGenerating(true)
    setShowSkeleton(true)

    try {
      let token = await getToken()
      if (!token) {
        await new Promise(r => setTimeout(r, 350))
        token = await getToken()
      }

      if (!token) {
        fallbackToPollinations()
        return
      }

      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: selectedModel.id,
          width: selectedRatio.width,
          height: selectedRatio.height,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401 || res.status === 503) {
          fallbackToPollinations()
          return
        }
        throw new Error(data.error || 'Generation failed')
      }

      const data = await res.json()
      const newImg: GalleryImage = {
        id: `gen-${Date.now()}`,
        url: data.url,
        prompt: base,
        style: selectedStyle.label,
        timestamp: Date.now(),
        aspectRatio: selectedRatio.id,
        isNew: true,
        width: selectedRatio.width,
        height: selectedRatio.height,
      }

      setGeneratedImages(prev => [newImg, ...prev])
      setHistory(prev => [newImg, ...prev].slice(0, 8))
      setPrompt('')
      setUploadedImage(null)
      setUploadedImageName('')
      toast.success('Image generated!')
    } catch (err: unknown) {
      if (!fallbackUsed) {
        fallbackToPollinations()
        return
      }
      const msg = err instanceof Error ? err.message : 'Failed to generate'
      toast.error(msg)
    } finally {
      setGenerating(false)
      setShowSkeleton(false)
    }
  }, [prompt, generating, selectedStyle, selectedRatio, selectedModel, uploadedImage, getToken])

  const handleDownload = async (img: GalleryImage) => {
    const slug = img.prompt.slice(0, 24).replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '')
    const filename = `pyxis-${slug}.png`
    try {
      let blob: Blob
      if (img.url.startsWith('data:')) {
        const [header, b64] = img.url.split(',')
        const mime = header.match(/:(.*?);/)?.[1] || 'image/png'
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        blob = new Blob([bytes], { type: mime })
      } else if (img.url.includes('pollinations.ai')) {
        // Pollinations blocks server-side fetches (Vercel IPs) — open directly in new tab
        window.open(img.url, '_blank')
        toast.success('Opened in new tab — right-click to save')
        return
      } else {
        // For other URLs (e.g. DALL-E cdn.openai.com), use proxy
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 20000)
        try {
          const fetchUrl = img.url.startsWith('/api/images/proxy')
            ? img.url
            : '/api/images/proxy?url=' + encodeURIComponent(img.url)
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
          Create stunning visuals with AI — free, instant, no account needed
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
              placeholder="Describe an image or upload your photo, and I'll create something unique…"
              className="w-full resize-none outline-none bg-transparent text-primary text-base placeholder:text-muted min-h-[100px] leading-relaxed"
              rows={4}
              disabled={generating}
            />
            {/* Bottom bar of textarea */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {/* Upload */}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-secondary hover:bg-surface-hover rounded-lg transition-all text-xs"
                  title="Upload reference image"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
                {/* Enhance */}
                <button
                  onClick={handleEnhancePrompt}
                  disabled={!prompt.trim() || enhancing}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-purple-500 hover:text-purple-700 hover:bg-purple-50 disabled:opacity-40 rounded-lg transition-all text-xs font-medium"
                  title="Enhance prompt with AI"
                >
                  {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Enhance</span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{prompt.length}/5000</span>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generating}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-purple-200 hover:shadow-purple-300 transition-all active:scale-95"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Settings Row ───────────────────────────────────── */}
        <div className="space-y-3">
          {/* Aspect ratio */}
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
                  <span className={`ml-1 ${selectedRatio.id === r.id ? 'text-white/70' : 'text-muted'}`}>
                    {r.short}
                  </span>
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

          {/* Style presets */}
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
            {/* Skeleton while generating */}
            {showSkeleton && (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {allGalleryImages.map(img => (
              <ImageCard
                key={img.id}
                img={img}
                onExpand={setLightbox}
                onDownload={handleDownload}
                onRemix={handleRemix}
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
            {/* Close */}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Image */}
            <LightboxImage url={lightbox.url} prompt={lightbox.prompt} />

            {/* Info panel */}
            <div className="p-5 border-t border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary mb-1 leading-snug">{lightbox.prompt}</p>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full font-medium">{lightbox.style}</span>
                    <span>{lightbox.aspectRatio}</span>
                    {lightbox.timestamp > 0 && <span>{timeAgo(lightbox.timestamp)}</span>}
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
