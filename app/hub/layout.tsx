'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PanelLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import AppShell from '@/components/layout/AppShell'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isOpen, toggle } = useSidebar()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, router, user])

  if (loading) return (
    <div className="flex h-[100dvh] items-center justify-center bg-bg">
      <div className="panel flex items-center gap-4 rounded-3xl px-6 py-5">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-surface-active" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-surface-active" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-surface-active" />
        </div>
      </div>
    </div>
  )
  if (!user) return null

  return (
    <AppShell>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(97,211,255,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_28%),radial-gradient(circle_at_bottom,rgba(45,212,191,0.08),transparent_26%)]" />
        {!isOpen && (
          <button
            onClick={toggle}
            className="min-[1180px]:hidden absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-2 text-sm text-text-secondary backdrop-blur-xl transition-colors hover:border-border-light hover:text-text-primary"
          >
            <PanelLeft size={16} />
            Menu
          </button>
        )}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </AppShell>
  )
}

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <LayoutInner>{children}</LayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
