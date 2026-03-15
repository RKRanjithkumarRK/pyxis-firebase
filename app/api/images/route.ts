import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

function normalizeSize(width: number, height: number, maxEdge = 512) {
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

function resolvePollinationsModel(rawModel: unknown) {
  const normalized = typeof rawModel === 'string' ? rawModel.toLowerCase() : ''
  if (normalized.includes('anime')) return 'turbo'
  if (normalized.includes('photo') || normalized.includes('real')) return 'turbo'
  return 'turbo'
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, model = 'flux', width = 512, height = 512 } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const seed = Math.floor(Math.random() * 999999)
  const safeSize = normalizeSize(width, height)

  // Fetch user API keys
  const keyDoc = await adminDb.doc(`users/${user.uid}/private/apikeys`).get()
  const userKeys = keyDoc.exists ? keyDoc.data() || {} : {}
  const openaiKey = userKeys.openai || process.env.OPENAI_API_KEY
  const hfKey = userKeys.huggingface || process.env.HUGGINGFACE_API_KEY

  // 1. DALL-E 3 — best quality, requires OpenAI key
  if (openaiKey) {
    try {
      const isLandscape = width > height
      const isPortrait = height > width
      const dalleSize = isLandscape ? '1792x1024' : isPortrait ? '1024x1792' : '1024x1024'
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: dalleSize, response_format: 'url' }),
      })
      if (response.ok) {
        const data = await response.json()
        const url = data.data[0]?.url
        const revisedPrompt = data.data[0]?.revised_prompt || prompt
        if (url) return NextResponse.json({ url, prompt: revisedPrompt, source: 'dalle3' })
      } else {
        const errData = await response.json().catch(() => ({}))
        const msg = errData.error?.message || `HTTP ${response.status}`
        console.error('DALL-E 3 failed:', response.status, msg)
        const isQuotaError = response.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('billing') || msg.toLowerCase().includes('credit')
        if (userKeys.openai && !isQuotaError) {
          return NextResponse.json({ error: `OpenAI: ${msg}` }, { status: 502 })
        }
        if (isQuotaError) console.warn('DALL-E 3 quota exceeded, falling back to free generation')
      }
    } catch (err: any) {
      console.error('DALL-E 3 error:', err)
      if (userKeys.openai) {
        return NextResponse.json({ error: `OpenAI connection failed: ${err.message}` }, { status: 502 })
      }
    }
  }

  // 2. HuggingFace FLUX.1-schnell — only when API key configured
  if (hfKey) try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 25000)
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hfKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { width: safeSize.width, height: safeSize.height, num_inference_steps: 4 },
        }),
        signal: ctrl.signal,
      }
    )
    clearTimeout(timeoutId)
    if (hfRes.ok) {
      const contentType = hfRes.headers.get('content-type') || ''
      if (contentType.startsWith('image/')) {
        const buffer = await hfRes.arrayBuffer()
        if (buffer.byteLength > 1000) {
          const base64 = Buffer.from(buffer).toString('base64')
          return NextResponse.json({ url: `data:${contentType};base64,${base64}`, prompt, source: 'huggingface' })
        }
      }
    }
  } catch (err: any) {
    console.error('HuggingFace fetch error:', err.message)
  }

  // 3. Pollinations — return URL for browser to load directly (user's own IP, not shared Vercel IP).
  //    DO NOT fetch server-side: Vercel's shared IP gets rate-limited by Pollinations (max 1 queue).
  const pollinationsModel = resolvePollinationsModel(model)
  const encoded = encodeURIComponent(prompt)
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${safeSize.width}&height=${safeSize.height}&seed=${seed}&nologo=true&model=${pollinationsModel}`
  return NextResponse.json({ url: pollinationsUrl, prompt, source: 'pollinations' })
}
