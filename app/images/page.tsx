'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowUp, Image as ImageIcon, Loader2, Download, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface GeneratedImage {
  url: string
  prompt: string
  source: string
}

export default function ImagesPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const { getToken } = useAuth()

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    const currentPrompt = prompt.trim()
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Generation failed')
      }

      const data = await res.json()
      setImages(prev => [{ url: data.url, prompt: data.prompt || currentPrompt, source: data.source || 'pollinations' }, ...prev])
      setPrompt('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate image')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (url: string, prompt: string) => {
    try {
      const proxyUrl = '/api/images/proxy?url=' + encodeURIComponent(url)
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `pyxis-${prompt.slice(0, 30).replace(/\s+/g, '-')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200)
    } catch {
      toast.error('Failed to download image')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border/30">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <ImageIcon size={20} />
          Images
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {images.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
                <ImageIcon size={28} className="text-text-tertiary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Generate images with AI</h2>
              <p className="text-sm text-text-tertiary max-w-md">
                Describe anything — a sunset, a robot, a painting style. Free generation powered by Pollinations.ai.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="text-accent animate-spin" />
              <span className="text-text-secondary text-sm">Generating your image, this may take up to 30 seconds...</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8">
            {images.map((img, i) => (
              <div key={i} className="msg-in group relative">
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full max-w-lg rounded-2xl border border-border/50 shadow-lg"
                  loading="lazy"
                />
                <div className="flex items-start justify-between mt-3">
                  <p className="text-sm text-text-secondary flex-1">{img.prompt}</p>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <button
                      onClick={() => handleDownload(img.url, img.prompt)}
                      className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </button>
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 bg-surface rounded-3xl border border-border/50 px-4 py-3 input-glow">
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
              placeholder="Describe an image... (e.g. a lion in the savanna at sunset)"
              className="flex-1 bg-transparent text-text-primary text-[15px] placeholder:text-text-tertiary outline-none"
              disabled={loading}
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="p-2 rounded-full bg-text-primary text-bg hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="text-center text-xs text-text-tertiary mt-2">Free image generation via Pollinations.ai · Add OpenAI key in Settings for DALL-E 3</p>
        </div>
      </div>
    </div>
  )
}
