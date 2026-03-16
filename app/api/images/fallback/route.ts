import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

async function fetchOpenVerseImage(prompt: string, seed: number): Promise<Response | null> {
  try {
    const corePrompt = prompt.split(',')[0]?.trim()
    if (!corePrompt) return null

    const search = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(corePrompt)}&page_size=20&license_type=commercial`,
      { signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'Pyxis/1.0' } }
    )
    if (!search.ok) return null
    const data = await search.json()
    const results: Array<{ url?: string }> = data?.results ?? []
    if (!results.length) return null

    const idx = Math.abs(seed) % Math.min(results.length, 20)
    const picked = results[idx]
    if (!picked?.url) return null
    return fetchBinaryImage(picked.url, 12_000)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prompt = searchParams.get('prompt')?.trim()
  const width = parseInt(searchParams.get('width') || '512', 10)
  const height = parseInt(searchParams.get('height') || '512', 10)
  const seed = parseInt(searchParams.get('seed') || '', 10) || Date.now()

  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  const safeSize = normalizeSize(width, height)
  const pollinationsUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?seed=${seed}&width=${safeSize.width}&height=${safeSize.height}&nologo=true&model=turbo`

  let res = await fetchBinaryImage(pollinationsUrl, 12_000)
  if (!res) {
    await sleep(1500)
    res = await fetchBinaryImage(pollinationsUrl, 12_000)
  }

  if (!res) {
    res = await fetchOpenVerseImage(prompt, seed)
  }

  if (!res) {
    const picsumUrl = `https://picsum.photos/seed/${seed}/${safeSize.width}/${safeSize.height}`
    res = await fetchBinaryImage(picsumUrl, 8_000)
  }

  if (!res) {
    return NextResponse.json(
      { error: 'Image generation temporarily unavailable. Please try again.' },
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
