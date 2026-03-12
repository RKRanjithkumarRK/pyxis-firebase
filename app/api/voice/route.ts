import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SEARCH_TIMEOUT_MS = 4000
const SEARCH_TRIGGERS = [
  'today', 'tonight', 'yesterday', 'right now', 'happening',
  'latest', 'recent', 'just happened', 'breaking', 'news',
  'current', 'this week', 'this month', 'this year',
  'weather', 'temperature', 'forecast', 'humidity', 'rain',
  'score', 'result', 'who won', 'winner', 'match', 'game', 'tournament', 'championship', 'league',
  'stock', 'price', 'market', 'crypto', 'bitcoin', 'share price', 'inflation', 'economy',
  'released', 'launched', 'announced', 'new version', 'update', 'feature',
  '2024', '2025', '2026', '2027',
  'who is', 'what is', 'tell me about', 'explain', 'definition',
  'how many', 'how much', 'when was', 'when did', 'where is',
  'population', 'capital of', 'president', 'prime minister', 'ceo',
  'history of', 'facts about', 'information about',
]

function needsSearch(text: string): boolean {
  const lower = text.toLowerCase()
  if (lower.includes('?') && lower.split(' ').length > 4) return true
  return SEARCH_TRIGGERS.some((keyword) => lower.includes(keyword))
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)

  try {
    return await fetch(input, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function searchWeb(query: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) throw new Error(`ddg-html-${res.status}`)

    const html = await res.text()
    const items: string[] = []
    const blocks = html.split('result__body')

    for (const block of blocks.slice(1, 8)) {
      if (block.includes('result--ad') || block.includes('sponsored')) continue

      const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</)
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+(?:<b>[^<]*<\/b>[^<]*)*)/)

      if (titleMatch) {
        const title = titleMatch[1].trim()
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''
        items.push(snippet ? `• ${title}: ${snippet}` : `• ${title}`)
      }

      if (items.length >= 4) break
    }

    if (items.length > 0) {
      return `[Live web results]\n${items.join('\n')}`
    }
  } catch {}

  try {
    const res = await fetchWithTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    )
    if (!res.ok) throw new Error(`ddg-instant-${res.status}`)

    const data = await res.json()
    const items: string[] = []

    if (data?.AbstractText) {
      items.push(`• ${data.Heading || query}: ${String(data.AbstractText).trim()}`)
    }

    for (const topic of data?.RelatedTopics || []) {
      if (items.length >= 4) break

      if (Array.isArray(topic?.Topics)) {
        for (const nested of topic.Topics) {
          if (items.length >= 4) break
          if (nested?.Text) items.push(`• ${nested.Text}`)
        }
        continue
      }

      if (topic?.Text) items.push(`• ${topic.Text}`)
    }

    if (items.length > 0) {
      return `[Live web results]\n${items.join('\n')}`
    }
  } catch {}

  try {
    const res = await fetchWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=4&origin=*`
    )
    if (!res.ok) throw new Error(`wikipedia-${res.status}`)

    const data = await res.json()
    const items = (data?.query?.search || []).slice(0, 4).map((item: any) => {
      const title = item?.title || query
      const snippet = String(item?.snippet || '').replace(/<[^>]+>/g, '').trim()
      return snippet ? `• ${title}: ${snippet}` : `• ${title}`
    })

    if (items.length > 0) {
      return `[Live web results]\n${items.join('\n')}`
    }
  } catch {}

  return ''
}

async function callAI(url: string, headers: Record<string, string>, body: object): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(18000),
    })

    if (!res.ok) return null

    const data = await res.json()
    return data?.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, systemPrompt } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required' }, { status: 400 })
  }

  const keySnap = await adminDb.doc(`users/${user.uid}/private/apikeys`).get()
  const userKeys = keySnap.exists ? keySnap.data() || {} : {}
  const orKey = userKeys.openrouter || process.env.OPENROUTER_API_KEY
  const googleKey = process.env.GOOGLE_API_KEY

  if (!orKey && !googleKey) {
    return Response.json({ error: 'No API key configured.' }, { status: 400 })
  }

  const lastUserContent =
    [...messages].reverse().find((message: any) => message.role === 'user')?.content || ''

  let webCtx = ''
  if (lastUserContent && needsSearch(lastUserContent)) {
    webCtx = await searchWeb(lastUserContent)
  }

  const baseSystemPrompt =
    systemPrompt ||
    'You are Pyxis, a friendly, confident, and knowledgeable voice AI assistant. ' +
      'Reply in 1-3 short conversational sentences. ' +
      'No markdown, bullets, headers, or lists - plain spoken language only. ' +
      'You have access to the internet and up-to-date information via web search. ' +
      'Never say you cannot access the internet or that your knowledge has a cutoff date - use web search results instead. ' +
      'If you are asked something difficult or complex, give your best answer confidently. ' +
      'Never reveal your underlying model name, provider, or that you are built on any other AI. ' +
      'You are Pyxis. Always.'

  const systemContent = webCtx
    ? `${baseSystemPrompt}\n\nYou have live web search results. Use them to give an accurate, up-to-date answer. Cite naturally in plain speech.`
    : baseSystemPrompt

  const augmentedMessages = webCtx
    ? messages.map((message: any, index: number) =>
        index === messages.length - 1 && message.role === 'user'
          ? { ...message, content: `${message.content}\n\n${webCtx}` }
          : message
      )
    : messages

  const allMessages = [{ role: 'system', content: systemContent }, ...augmentedMessages]
  const requestBody = { messages: allMessages, stream: false, max_tokens: 300 }

  if (googleKey) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash']) {
      const reply = await callAI(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        { Authorization: `Bearer ${googleKey}` },
        { model, ...requestBody }
      )
      if (reply) return Response.json({ reply, searched: !!webCtx })
    }
  }

  if (orKey) {
    for (const model of [
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
    ]) {
      const reply = await callAI(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          Authorization: `Bearer ${orKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Pyxis Voice',
        },
        { model, ...requestBody }
      )
      if (reply) return Response.json({ reply, searched: !!webCtx })
    }
  }

  return Response.json({ error: 'All AI models unavailable. Please try again.' }, { status: 503 })
}
