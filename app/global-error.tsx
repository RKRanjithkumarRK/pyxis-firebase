'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1628',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(14,165,233,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '1.5rem',
            }}
          >
            ⚡
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Pyxis One — Critical Error
          </h2>
          <p style={{ fontSize: '0.875rem', opacity: 0.6, lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {error.message || 'Something failed at the application level.'}
            {error.digest && (
              <span style={{ display: 'block', marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.4 }}>
                ref: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: '0.625rem 1.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Reload Pyxis
          </button>
        </div>
      </body>
    </html>
  )
}
