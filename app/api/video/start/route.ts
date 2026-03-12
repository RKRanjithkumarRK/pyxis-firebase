import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 25
export const dynamic = 'force-dynamic'

/**
 * Server-side proxy to join a HuggingFace Gradio space queue.
 * Browser calls → our server → HF Gradio (no CORS/Origin header → 403 bypassed).
 */

interface SpaceDef {
  name: string
  url: string
  fnIndex: number
  inputs: (prompt: string, imageData?: string) => unknown[]
}

const T2V_SPACES: SpaceDef[] = [
  {
    name: 'AnimateDiff',
    url: 'https://guoyww-animatediff.hf.space',
    fnIndex: 0,
    inputs: (p) => [p, '', 7.5, -1, 25, 16],
  },
  {
    name: 'ZeroScope V2',
    url: 'https://hysts-zeroscope-v2.hf.space',
    fnIndex: 0,
    inputs: (p) => [p, '', 0, 576, 320, 8, 7.5, 25, 1],
  },
  {
    name: 'CogVideoX-2B',
    url: 'https://thudm-cogvideox-2b.hf.space',
    fnIndex: 0,
    inputs: (p) => [p, 42, 49, 8, 6.0, 50],
  },
  {
    name: 'ModelScope T2V',
    url: 'https://damo-vilab-modelscope-text-to-video-synthesis.hf.space',
    fnIndex: 0,
    inputs: (p) => [p, 50, 7.5, 512, 320, 16],
  },
]

const I2V_SPACES: SpaceDef[] = [
  {
    name: 'Stable Video Diffusion',
    url: 'https://stabilityai-stable-video-diffusion.hf.space',
    fnIndex: 0,
    inputs: (_, img) => [img, 25, 4.0, 127, 1],
  },
  {
    name: 'SVD-XT',
    url: 'https://multimodalart-stable-video-diffusion.hf.space',
    fnIndex: 0,
    inputs: (_, img) => [img, 25, 4.0, 127],
  },
  {
    // Fallback: AnimateDiff accepts image conditioning in some versions
    name: 'AnimateDiff',
    url: 'https://guoyww-animatediff.hf.space',
    fnIndex: 0,
    inputs: (p) => [p || 'smooth motion, cinematic', '', 7.5, -1, 25, 16],
  },
]

export async function POST(req: NextRequest) {
  let body: { prompt?: string; mode?: string; imageData?: string }
  try { body = await req.json() } catch { body = {} }

  const { prompt = '', mode = 'txt2vid', imageData } = body
  const spaces = mode === 'img2vid' ? I2V_SPACES : T2V_SPACES

  for (const space of spaces) {
    try {
      const sessionHash = Math.random().toString(36).slice(2, 12)
      const inputs = space.inputs(prompt, imageData)

      const joinRes = await fetch(`${space.url}/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: inputs,
          fn_index: space.fnIndex,
          session_hash: sessionHash,
          event_data: null,
        }),
        signal: AbortSignal.timeout(12_000),
      })

      if (joinRes.ok) {
        console.log(`[video/start] joined ${space.name} with session ${sessionHash}`)
        return NextResponse.json({
          ok: true,
          sessionHash,
          spaceUrl: space.url,
          spaceName: space.name,
        })
      }

      const errText = await joinRes.text().catch(() => '')
      console.warn(`[video/start] ${space.name} join ${joinRes.status}: ${errText.slice(0, 120)}`)
    } catch (e: any) {
      console.warn(`[video/start] ${space.name} threw: ${e.message}`)
    }
  }

  return NextResponse.json(
    { ok: false, error: 'All AI servers are currently busy. Please try again in a few minutes.' },
    { status: 503 },
  )
}
