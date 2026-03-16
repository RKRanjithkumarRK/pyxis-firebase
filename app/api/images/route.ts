import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

function fallbackImageUrl(prompt: string, width: number, height: number, seed: number) {
  const params = new URLSearchParams({
    prompt,
    width: String(width),
    height: String(height),
    seed: String(seed),
  })
  return `/api/images/fallback?${params.toString()}`
}

function normalizeSize(width: number, height: number, maxEdge = 1024) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 512
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 512
  const maxDim = Math.max(safeWidth, safeHeight)
  if (maxDim <= maxEdge) {
    return { width: Math.round(safeWidth), height: Math.round(safeHeight) }
  }
  const scale = maxEdge / maxDim
  return {
    width: Math.max(256, Math.round(safeWidth * scale)),
    height: Math.max(256, Math.round(safeHeight * scale)),
  }
}

function openaiSize(width: number, height: number) {
  if (width === height) return '1024x1024'
  return width > height ? '1536x1024' : '1024x1536'
}

async function openaiImage(
  prompt: string,
  key: string,
  width: number,
  height: number
): Promise<{ url: string; source: 'openai' }> {
  const size = openaiSize(width, height)
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size }),
      signal: ctrl.signal,
    })
    clearTimeout(tid)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('no_b64')
    return { url: `data:image/png;base64,${b64}`, source: 'openai' }
  } catch (err) {
    clearTimeout(tid)
    throw err
  }
}

function imagenAspectRatio(width: number, height: number) {
  if (width === height) return '1:1'
  const ratio = width / height
  if (ratio >= 1.6) return '16:9'
  if (ratio >= 1.2) return '4:3'
  if (ratio <= 0.62) return '9:16'
  if (ratio <= 0.85) return '3:4'
  return '1:1'
}

async function imagenImage(
  prompt: string,
  key: string,
  width: number,
  height: number
): Promise<{ url: string; source: 'imagen' }> {
  const models = [
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002',
  ]
  const aspectRatio = imagenAspectRatio(width, height)
  for (const model of models) {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 18000)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio },
          }),
          signal: ctrl.signal,
        }
      )
      clearTimeout(tid)
      if (!res.ok) {
        if (res.status === 404 || res.status === 400) continue
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const prediction = data.predictions?.[0]
      const b64 = prediction?.bytesBase64Encoded
      const mime = prediction?.mimeType || 'image/png'
      if (!b64) throw new Error('no_b64')
      return { url: `data:${mime};base64,${b64}`, source: 'imagen' }
    } catch (err: any) {
      clearTimeout(tid)
      if (err.name === 'AbortError') break
    }
  }
  throw new Error('imagen_failed')
}

async function huggingfaceImage(prompt: string, key: string): Promise<{ url: string; source: 'huggingface' }> {
  const { InferenceClient } = await import('@huggingface/inference')
  const client = new InferenceClient(key)
  const imageResult = await client.textToImage({
    model: 'black-forest-labs/FLUX.1-dev',
    inputs: prompt,
  })

  if (typeof imageResult === 'string') {
    if (imageResult.startsWith('data:')) {
      return { url: imageResult, source: 'huggingface' }
    }
    return { url: `data:image/png;base64,${imageResult}`, source: 'huggingface' }
  }

  const imageBlob = imageResult as Blob
  const contentType = imageBlob.type || 'image/png'
  const buffer = await imageBlob.arrayBuffer()
  if (buffer.byteLength < 1000) throw new Error('empty_image')
  const base64 = Buffer.from(buffer).toString('base64')
  return { url: `data:${contentType};base64,${base64}`, source: 'huggingface' }
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, width = 512, height = 512 } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const safeSize = normalizeSize(width, height)
  const seed = Math.floor(Math.random() * 999999)

  const openaiKey = process.env.OPENAI_API_KEY
  const hfKey = process.env.HUGGINGFACE_API_KEY
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_API_KEY_2 ||
    process.env.GOOGLE_API_KEY_3

  if (geminiKey) {
    try {
      const result = await imagenImage(prompt, geminiKey, safeSize.width, safeSize.height)
      return NextResponse.json({ url: result.url, prompt, source: result.source })
    } catch {
      // try next provider
    }
  }

  if (openaiKey) {
    try {
      const result = await openaiImage(prompt, openaiKey, safeSize.width, safeSize.height)
      return NextResponse.json({ url: result.url, prompt, source: result.source })
    } catch {
      // try next provider
    }
  }

  if (hfKey) {
    try {
      const result = await huggingfaceImage(prompt, hfKey)
      return NextResponse.json({ url: result.url, prompt, source: result.source })
    } catch {
      // fall through to Pollinations
    }
  }

  // Free fallback (Pollinations -> OpenVerse -> Picsum) served via our own endpoint
  const fallbackUrl = fallbackImageUrl(prompt, safeSize.width, safeSize.height, seed)
  return NextResponse.json({ url: fallbackUrl, prompt, source: 'pollinations' })
}

