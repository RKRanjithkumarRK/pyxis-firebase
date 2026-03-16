import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

async function fetchBinaryImage(url: string, timeoutMs = 12_000): Promise<Response | null> {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pyxis/1.0)' },
    })
    clearTimeout(tid)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    return res
  } catch {
    clearTimeout(tid)
    return null
  }
}

const POLLINATION_MODELS = ['turbo', 'flux']

async function fetchPollinationsImage(prompt: string, width: number, height: number, seed: number) {
  for (const model of POLLINATION_MODELS) {
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?seed=${seed}&width=${width}&height=${height}&nologo=true&model=${model}`
    const timeout = model === POLLINATION_MODELS[0] ? 8_000 : 12_000
    const res = await fetchBinaryImage(url, timeout)
    if (res) return res
    await sleep(600)
  }
  return null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prompt = searchParams.get('prompt')?.trim()
  const width = parseInt(searchParams.get('width') || '512', 10)
  const height = parseInt(searchParams.get('height') || '512', 10)
  const seed = parseInt(searchParams.get('seed') || '', 10) || Date.now()

  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const pollinationsSize = normalizeSize(width, height)
  const res = await fetchPollinationsImage(prompt, pollinationsSize.width, pollinationsSize.height, seed)

  if (!res) {
    return NextResponse.json(
      { error: 'No relevant image available right now. Please try again.' },
      { status: 502 }
    )
  }

  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
