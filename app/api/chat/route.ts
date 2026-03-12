import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'
import { getModel } from '@/lib/models'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROVIDER_TIMEOUT_MS = 22000
const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

function isGeminiModel(modelId?: string) {
  return !modelId || modelId.startsWith('gemini-') || modelId === 'openrouter/free'
}

function transformToSSE(response: Response): ReadableStream {
  if (!response.body) {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
  }

  const reader = response.body.getReader()
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
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            } catch {}
          }
        }
      } catch (error) {
        controller.error(error)
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })
}

type ProviderResult = { res: Response | null; status: number }

async function callProvider(url: string, headers: Record<string, string>, body: object): Promise<ProviderResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  const providerHost = new URL(url).host

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.text()
      console.warn(`[chat] ${providerHost} error ${res.status}:`, err.slice(0, 120))
      return { res: null, status: res.status }
    }

    return { res, status: res.status }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn(`[chat] ${providerHost} timed out after ${PROVIDER_TIMEOUT_MS}ms`)
      return { res: null, status: 0 }
    }

    console.warn(`[chat] ${providerHost} threw:`, error)
    return { res: null, status: 0 }
  } finally {
    clearTimeout(timeout)
  }
}

function sseResponse(res: Response, model: string) {
  return new Response(transformToSSE(res), {
    headers: { ...STREAM_HEADERS, 'X-Model': model },
  })
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, model } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  const [profileSnap, keySnap] = await Promise.all([
    adminDb.doc(`users/${user.uid}/settings/personalization`).get(),
    adminDb.doc(`users/${user.uid}/private/apikeys`).get(),
  ])

  const customInstructions = profileSnap.exists ? profileSnap.data()?.customInstructions || '' : ''
  const systemPrompt =
    customInstructions ||
    'You are Pyxis, a helpful AI assistant. Be concise, clear, and friendly. ' +
      'When writing code responses: use fenced code blocks (``` with language tag) for multi-line code. ' +
      'Use inline backticks (`variable`) for single variable names, keywords, or short expressions - never wrap a single word in a fenced block. ' +
      'Always specify the language in fenced code blocks (for example: ```python, ```javascript, ```java).'

  const userKeys = keySnap.exists ? keySnap.data() || {} : {}
  const googleKeys = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_2,
    process.env.GOOGLE_API_KEY_3,
  ].filter(Boolean) as string[]
  const togetherKey = process.env.TOGETHER_API_KEY || ''
  const mistralKey = process.env.MISTRAL_API_KEY || ''
  const groqKey = process.env.GROQ_API_KEY || ''
  const orKey = userKeys.openrouter || process.env.OPENROUTER_API_KEY || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const modelDef = getModel(model)
  const maxTokens = modelDef?.maxTokens ?? 4096
  const allMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  // 1. GOOGLE AI STUDIO
  if (googleKeys.length > 0 && isGeminiModel(model) && process.env.DISABLE_GOOGLE !== 'true') {
    const requested = model === 'openrouter/free' || !model ? 'gemini-2.5-flash' : model
    const candidates = [...new Set([requested, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'])]

    let allKeysQuotaExhausted = true
    for (const googleKey of googleKeys) {
      const firstAttempt = await callProvider(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        { Authorization: `Bearer ${googleKey}` },
        { model: candidates[0], messages: allMessages, stream: true, max_tokens: maxTokens }
      )

      if (firstAttempt.res) return sseResponse(firstAttempt.res, candidates[0])

      if (firstAttempt.status !== 429) {
        allKeysQuotaExhausted = false
        for (const googleModel of candidates.slice(1)) {
          const retryAttempt = await callProvider(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            { Authorization: `Bearer ${googleKey}` },
            { model: googleModel, messages: allMessages, stream: true, max_tokens: maxTokens }
          )
          if (retryAttempt.res) return sseResponse(retryAttempt.res, googleModel)
        }
      }
    }

    if (allKeysQuotaExhausted) {
      console.warn('[chat] All Google keys quota exhausted - falling through to other providers')
    }
  }

  // 2. TOGETHER AI
  if (togetherKey) {
    const togetherModels = [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ]

    for (const togetherModel of togetherModels) {
      const result = await callProvider(
        'https://api.together.xyz/v1/chat/completions',
        { Authorization: `Bearer ${togetherKey}` },
        { model: togetherModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (result.res) return sseResponse(result.res, togetherModel)
    }
  }

  // 3. MISTRAL AI
  if (mistralKey) {
    for (const mistralModel of ['mistral-small-latest', 'open-mistral-nemo']) {
      const result = await callProvider(
        'https://api.mistral.ai/v1/chat/completions',
        { Authorization: `Bearer ${mistralKey}` },
        { model: mistralModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (result.res) return sseResponse(result.res, mistralModel)
    }
  }

  // 4. GROQ
  if (groqKey) {
    for (const groqModel of ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'gemma2-9b-it']) {
      const result = await callProvider(
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${groqKey}` },
        { model: groqModel, messages: allMessages, stream: true, max_tokens: Math.min(maxTokens, 8192) }
      )
      if (result.res) return sseResponse(result.res, groqModel)
    }
  }

  // 5. OPENROUTER
  if (orKey) {
    const openRouterModels = isGeminiModel(model)
      ? ['google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free']
      : [model]

    for (const openRouterModel of openRouterModels.filter(Boolean)) {
      const result = await callProvider(
        'https://openrouter.ai/api/v1/chat/completions',
        { Authorization: `Bearer ${orKey}`, 'HTTP-Referer': appUrl, 'X-Title': 'Pyxis' },
        { model: openRouterModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (result.res) return sseResponse(result.res, openRouterModel)
    }
  }

  // 6. GOOGLE FALLBACK for non-Gemini models
  if (googleKeys.length > 0 && !isGeminiModel(model) && process.env.DISABLE_GOOGLE !== 'true') {
    for (const googleKey of googleKeys) {
      for (const googleModel of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
        const result = await callProvider(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          { Authorization: `Bearer ${googleKey}` },
          { model: googleModel, messages: allMessages, stream: true, max_tokens: maxTokens }
        )
        if (result.res) return sseResponse(result.res, googleModel)
      }
    }
  }

  return new Response(
    JSON.stringify({ error: 'All AI providers failed. Please try again in a moment.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}
