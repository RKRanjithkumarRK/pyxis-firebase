import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const HORDE_BASE_URL = 'https://aihorde.net/api/v2'
const HORDE_DEFAULT_KEY = '0000000000'
const HORDE_DEFAULT_AGENT = 'pyxis-firebase:1.0:contact@pyxis.local'
const HORDE_POLL_INTERVAL_MS = 2000
const HORDE_TIMEOUT_MS = 25_000

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
    const timeout = model === POLLINATION_MODELS[0] ? 12_000 : 16_000
    const res = await fetchBinaryImage(url, timeout)
    if (res) return res
    await sleep(600)
  }
  return null
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const contentType = match[1] || 'image/webp'
  const base64 = match[2] || ''
  if (!base64) return null
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength < 1000) return null
  return { buffer, contentType }
}

function hordeHeaders() {
  const apiKey = process.env.AI_HORDE_API_KEY?.trim() || HORDE_DEFAULT_KEY
  const clientAgent = process.env.AI_HORDE_CLIENT_AGENT?.trim() || HORDE_DEFAULT_AGENT
  return {
    apikey: apiKey,
    'Client-Agent': clientAgent,
    'Content-Type': 'application/json',
  }
}

async function fetchAIHordeImage(prompt: string, width: number, height: number, seed: number) {
  const headers = hordeHeaders()
  const payload = {
    prompt,
    params: {
      n: 1,
      width,
      height,
      steps: 20,
      cfg_scale: 7,
      seed: String(seed),
      sampler_name: 'k_euler',
    },
    nsfw: false,
    censor_nsfw: true,
  }

  let requestId: string | null = null
  try {
    const submit = await fetch(`${HORDE_BASE_URL}/generate/async`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    })
    if (!submit.ok) return null
    const submitData = await submit.json()
    requestId = submitData?.id ?? null
    if (!requestId) return null

    let finished = false
    const deadline = Date.now() + HORDE_TIMEOUT_MS
    while (Date.now() < deadline) {
      const checkRes = await fetch(`${HORDE_BASE_URL}/generate/check/${requestId}`, {
        headers,
        signal: AbortSignal.timeout(5_000),
      })
      if (checkRes.ok) {
        const check = await checkRes.json()
        const doneFlag = Boolean(check?.done)
        const finishedCount = Number(check?.finished ?? 0)
        if (doneFlag || finishedCount >= 1) {
          finished = true
          break
        }
      }
      await sleep(HORDE_POLL_INTERVAL_MS)
    }

    if (!finished) {
      await fetch(`${HORDE_BASE_URL}/generate/status/${requestId}`, {
        method: 'DELETE',
        headers,
      }).catch(() => null)
      return null
    }

    const statusRes = await fetch(`${HORDE_BASE_URL}/generate/status/${requestId}`, {
      headers,
      signal: AbortSignal.timeout(8_000),
    })
    if (!statusRes.ok) return null
    const statusData = await statusRes.json()
    const generation = statusData?.generations?.[0]
    const raw = generation?.img || generation?.image || generation?.base64 || generation?.img_base64
    if (!raw) return null

    if (typeof raw === 'string' && raw.startsWith('http')) {
      return fetchBinaryImage(raw, 12_000)
    }

    if (typeof raw === 'string' && raw.startsWith('data:')) {
      const decoded = decodeDataUrl(raw)
      if (!decoded) return null
      return new Response(decoded.buffer, {
        status: 200,
        headers: {
          'Content-Type': decoded.contentType,
        },
      })
    }

    if (typeof raw === 'string') {
      const buffer = Buffer.from(raw, 'base64')
      if (buffer.byteLength < 1000) return null
      const contentType = generation?.mime_type || generation?.content_type || 'image/webp'
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
        },
      })
    }

    return null
  } catch {
    if (requestId) {
      await fetch(`${HORDE_BASE_URL}/generate/status/${requestId}`, {
        method: 'DELETE',
        headers,
      }).catch(() => null)
    }
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

  const pollinationsSize = normalizeSize(width, height)
  const hordeSize = normalizeSize(width, height, 512)

  const pollinationsTask = fetchPollinationsImage(prompt, pollinationsSize.width, pollinationsSize.height, seed)
    .then((res) => {
      if (!res) throw new Error('pollinations_failed')
      return res
    })

  const hordeTask = fetchAIHordeImage(prompt, hordeSize.width, hordeSize.height, seed)
    .then((res) => {
      if (!res) throw new Error('aihorde_failed')
      return res
    })

  let res: Response | null = null
  try {
    res = await Promise.any([hordeTask, pollinationsTask])
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
