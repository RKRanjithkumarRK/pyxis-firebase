'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import Sidebar from '@/components/sidebar/Sidebar'
import { PanelLeft } from 'lucide-react'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { isOpen, toggle } = useSidebar()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="h-[100dvh] flex bg-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 relative">
        {!isOpen && (
          <button
            onClick={toggle}
            className="absolute top-3 left-3 z-10 p-2 rounded-lg btn-ghost text-text-secondary hover:text-text-primary"
          >
            <PanelLeft size={20} />
          </button>
        )}
        {children}
      </main>
    </div>
  )
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <LayoutInner>{children}</LayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
