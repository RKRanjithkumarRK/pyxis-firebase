'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { ChatProvider } from '@/contexts/ChatContext'
import AppShell from '@/components/layout/AppShell'

function VoiceLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <AppShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </AppShell>
  )
}

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ChatProvider>
        <VoiceLayoutInner>{children}</VoiceLayoutInner>
      </ChatProvider>
    </SidebarProvider>
  )
}
