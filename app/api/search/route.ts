import { NextRequest } from 'next/server'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const SEARCH_TIMEOUT_MS = 8000

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

type SearchResult = { title: string; snippet: string; url: string }

async function fetchDuckDuckGoHtml(query: string) {
  const res = await fetchWithTimeout(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }
  )

  if (!res.ok) {
    throw new Error(`Search provider returned ${res.status}`)
  }

  const html = await res.text()
  const results: SearchResult[] = []
  const blocks = html.split('result__body')

  for (const block of blocks.slice(1, 12)) {
    if (block.includes('result--ad') || block.includes('sponsored')) continue

    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</)
    const hrefMatch = block.match(/uddg=([^&"]+)/)
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+(?:<b>[^<]*<\/b>[^<]*)*)/)

    if (!titleMatch) continue

    const title = titleMatch[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim()
    const url = hrefMatch ? decodeURIComponent(hrefMatch[1]) : ''
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/&amp;/g, '&').trim()
      : ''

    if (title && url && !url.startsWith('https://duckduckgo.com/y.js')) {
      results.push({ title, snippet, url })
    }
  }

  return results.slice(0, 6)
}

function appendFallbackResults(items: SearchResult[], title: string, snippet: string, url: string) {
  if (!title || !url) return
  if (items.some((item) => item.url === url || item.title === title)) return
  items.push({ title, snippet, url })
}

function collectRelatedTopics(topics: any[], items: SearchResult[]) {
  for (const topic of topics || []) {
    if (items.length >= 6) return

    if (Array.isArray(topic?.Topics)) {
      collectRelatedTopics(topic.Topics, items)
      continue
    }

    appendFallbackResults(items, topic?.Text || '', topic?.Text || '', topic?.FirstURL || '')
  }
}

async function fetchDuckDuckGoInstantResults(query: string) {
  const res = await fetchWithTimeout(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  )

  if (!res.ok) {
    throw new Error(`Instant answer provider returned ${res.status}`)
  }

  const data = await res.json()
  const results: SearchResult[] = []

  appendFallbackResults(
    results,
    data?.Heading || query,
    data?.AbstractText || data?.Answer || `Instant answer results for ${query}.`,
    data?.AbstractURL || data?.AnswerURL || ''
  )

  collectRelatedTopics(data?.RelatedTopics || [], results)

  return results.slice(0, 6)
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || ''
  if (!query) return Response.json({ results: [], answer: '' })

  try {
    try {
      const results = await fetchDuckDuckGoHtml(query)
      if (results.length > 0) {
        return Response.json({ results, answer: '' })
      }
    } catch {}

    const fallbackResults = await fetchDuckDuckGoInstantResults(query)
    return Response.json({ results: fallbackResults, answer: '' })
  } catch (err: any) {
    return Response.json({ results: [], answer: '', error: err.message })
  }
}
