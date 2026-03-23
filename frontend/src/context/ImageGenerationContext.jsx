/**
 * ImageGenerationContext
 * ======================
 * Keeps image generation running in the background when the user
 * navigates away from the Images page.
 *
 * When generation completes while the user is elsewhere, a toast
 * notification appears with a link back to view the result.
 */
import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const ImageGenerationContext = createContext(null)

const LS_HISTORY_KEY = 'pyxis_image_history'
const MAX_HISTORY    = 30

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(history) {
  try {
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {}
}

export function ImageGenerationProvider({ children }) {
  const [status,   setStatus]   = useState('idle')   // 'idle'|'loading'|'done'|'error'
  const [genPrompt, setGenPrompt] = useState('')
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [history,  setHistory]  = useState(loadHistory)
  const abortRef  = useRef(null)
  const navigateRef = useRef(null)

  // We can't call useNavigate here (not inside router), so we expose a setter
  const setNavigate = useCallback((fn) => { navigateRef.current = fn }, [])

  const startGeneration = useCallback(async (prompt, size = { w: 1024, h: 1024 }) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setGenPrompt(prompt)
    setResult(null)
    setError(null)

    try {
      const token = await window.__getAuthToken?.() ?? ''
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt, width: size.w, height: size.h }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Generation failed')
      }

      const data = await res.json()
      setResult(data)
      setStatus('done')

      // Persist to history
      setHistory(prev => {
        const next = [data, ...prev].slice(0, MAX_HISTORY)
        saveHistory(next)
        return next
      })

      // Show toast if not on /images page
      if (window.location.pathname !== '/images') {
        toast.success(
          (t) => (
            <span
              className="cursor-pointer text-sm"
              onClick={() => {
                toast.dismiss(t.id)
                if (navigateRef.current) navigateRef.current('/images')
                else window.location.href = '/images'
              }}
            >
              Image ready! Click to view
            </span>
          ),
          { duration: 8000, icon: '🖼' }
        )
      }
    } catch (err) {
      if (err.name === 'AbortError') return  // user cancelled — silent
      setStatus('error')
      setError(err.message)
      toast.error(err.message || 'Image generation failed')
    } finally {
      abortRef.current = null
    }
  }, [])

  const cancelGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStatus('idle')
  }, [])

  const clearResult = useCallback(() => {
    setResult(null)
    setStatus('idle')
    setError(null)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveHistory([])
  }, [])

  return (
    <ImageGenerationContext.Provider value={{
      status,
      genPrompt,
      result,
      error,
      history,
      isLoading: status === 'loading',
      startGeneration,
      cancelGeneration,
      clearResult,
      clearHistory,
      setNavigate,
    }}>
      {children}
    </ImageGenerationContext.Provider>
  )
}

export const useImageGeneration = () => useContext(ImageGenerationContext)
