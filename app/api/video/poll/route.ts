import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 25
export const dynamic = 'force-dynamic'

/**
 * GET /api/video/poll?sessionHash=xxx&spaceUrl=https://...
 *
 * Server-side proxy: connects to HF Gradio SSE queue, reads events for up to 10s,
 * returns current generation status. Browser polls this every 8s.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionHash = searchParams.get('sessionHash')
  const spaceUrl    = searchParams.get('spaceUrl')

  if (!sessionHash || !spaceUrl) {
    return NextResponse.json({ status: 'failed', error: 'Missing params' })
  }

  try {
    const sseUrl = `${spaceUrl}/queue/data?session_hash=${sessionHash}`
    const res = await fetch(sseUrl, {
      headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(22_000),
    })

    if (!res.ok) {
      return NextResponse.json({
        status: 'failed',
        error: `SSE connect failed: ${res.status}`,
      })
    }

    const reader  = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastStatus: Record<string, unknown> = { status: 'queued', pct: 2, message: 'Waiting in queue…' }
    let readComplete = false

    // Cap reading at 10 seconds then return whatever state we have
    const cutoff = setTimeout(() => {
      readComplete = true
      reader.cancel().catch(() => {})
    }, 10_000)

    try {
      while (!readComplete) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const eventStr of events) {
          const dataMatch = eventStr.match(/^data: (.+)$/m)
          if (!dataMatch) continue

          let msg: any
          try { msg = JSON.parse(dataMatch[1]) } catch { continue }

          switch (msg.msg) {
            case 'queue_full':
              clearTimeout(cutoff)
              reader.cancel().catch(() => {})
              return NextResponse.json({ status: 'failed', error: 'Server queue is full — try again in a moment' })

            case 'estimation': {
              const eta = Math.ceil((msg.rank_eta ?? 60) as number)
              lastStatus = {
                status: 'queued',
                pct: 3,
                message: `Queue: position ${msg.rank ?? '?'} · ~${eta}s wait`,
              }
              break
            }

            case 'process_starts':
              lastStatus = { status: 'generating', pct: 8, message: 'AI is generating your video…' }
              break

            case 'process_generating': {
              const pd = msg.progress_data?.[0]
              if (pd?.length) {
                const p = Math.round((pd.index / pd.length) * 80) + 10
                lastStatus = {
                  status: 'generating',
                  pct: p,
                  message: `Generating frame ${pd.index} / ${pd.length}…`,
                }
              } else {
                lastStatus = { status: 'generating', pct: 50, message: 'Generating video frames…' }
              }
              break
            }

            case 'process_completed': {
              clearTimeout(cutoff)
              reader.cancel().catch(() => {})

              if (!msg.success || msg.output?.error) {
                return NextResponse.json({
                  status: 'failed',
                  error: String(msg.output?.error ?? 'Generation failed — try again'),
                })
              }

              // --- Extract video URL (Gradio outputs several possible shapes) ---
              const out = msg.output?.data?.[0]
              let videoUrl: string | null = null

              if (typeof out === 'string') {
                videoUrl = out.startsWith('http') ? out : `${spaceUrl}${out}`
              } else if (out?.url) {
                const u = String(out.url)
                videoUrl = u.startsWith('http') ? u : `${spaceUrl}${u}`
              } else if (out?.name || out?.path) {
                const p2 = String(out.name ?? out.path)
                videoUrl = p2.startsWith('http') ? p2 : `${spaceUrl}/file=${p2}`
              } else if (out?.value?.url) {
                const u = String(out.value.url)
                videoUrl = u.startsWith('http') ? u : `${spaceUrl}${u}`
              }

              if (!videoUrl) {
                return NextResponse.json({
                  status: 'failed',
                  error: `Could not extract video URL from response: ${JSON.stringify(out).slice(0, 150)}`,
                })
              }

              // --- Download and proxy as base64 (avoids browser CORS on HF file URLs) ---
              const vidRes = await fetch(videoUrl, { signal: AbortSignal.timeout(12_000) })
              if (!vidRes.ok) {
                return NextResponse.json({ status: 'failed', error: `Video download failed: ${vidRes.status}` })
              }
              const arrayBuf = await vidRes.arrayBuffer()
              if (arrayBuf.byteLength < 500) {
                return NextResponse.json({ status: 'failed', error: 'Received empty video file — try again' })
              }

              const base64 = Buffer.from(arrayBuf).toString('base64')
              const ct     = vidRes.headers.get('content-type') || 'video/mp4'
              const mime   = ct.split(';')[0].trim()

              return NextResponse.json({
                status: 'completed',
                pct: 100,
                message: 'Done!',
                videoData: `data:${mime};base64,${base64}`,
              })
            }
          }
        }
      }
    } finally {
      clearTimeout(cutoff)
      reader.cancel().catch(() => {})
    }

    // Timed out reading — return last seen status (browser will poll again)
    return NextResponse.json(lastStatus)
  } catch (e: any) {
    if (e.name === 'AbortError' || e.message?.includes('abort')) {
      return NextResponse.json({ status: 'queued', pct: 1, message: 'Connecting to AI server…' })
    }
    console.error('[video/poll] error:', e.message)
    return NextResponse.json({ status: 'failed', error: `Server error: ${e.message}` })
  }
}
