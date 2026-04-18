'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import AppShell from '@/components/layout/AppShell'
import { PanelLeft } from 'lucide-react'

function PersonasLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isOpen, toggle } = useSidebar()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <AppShell>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {!isOpen && (
          <button
            onClick={toggle}
            className="min-[1180px]:hidden self-start mt-2 ml-2 p-2 rounded-lg btn-ghost text-text-secondary hover:text-text-primary shrink-0"
          >
            <PanelLeft size={20} />
          </button>
        )}
        {children}
      </div>
    </AppShell>
  )
}

export default function PersonasLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <PersonasLayoutInner>{children}</PersonasLayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
