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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const url =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
        `?seed=${seed}&width=${width}&height=${height}&nologo=true&model=${model}`
      const timeout = attempt === 0 ? 15_000 : 25_000
      const res = await fetchBinaryImage(url, timeout)
      if (res) return res
      await sleep(1200 + attempt * 800)
    }
  }
  return null
}

type OpenVerseTag = { name?: string }
type OpenVerseResult = { url?: string; title?: string; tags?: OpenVerseTag[] }

function scoreOpenVerseResult(result: OpenVerseResult, terms: string[]) {
  if (!terms.length) return 0
  const title = (result.title || '').toLowerCase()
  const tags = (result.tags || []).map(t => t.name || '').join(' ').toLowerCase()
  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 3
    if (tags.includes(term)) score += 2
  }
  return score
}

function extractTerms(prompt: string) {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(t => t.length >= 4)
    .slice(0, 6)
}

async function fetchOpenVerseImage(prompt: string, seed: number): Promise<Response | null> {
  try {
    const corePrompt = prompt.split(',')[0]?.trim()
    if (!corePrompt) return null
    const terms = extractTerms(corePrompt)

    const search = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(corePrompt)}&page_size=20&license_type=commercial`,
      { signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'Pyxis/1.0' } }
    )
    if (!search.ok) return null
    const data = await search.json()
    const results: OpenVerseResult[] = data?.results ?? []
    if (!results.length) return null

    const scored = results
      .map((result) => ({ result, score: scoreOpenVerseResult(result, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    if (!scored.length) return null
    const picked = scored[Math.abs(seed) % Math.min(scored.length, 20)]?.result
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
  const pollinationsTask = fetchPollinationsImage(prompt, safeSize.width, safeSize.height, seed)
    .then((res) => {
      if (!res) throw new Error('pollinations_failed')
      return res
    })

  const openverseTask = fetchOpenVerseImage(prompt, seed)
    .then((res) => {
      if (!res) throw new Error('openverse_failed')
      return res
    })

  let res: Response | null = null
  try {
    res = await Promise.any([openverseTask, pollinationsTask])
  } catch {
    res = null
  }

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
