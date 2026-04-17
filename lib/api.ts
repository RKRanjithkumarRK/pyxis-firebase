const DEFAULT_TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 1_000

export interface ApiResult<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number; retries?: number }
): Promise<ApiResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1, ...fetchInit } = init ?? {}

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(path, { ...fetchInit, signal: controller.signal })
      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let error = `Request failed (${res.status})`
        try { error = JSON.parse(text)?.detail ?? JSON.parse(text)?.error ?? error } catch {}
        return { ok: false, status: res.status, data: null, error }
      }

      const contentType = res.headers.get('content-type') ?? ''
      const data = contentType.includes('application/json')
        ? ((await res.json()) as T)
        : ((await res.text()) as unknown as T)

      return { ok: true, status: res.status, data, error: null }
    } catch (err: unknown) {
      clearTimeout(timer)
      const isRetryable =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TypeError')

      if (isRetryable && attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }

      const message =
        err instanceof Error && err.name === 'AbortError'
          ? `Request timed out after ${timeoutMs / 1000}s`
          : err instanceof Error
            ? err.message
            : 'Network error'

      return { ok: false, status: 0, data: null, error: message }
    }
  }

  return { ok: false, status: 0, data: null, error: 'Request failed after retries' }
}
