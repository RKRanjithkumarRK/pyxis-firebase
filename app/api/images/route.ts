import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

function normalizeSize(width: number, height: number, maxEdge = 1024) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1024
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1024
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
  if (normalized.includes('anime')) return 'flux-anime'
  if (normalized.includes('photo') || normalized.includes('real')) return 'flux-realism'
  return 'flux'
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, model = 'flux', width = 1024, height = 1024 } = await req.json()
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
      }
    } catch (err: any) { console.error('DALL-E 3 error:', err) }
  }

  // 2. HuggingFace FLUX.1-schnell — only attempt when an API key is configured.
  //    Anonymous HF requests are unreliable (model cold starts, low quota) and
  //    waste up to 48s before timing out, making the UI feel frozen.
  if (hfKey) try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 25000)
    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(hfKey ? { Authorization: `Bearer ${hfKey}` } : {}),
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            width: safeSize.width,
            height: safeSize.height,
            num_inference_steps: 4,
          },
        }),
        signal: ctrl.signal,
      }
    )
    clearTimeout(timeoutId)

    if (hfRes.ok) {
      const contentType = hfRes.headers.get('content-type') || ''
      // Only proceed if HuggingFace returned actual image bytes, not a JSON error body
      // (HF can return status 200 with {"error":"...","estimated_time":20} when loading)
      if (contentType.startsWith('image/')) {
        const buffer = await hfRes.arrayBuffer()
        if (buffer.byteLength > 1000) { // sanity-check: real images are > 1KB
          const base64 = Buffer.from(buffer).toString('base64')
          const dataUrl = `data:${contentType};base64,${base64}`
          return NextResponse.json({ url: dataUrl, prompt, source: 'huggingface' })
        }
      }
      const body = await hfRes.text().catch(() => '')
      console.error('HuggingFace non-image response:', contentType, body.slice(0, 200))
    } else {
      console.error('HuggingFace error:', hfRes.status, await hfRes.text().catch(() => ''))
    }
  } catch (err: any) {
    console.error('HuggingFace fetch error:', err.message)
  }

  // 3. Pollinations URL fallback — browser loads directly (Vercel IPs are blocked
  //    server-side). May have rate limits when multiple images load concurrently.
  const pollinationsModel = resolvePollinationsModel(model)
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${safeSize.width}&height=${safeSize.height}&seed=${seed}&nologo=true&model=${pollinationsModel}`
  return NextResponse.json({ url, prompt, source: 'pollinations' })
}
