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

async function geminiImage(prompt: string, key: string): Promise<{ url: string; source: 'gemini' }> {
  const models = [
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]
  for (const model of models) {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), 5000)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
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
      const imgPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)
      if (imgPart?.inlineData) {
        const { mimeType, data: b64 } = imgPart.inlineData
        console.log(`Gemini success: ${model}`)
        return { url: `data:${mimeType};base64,${b64}`, source: 'gemini' }
      }
    } catch (err: any) {
      clearTimeout(tid)
      if (err.name === 'AbortError') break // timeout = budget exhausted, stop trying
      // other error = try next model
    }
  }
  throw new Error('gemini_failed')
}

async function dalleImage(
  prompt: string,
  key: string,
  width: number,
  height: number
): Promise<{ url: string; source: 'dalle3' }> {
  const size = width > height ? '1792x1024' : height > width ? '1024x1792' : '1024x1024'
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, response_format: 'url' }),
      signal: ctrl.signal,
    })
    clearTimeout(tid)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const url = data.data[0]?.url
    if (!url) throw new Error('no_url')
    return { url, source: 'dalle3' }
  } catch (err) {
    clearTimeout(tid)
    throw err
  }
}

async function huggingfaceImage(
  prompt: string,
  key: string,
  width: number,
  height: number
): Promise<{ url: string; source: 'huggingface' }> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 25000)
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width, height, num_inference_steps: 4 },
        }),
        signal: ctrl.signal,
      }
    )
    clearTimeout(tid)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) throw new Error('not_image')
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength < 1000) throw new Error('empty_image')
    const base64 = Buffer.from(buffer).toString('base64')
    return { url: `data:${contentType};base64,${base64}`, source: 'huggingface' }
  } catch (err) {
    clearTimeout(tid)
    throw err
  }
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

  // Run all available providers in parallel — first success wins
  const providers: Promise<{ url: string; source: string }>[] = []
  if (geminiKey) providers.push(geminiImage(prompt, geminiKey))
  if (openaiKey) providers.push(dalleImage(prompt, openaiKey, safeSize.width, safeSize.height))
  if (hfKey) providers.push(huggingfaceImage(prompt, hfKey, safeSize.width, safeSize.height))

  if (providers.length > 0) {
    try {
      const result = await Promise.any(providers)
      return NextResponse.json({ url: result.url, prompt, source: result.source })
    } catch {
      // all providers failed — fall through to Pollinations
    }
  }

  // Free fallback (Pollinations -> OpenVerse -> Picsum) served via our own endpoint
  const fallbackUrl = fallbackImageUrl(prompt, safeSize.width, safeSize.height, seed)
  return NextResponse.json({ url: fallbackUrl, prompt, source: 'pollinations' })
}

