import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'
import { getModel } from '@/lib/models'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

function isGeminiModel(modelId: string) {
  return modelId.startsWith('gemini-') || modelId === 'openrouter/free'
}

function transformToSSE(response: Response): ReadableStream {
  const reader  = response.body!.getReader()
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

type ProviderResult = { res: Response | null; status: number }

async function callProvider(url: string, headers: Record<string, string>, body: object): Promise<ProviderResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      console.warn(`[chat] ${url.split('/')[2]} error ${res.status}:`, err.slice(0, 120))
      return { res: null, status: res.status }
    }
    return { res, status: res.status }
  } catch (err) {
    console.warn(`[chat] ${url.split('/')[2]} threw:`, err)
    return { res: null, status: 0 }
  }
}

function sseResponse(res: Response, model: string) {
  return new Response(transformToSSE(res), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Model': model },
  })
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages, model } = await req.json()

  const [profileSnap, keySnap] = await Promise.all([
    adminDb.doc(`users/${user.uid}/settings/personalization`).get(),
    adminDb.doc(`users/${user.uid}/private/apikeys`).get(),
  ])

  const customInstructions = profileSnap.exists ? profileSnap.data()?.customInstructions || '' : ''
  const systemPrompt = customInstructions ||
    'You are Pyxis, a helpful AI assistant. Be concise, clear, and friendly. ' +
    'When writing code responses: use fenced code blocks (``` with language tag) for multi-line code. ' +
    'Use inline backticks (`variable`) for single variable names, keywords, or short expressions — never wrap a single word in a fenced block. ' +
    'Always specify the language in fenced code blocks (e.g., ```python, ```javascript, ```java).'

  const userKeys = keySnap.exists ? keySnap.data() || {} : {}

  // All keys — add multiple Google keys to rotate when one hits quota
  const googleKeys = [
    process.env.GOOGLE_API_KEY,
    process.env.GOOGLE_API_KEY_2,
    process.env.GOOGLE_API_KEY_3,
  ].filter(Boolean) as string[]

  const togetherKey = process.env.TOGETHER_API_KEY || ''
  const mistralKey  = process.env.MISTRAL_API_KEY  || ''
  const groqKey     = process.env.GROQ_API_KEY     || ''
  const orKey       = userKeys.openrouter || process.env.OPENROUTER_API_KEY || ''
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const modelDef  = getModel(model)
  const maxTokens = modelDef?.maxTokens ?? 4096

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  /* ── 1. GOOGLE AI STUDIO — skip entirely if DISABLE_GOOGLE=true or quota exhausted ── */
  if (googleKeys.length > 0 && isGeminiModel(model) && process.env.DISABLE_GOOGLE !== 'true') {
    const requested  = (model === 'openrouter/free' || !model) ? 'gemini-2.5-flash' : model
    const candidates = [...new Set([requested, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'])]

    let allKeysQuotaExhausted = true
    for (const gKey of googleKeys) {
      // Try first model with this key — if 429, skip remaining models (key is exhausted)
      const { res, status } = await callProvider(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        { Authorization: `Bearer ${gKey}` },
        { model: candidates[0], messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (res) return sseResponse(res, candidates[0])
      if (status !== 429) {
        // Non-quota error (e.g. 400/500) — try remaining models for this key
        allKeysQuotaExhausted = false
        for (const gModel of candidates.slice(1)) {
          const { res: r2 } = await callProvider(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            { Authorization: `Bearer ${gKey}` },
            { model: gModel, messages: allMessages, stream: true, max_tokens: maxTokens }
          )
          if (r2) return sseResponse(r2, gModel)
        }
      }
      // 429 on this key → immediately try next key
    }
    if (allKeysQuotaExhausted) {
      console.warn('[chat] All Google keys quota exhausted — falling through to other providers')
    }
  }

  /* ── 2. TOGETHER AI — free $5 credit, works in India ── */
  if (togetherKey) {
    const togetherModels = [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
    ]
    for (const tModel of togetherModels) {
      const { res } = await callProvider(
        'https://api.together.xyz/v1/chat/completions',
        { Authorization: `Bearer ${togetherKey}` },
        { model: tModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (res) return sseResponse(res, tModel)
    }
  }

  /* ── 3. MISTRAL AI — free tier, works in India ── */
  if (mistralKey) {
    const mistralModels = ['mistral-small-latest', 'open-mistral-nemo']
    for (const mModel of mistralModels) {
      const { res } = await callProvider(
        'https://api.mistral.ai/v1/chat/completions',
        { Authorization: `Bearer ${mistralKey}` },
        { model: mModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (res) return sseResponse(res, mModel)
    }
  }

  /* ── 4. GROQ — if accessible ── */
  if (groqKey) {
    const groqModels = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'gemma2-9b-it']
    for (const gModel of groqModels) {
      const { res } = await callProvider(
        'https://api.groq.com/openai/v1/chat/completions',
        { Authorization: `Bearer ${groqKey}` },
        { model: gModel, messages: allMessages, stream: true, max_tokens: Math.min(maxTokens, 8192) }
      )
      if (res) return sseResponse(res, gModel)
    }
  }

  /* ── 5. OPENROUTER — premium models or free OR models as last resort ── */
  if (orKey) {
    const orModels = isGeminiModel(model)
      ? ['google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free']
      : [model]
    for (const orModel of orModels) {
      const { res } = await callProvider(
        'https://openrouter.ai/api/v1/chat/completions',
        { Authorization: `Bearer ${orKey}`, 'HTTP-Referer': appUrl, 'X-Title': 'Pyxis' },
        { model: orModel, messages: allMessages, stream: true, max_tokens: maxTokens }
      )
      if (res) return sseResponse(res, orModel)
    }
  }

  /* ── 6. GOOGLE FALLBACK for non-Gemini models (no OR key) ── */
  if (googleKeys.length > 0 && !isGeminiModel(model) && process.env.DISABLE_GOOGLE !== 'true') {
    for (const gKey of googleKeys) {
      for (const gModel of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
        const { res } = await callProvider(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          { Authorization: `Bearer ${gKey}` },
          { model: gModel, messages: allMessages, stream: true, max_tokens: maxTokens }
        )
        if (res) return sseResponse(res, gModel)
      }
    }
  }

  return new Response(
    JSON.stringify({ error: 'All AI providers failed. Please try again in a moment.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}
