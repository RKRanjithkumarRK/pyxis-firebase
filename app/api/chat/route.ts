/**
 * Chat proxy — forwards requests to the HuggingFace backend which has
 * all AI provider keys and the full 8-level fallback chain.
 *
 * Request format from frontend: { messages: [{role, content}], model, conversationId? }
 * HF backend format:            { message, history, model, conversationId? }
 */
import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HF_BACKEND = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages = [], model, conversationId } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  // Transform from OpenAI-style messages array → HF backend format
  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  }))
  const lastMsg = messages[messages.length - 1]
  const message = lastMsg?.content || ''

  const token = req.headers.get('authorization') || ''

  try {
    const upstream = await fetch(`${HF_BACKEND}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        message,
        history,
        model: model || 'gemini-2.5-flash',
        conversationId: conversationId || undefined,
      }),
      // @ts-ignore — Next.js Edge-compatible fetch
      duplex: 'half',
    })

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => 'upstream error')
      console.error('[chat-proxy] HF backend error:', upstream.status, err.slice(0, 200))
      return Response.json({ error: 'AI service unavailable' }, { status: upstream.status })
    }

    // Pass the SSE stream directly to the client
    return new Response(upstream.body, { headers: STREAM_HEADERS })
  } catch (err: any) {
    console.error('[chat-proxy] fetch error:', err?.message)
    return Response.json({ error: 'Failed to reach AI service' }, { status: 503 })
  }
}
