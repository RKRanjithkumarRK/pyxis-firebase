'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import PyxisMark from '@/components/brand/PyxisMark'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Pyxis] Route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-4">
      <div className="panel w-full max-w-md rounded-[32px] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center">
          <PyxisMark size={48} />
        </div>
        <h2 className="mt-6 font-display text-2xl text-text-primary">Something went wrong</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-text-tertiary">ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] hover:bg-accent-hover"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    </div>
  )
}
