'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PanelLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import Sidebar from '@/components/sidebar/Sidebar'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isOpen, toggle } = useSidebar()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, router, user])

  if (loading || !user) return null

  return (
    <div className="min-h-[100svh] min-h-[100dvh] overflow-hidden bg-bg pb-safe pt-safe">
      <div className="relative flex min-h-[100svh] min-h-[100dvh] min-w-0">
        <Sidebar />
        <main className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(97,211,255,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_28%),radial-gradient(circle_at_bottom,rgba(45,212,191,0.08),transparent_26%)]" />
          <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!isOpen && (
              <button
                onClick={toggle}
                className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-2 text-sm text-text-secondary backdrop-blur-xl transition-colors hover:border-border-light hover:text-text-primary"
              >
                <PanelLeft size={16} />
                Menu
              </button>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar scroll-shell">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
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
