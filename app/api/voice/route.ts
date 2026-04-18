/**
 * Voice proxy — forwards requests to the HuggingFace backend which has
 * all AI provider keys and the full fallback chain.
 *
 * HF backend voice returns: { reply, searched } (non-streaming JSON)
 */
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const HF_BACKEND = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, systemPrompt } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  const token = req.headers.get('authorization') || ''

  // HF backend voice expects: { message: string }
  // Pull the last user message as the "message" field
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content || ''

  try {
    const upstream = await fetch(`${HF_BACKEND}/api/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ message: lastUserMsg }),
    })

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => 'upstream error')
      console.error('[voice-proxy] HF backend error:', upstream.status, err.slice(0, 200))
      return Response.json({ error: 'Voice AI service unavailable' }, { status: upstream.status })
    }

    // The HF voice endpoint streams SSE — collect all tokens and return as JSON
    // so the frontend can use the existing reply pattern
    const contentType = upstream.headers.get('content-type') || ''

    if (contentType.includes('text/event-stream')) {
      // Collect streamed tokens into a single reply
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) reply += parsed.content
          } catch {}
        }
      }
      return Response.json({ reply: reply.trim(), searched: false })
    }

    // Non-streaming JSON response from HF backend
    const data = await upstream.json()
    return Response.json(data)
  } catch (err: any) {
    console.error('[voice-proxy] fetch error:', err?.message)
    return Response.json({ error: 'Failed to reach voice AI service' }, { status: 503 })
  }
}
