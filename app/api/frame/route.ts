import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchBinaryImage(url: string, timeoutMs = 18_000): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pyxis/1.0)' },
    })
    if (res.ok) return res
    console.warn('[frame] HTTP', res.status, url.slice(0, 80))
    return null
  } catch {
    return null
  }
}

/**
 * OpenVerse (api.openverse.org) — Automattic's open media search API.
 * Returns Creative Commons images matching the prompt. No API key required.
 * Used as fallback when Pollinations is rate-limited.
 */
async function fetchOpenVerseFallback(prompt: string, idx: number): Promise<Response | null> {
  try {
    // Strip cinematic suffixes — search for the core concept only
    const corePrompt = prompt.split(',')[0].trim()
    const search = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(corePrompt)}&page_size=20&license_type=commercial`,
      { signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'Pyxis/1.0' } }
    )
    if (!search.ok) {
      console.warn('[frame] OpenVerse returned', search.status)
      return null
    }
    const data = await search.json()
    const results: Array<{ url: string }> = data?.results ?? []
    if (!results.length) return null

    // Spread across results so each frame gets a different image
    const picked = results[(idx * 3 + 1) % Math.min(results.length, 20)]
    if (!picked?.url) return null

    return fetchBinaryImage(picked.url, 12_000)
  } catch (e: any) {
    console.warn('[frame] OpenVerse error:', e.message)
    return null
  }
}

/**
 * GET /api/frame?prompt=...&seed=...&idx=0-4
 *
 * Priority:
 *   1. Pollinations AI  — freshly generated AI image (free, no key)
 *   2. OpenVerse        — Creative Commons images matching prompt (free, no key)
 *
 * Picsum is NOT used — it returns random photos that don't match the prompt.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prompt = searchParams.get('prompt')?.trim()
  const seed   = parseInt(searchParams.get('seed') || '0', 10) || Date.now()
  const idx    = parseInt(searchParams.get('idx') || '0', 10)

  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })

  // Stagger concurrent requests to avoid Pollinations 429
  if (idx > 0) await sleep(idx * 800)

  // ── 1. Pollinations AI (freshly generated, exact prompt match) ────────────
  const pollinationsUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?seed=${seed}&width=512&height=288&nologo=true&model=flux`

  let res = await fetchBinaryImage(pollinationsUrl)

  // Retry once after a pause if first attempt was rate-limited
  if (!res) {
    await sleep(2500)
    res = await fetchBinaryImage(pollinationsUrl)
  }

  // ── 2. OpenVerse fallback (prompt-relevant Creative Commons photos) ────────
  if (!res) {
    console.warn('[frame] Pollinations unavailable — trying OpenVerse for:', prompt.slice(0, 60))
    res = await fetchOpenVerseFallback(prompt, idx)
  }

  if (!res) {
    return NextResponse.json(
      { error: 'Image generation temporarily unavailable. Please try again in a moment.' },
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
