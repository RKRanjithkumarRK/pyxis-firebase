import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

  // Check if user has OpenAI key — use DALL-E 3 if available
  const keyDoc = await adminDb.doc(`users/${user.uid}/private/apikeys`).get()
  const userKeys = keyDoc.exists ? keyDoc.data() || {} : {}
  const openaiKey = userKeys.openai || process.env.OPENAI_API_KEY

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

  // Return a Pollinations URL for the client to load directly.
  // We do NOT fetch it server-side — Vercel's IP ranges are blocked by Pollinations.
  // The browser <img> tag loads the URL directly from the user's IP, which works fine.
  const pollinationsModel = resolvePollinationsModel(model)
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=${safeSize.width}&height=${safeSize.height}&seed=${seed}&nologo=true&model=${pollinationsModel}`
  return NextResponse.json({ url, prompt, source: 'pollinations' })
}
