'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import Sidebar from '@/components/sidebar/Sidebar'

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-[100svh] min-h-[100dvh] flex items-center justify-center bg-bg">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-[100svh] min-h-[100dvh] flex bg-bg overflow-hidden pb-safe pt-safe">
      <Sidebar />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <ChatLayoutInner>{children}</ChatLayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
