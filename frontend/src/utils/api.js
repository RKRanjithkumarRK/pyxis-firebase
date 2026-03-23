import { auth } from '../firebase'

// When deployed to Vercel, VITE_API_URL points to the Railway backend.
// In local dev or Railway monolith mode, this is empty (relative URLs).
const API_BASE = import.meta.env.VITE_API_URL || ''

async function getToken() {
  return auth.currentUser?.getIdToken() ?? null
}

// Model fallback chain — tried in order when rate-limited
const RATE_LIMIT_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
]

function getNextModel(currentModel) {
  const idx = RATE_LIMIT_FALLBACKS.indexOf(currentModel)
  return idx >= 0 && idx < RATE_LIMIT_FALLBACKS.length - 1
    ? RATE_LIMIT_FALLBACKS[idx + 1]
    : null
}

/**
 * Authenticated fetch with auto-retry on 429 rate limits.
 * Retries up to `maxRetries` times with exponential back-off.
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastErr
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(API_BASE + url, options)
      if (res.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
        const delay = Math.min(retryAfter * 1000, (attempt + 1) * 4000)
        await new Promise(r => setTimeout(r, delay))
        // Need a fresh token for retry
        const freshToken = await getToken()
        if (freshToken && options.headers) {
          options = { ...options, headers: { ...options.headers, Authorization: `Bearer ${freshToken}` } }
        }
        continue
      }
      return res
    } catch (err) {
      lastErr = err
      if (err.name === 'AbortError') throw err
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, (attempt + 1) * 1000))
    }
  }
  throw lastErr || new Error('Request failed after retries')
}

/** Authenticated fetch. Throws on non-2xx. */
export async function apiFetch(url, options = {}) {
  const token = await getToken()
  const isFormData = options.body instanceof FormData
  const headers = { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetchWithRetry(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).detail || text } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res
}

/** Authenticated JSON fetch. */
export async function apiJSON(url, options = {}) {
  const res = await apiFetch(url, options)
  return res.json()
}

/**
 * Upload a file and extract its text content.
 * Supports PDF, DOCX, XLSX, TXT, CSV, MD, and any plain text format.
 * Returns { text, filename, chars }
 */
export async function parseFile(file) {
  const token = await getToken()
  const form = new FormData()
  form.append('file', file)
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}/api/parse-file`, { method: 'POST', headers, body: form })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).detail || text } catch {}
    throw new Error(msg || `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Stream an SSE endpoint.
 * @param {object} payload   - request body
 * @param {function} onToken - called with each text chunk
 * @param {function} onDone  - called when stream ends
 * @param {function} onError - called on network/parse error
 * @param {string} [endpoint='/api/chat'] - SSE endpoint path
 * @returns {function} abort function
 */
export function streamChat(payload, onToken, onDone, onError, endpoint = '/api/chat') {
  const controller = new AbortController()

  ;(async () => {
    try {
      const token = await getToken()
      const res = await fetch(API_BASE + endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // Rate limit — walk down the fallback chain
        if (res.status === 429) {
          let currentModel = payload.model
          let lastRes = res

          for (let attempt = 0; attempt < 4; attempt++) {
            const fallbackModel = getNextModel(currentModel)
            if (!fallbackModel) break

            currentModel = fallbackModel
            const freshToken = await getToken()
            const retryPayload = { ...payload, model: fallbackModel }
            lastRes = await fetch(API_BASE + endpoint, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}),
              },
              body: JSON.stringify(retryPayload),
            })

            if (lastRes.ok) {
              return _readStream(lastRes, onToken, onDone, onError, controller)
            }
            if (lastRes.status !== 429) break
          }

          // All fallbacks exhausted — wait and retry last known good model once
          await new Promise(r => setTimeout(r, 5000))
          const t2 = await getToken()
          const r2 = await fetch(API_BASE + endpoint, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', ...(t2 ? { Authorization: `Bearer ${t2}` } : {}) },
            body: JSON.stringify({ ...payload, model: currentModel }),
          })
          if (!r2.ok) {
            const text = await r2.text()
            let msg = text
            try { msg = JSON.parse(text).detail || text } catch {}
            onError(new Error(msg || 'All models rate-limited. Try again in a moment.'))
            return
          }
          return _readStream(r2, onToken, onDone, onError, controller)
        }
        const text = await res.text()
        let msg = text
        try { msg = JSON.parse(text).detail || text } catch {}
        onError(new Error(msg || `HTTP ${res.status}`))
        return
      }

      await _readStream(res, onToken, onDone, onError, controller)
    } catch (err) {
      if (err.name !== 'AbortError') onError(err)
    }
  })()

  return () => controller.abort()
}

/**
 * Stream a tools-enabled SSE endpoint (/api/chat-tools).
 * Handles token, tool_call, tool_result, done, error events.
 * @returns {function} abort function
 */
export function streamChatTools(payload, onToken, onToolCall, onToolResult, onDone, onError) {
  let cancelled = false
  const ctrl = new AbortController()

  ;(async () => {
    try {
      const token = await getToken()
      const resp = await fetch(`${API_BASE}/api/chat-tools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || cancelled) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const ev = JSON.parse(raw)
            if (ev.type === 'token')       onToken(ev.content)
            else if (ev.type === 'tool_call')   onToolCall(ev)
            else if (ev.type === 'tool_result') onToolResult(ev)
            else if (ev.type === 'done')   { onDone(); return }
            else if (ev.type === 'error')  { onError(new Error(ev.message)); return }
          } catch {}
        }
      }
      onDone()
    } catch (e) {
      if (!cancelled) onError(e)
    }
  })()

  return () => { cancelled = true; ctrl.abort() }
}

async function _readStream(res, onToken, onDone, onError, controller) {
  try {
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()           // keep incomplete line
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') { onDone(); return }
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) { onError(new Error(parsed.error)); return }
          if (parsed.content) onToken(parsed.content)
        } catch {}
      }
    }
    onDone()
  } catch (err) {
    if (err.name !== 'AbortError') onError(err)
  }
}
