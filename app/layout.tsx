import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'PYXIS — AI Superstation',
  description: 'All AI models. One place. Powered by Groq, Claude, GPT-4, Gemini.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster position="bottom-right" toastOptions={{
          style: { background:'#0c1220', color:'#e8f0fe', border:'1px solid #1e2e44', borderRadius:'8px', fontSize:'13px' },
          success: { iconTheme: { primary:'#00ffa3', secondary:'#0c1220' } },
          error:   { iconTheme: { primary:'#ff4444', secondary:'#0c1220' } },
        }} />
      </body>
    </html>
  )
}
