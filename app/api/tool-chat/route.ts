/**
 * Tool Chat API — no auth required.
 * Priority order:
 *   1. Google AI Studio (GOOGLE_API_KEY) — free, works globally
 *   2. Groq (GROQ_API_KEY) — free, fast
 *   3. OpenRouter free models (OPENROUTER_API_KEY) — shared limits
 */
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SKIPPABLE_CODES = [429, 404, 402, 500, 503]
const SKIPPABLE_TEXTS = ['rate-limit', 'rate_limit', 'No endpoints found', 'spend limit', 'Provider returned error', 'temporarily rate-limited', 'RESOURCE_EXHAUSTED']

function shouldSkip(status: number, text: string) {
  return SKIPPABLE_CODES.includes(status) || SKIPPABLE_TEXTS.some(s => text.includes(s))
}

function makeSSEStream(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const data = trimmed.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            } catch {}
          }
        }
      } catch (err) { controller.error(err) }
      finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

async function tryProvider(url: string, headers: Record<string, string>, body: object, stream: boolean) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    return { skip: shouldSkip(res.status, text), error: `${res.status}: ${text.slice(0, 200)}`, res: null }
  }

  if (!stream) {
    const data = await res.json()
    return { skip: false, content: data.choices?.[0]?.message?.content || '', res: null }
  }

  return { skip: false, res }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { messages, model, systemPrompt, stream = true } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  const googleKeys = [process.env.GOOGLE_API_KEY, process.env.GOOGLE_API_KEY_2, process.env.GOOGLE_API_KEY_3].filter(Boolean) as string[]
  const groqKey    = process.env.GROQ_API_KEY || ''
  const mistralKey = process.env.MISTRAL_API_KEY || ''
  const orKey      = process.env.OPENROUTER_API_KEY || ''

  if (!googleKeys.length && !groqKey && !mistralKey && !orKey) {
    return Response.json({ error: 'No AI API key configured.' }, { status: 500 })
  }

  const allMessages = [
    { role: 'system', content: systemPrompt || 'You are a helpful AI assistant. Be concise, accurate, and friendly.' },
    ...messages,
  ]

  // ── 1. GOOGLE AI STUDIO (all 3 keys, fast-fail on 429) ───────────
  if (googleKeys.length && !model?.includes('/')) {
    const gmModel = (!model || model === 'gemini-2.5-flash') ? 'gemini-2.0-flash' : model
    for (const gKey of googleKeys) {
      try {
        const result = await tryProvider(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          { Authorization: `Bearer ${gKey}` },
          { model: gmModel, messages: allMessages, stream, max_tokens: 4096 },
          stream
        )
        if (result.skip) continue
        if (result.content !== undefined) return Response.json({ content: result.content })
        if (result.res) return new Response(makeSSEStream(result.res), {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Model': gmModel },
        })
      } catch { continue }
    }
  }

  // ── 2. GROQ ────────────────────────────────────────────────────────
  if (groqKey && !model?.includes('/')) {
    const groqModels = model ? [model] : [
      'llama-3.3-70b-versatile',
      'gemma2-9b-it',
      'llama3-8b-8192',
    ]
    for (const gModel of groqModels) {
      try {
        const result = await tryProvider(
          'https://api.groq.com/openai/v1/chat/completions',
          { 'Authorization': `Bearer ${groqKey}` },
          { model: gModel, messages: allMessages, stream, max_tokens: 4096 },
          stream
        )
        if (result.skip) continue
        if (result.content !== undefined) return Response.json({ content: result.content })
        if (result.res) return new Response(makeSSEStream(result.res), {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Model': gModel },
        })
      } catch { continue }
    }
  }


  // ── 3. MISTRAL AI — confirmed working ─────────────────────────────
  if (mistralKey) {
    for (const mModel of ['mistral-small-latest', 'open-mistral-nemo']) {
      try {
        const result = await tryProvider(
          'https://api.mistral.ai/v1/chat/completions',
          { Authorization: `Bearer ${mistralKey}` },
          { model: mModel, messages: allMessages, stream, max_tokens: 4096 },
          stream
        )
        if (result.skip) continue
        if (result.content !== undefined) return Response.json({ content: result.content })
        if (result.res) return new Response(makeSSEStream(result.res), {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Model': mModel },
        })
      } catch { continue }
    }
  }

  // ── 4. OPENROUTER ──────────────────────────────────────────────────
  if (orKey) {
    const orModels = model ? [model] : [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
      'google/gemma-3-12b-it:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'qwen/qwen3-4b:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ]
    for (const orModel of orModels) {
      try {
        const result = await tryProvider(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Pyxis AI Hub',
          },
          { model: orModel, messages: allMessages, stream, max_tokens: 4096 },
          stream
        )
        if (result.skip) continue
        if (result.content !== undefined) return Response.json({ content: result.content })
        if (result.res) return new Response(makeSSEStream(result.res), {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Model': orModel },
        })
      } catch { continue }
    }
  }

  return Response.json({
    error: 'All AI providers are currently rate-limited. Please try again in a moment.'
  }, { status: 503 })
}
