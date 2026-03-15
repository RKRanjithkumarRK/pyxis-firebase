import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 55

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  // Only allow exact hostnames or verified subdomain suffixes (prevent SSRF bypass)
  const exactHosts = new Set([
    'image.pollinations.ai',
    'cdn.openai.com',
    'stablehorde.net',
    'picsum.photos',
    'fastly.picsum.photos',
  ])
  // Azure blob storage uses subdomains like <account>.blob.core.windows.net
  const allowedSuffixes = ['.blob.core.windows.net']

  let hostname = ''
  try {
    hostname = new URL(url).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const isAllowed =
    exactHosts.has(hostname) ||
    allowedSuffixes.some(suffix => hostname.endsWith(suffix) && hostname !== suffix)

  if (!isAllowed) {
    return NextResponse.json({ error: 'Disallowed host' }, { status: 403 })
  }

  try {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 50000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Pyxis/1.0)' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`Upstream error ${res.status}`)

    const contentType = res.headers.get('content-type') || 'image/png'
    const arrayBuffer = await res.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch image' }, { status: 500 })
  }
}
