import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#212121' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
}

export const metadata: Metadata = {
  title: 'Pyxis',
  description: 'AI chat assistant powered by multiple models.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pyxis',
  },
  icons: {
    icon: '/favicon.svg',
  },
}

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('pyxis-theme') || 'system';
    var r = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(r);
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#10a37f', secondary: '#2f2f2f' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#2f2f2f' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
