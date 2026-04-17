import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import BackendWarmup from '@/components/BackendWarmup'
import './globals.css'

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#102033' },
    { media: '(prefers-color-scheme: light)', color: '#f5f7fb' },
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'Pyxis One',
    template: '%s | Pyxis One',
  },
  description: 'Pyxis One is an AI operating system for teams that need copilots, workflows, search, analytics, and governance in one enterprise-grade platform.',
  applicationName: 'Pyxis One',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pyxis One',
  },
  icons: {
    icon: '/favicon.svg',
  },
}

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('pyxis-theme') || 'light';
    var r = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(r);
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} light`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-bg text-text-primary antialiased">
        <ThemeProvider>
          <BackendWarmup />
          <AuthProvider>{children}</AuthProvider>
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: '14px',
                fontSize: '14px',
                backdropFilter: 'blur(14px)',
              },
              success: { iconTheme: { primary: '#2dd4bf', secondary: '#102238' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#102238' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
