'use client'

import { PanelLeft, SquarePen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import PyxisMark from '@/components/brand/PyxisMark'
import { useChat } from '@/contexts/ChatContext'
import { useSidebar } from '@/contexts/SidebarContext'

export default function SidebarHeader() {
  const { isOpen, toggle } = useSidebar()
  const { setMessages, setActiveConversationId } = useChat()
  const router = useRouter()

  const handleNewChat = () => {
    setMessages([])
    setActiveConversationId(null)
    router.push('/chat')
  }

  return (
    <div className="px-4 pb-4 pt-4">
      <div className="rounded-[24px] border border-border/80 bg-white/8 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push('/hub')}
            className="flex min-w-0 items-center gap-3 rounded-2xl transition-opacity hover:opacity-100"
            title="Go to hub"
          >
            <PyxisMark size={40} />
            {isOpen && (
              <div className="min-w-0 text-left">
                <p className="font-display text-lg leading-none text-text-primary">Pyxis One</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-text-tertiary">Workspace shell</p>
              </div>
            )}
          </button>

          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-white/10 text-text-secondary transition-colors hover:border-border-light hover:text-text-primary"
            title={isOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {isOpen && (
          <button
            onClick={handleNewChat}
            className="mt-3 flex w-full items-center justify-between rounded-[18px] border border-border/80 bg-white px-3.5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01]"
            title="New chat"
          >
            <span>Start new chat</span>
            <SquarePen size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
