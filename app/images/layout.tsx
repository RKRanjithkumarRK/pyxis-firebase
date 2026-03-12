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
    <div className="min-h-[100svh] min-h-[100dvh] flex bg-bg overflow-hidden pb-safe pt-safe">
      <Sidebar />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!isOpen && (
          <button onClick={toggle} className="self-start mt-2 ml-2 p-2 rounded-lg btn-ghost text-text-secondary hover:text-text-primary shrink-0">
            <PanelLeft size={20} />
          </button>
        )}
        {children}
      </main>
    </div>
  )
}

export default function ImagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <LayoutInner>{children}</LayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
