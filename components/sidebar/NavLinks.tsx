'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart2,
  Bot,
  Code2,
  Globe,
  Image,
  LayoutGrid,
  MessageSquare,
  Mic,
  Package,
  PenLine,
  Radar,
  Rss,
  Search,
  Sparkles,
  Terminal,
  Wand2,
  Workflow,
  X,
} from 'lucide-react'
import { useSidebar } from '@/contexts/SidebarContext'

type NavItem = {
  href: string
  icon: typeof LayoutGrid
  label: string
  badge?: string
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Control',
    items: [
      { href: '/hub', icon: LayoutGrid, label: 'Workspace Home' },
      { href: '/chat', icon: MessageSquare, label: 'AI Chat' },
      { href: '/tools/command-center', icon: Terminal, label: 'Command Center', badge: 'Live' },
      { href: '/tools/workflow', icon: Workflow, label: 'Workflow Builder', badge: 'New' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/tools/agents', icon: Bot, label: 'Agent Fleet', badge: '12' },
      { href: '/tools/research', icon: Radar, label: 'Research Studio', badge: 'New' },
      { href: '/tools/rag', icon: Wand2, label: 'Knowledge Mesh' },
      { href: '/tools/search', icon: Globe, label: 'Web Search' },
      { href: '/tools/news', icon: Rss, label: 'AI News' },
      { href: '/tools/compare', icon: BarChart2, label: 'Model Compare' },
    ],
  },
  {
    label: 'Studios',
    items: [
      { href: '/tools/code', icon: Code2, label: 'Code Studio' },
      { href: '/tools/write', icon: PenLine, label: 'Writing Studio' },
      { href: '/images', icon: Image, label: 'Image Studio' },
      { href: '/voice', icon: Mic, label: 'Voice AI' },
      { href: '/tools/marketplace', icon: Package, label: 'Marketplace' },
    ],
  },
]

export default function NavLinks() {
  const { searchQuery, setSearchQuery, isOpen } = useSidebar()
  const [showSearch, setShowSearch] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="space-y-4 px-1">
      {isOpen && (
        showSearch ? (
          <div className="flex items-center gap-2 rounded-[18px] border border-border/80 bg-white/5 px-3 py-3">
            <Search size={15} className="shrink-0 text-text-tertiary" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats and workspaces"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary"
            />
            <button
              onClick={() => {
                setShowSearch(false)
                setSearchQuery('')
              }}
              className="text-text-tertiary transition-colors hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex w-full items-center gap-3 rounded-[18px] border border-border/80 bg-white/5 px-3 py-3 text-sm text-text-secondary transition-colors hover:border-border hover:text-text-primary"
          >
            <Search size={15} />
            Search conversations
          </button>
        )
      )}

      {GROUPS.map((group) => (
        <div key={group.label}>
          {isOpen && (
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.28em] text-text-tertiary">
              {group.label}
            </p>
          )}
          <div className="space-y-1.5">
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/chat' && item.href.length > 1 && pathname.startsWith(item.href))
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm transition-all ${
                    active
                      ? 'bg-white/10 text-text-primary shadow-[0_15px_40px_rgba(91,140,255,0.25)]'
                      : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                  }`}
                >
                  <item.icon size={16} className={active ? 'text-accent' : 'text-cyan-300'} />
                  {isOpen && <span className="flex-1 text-left">{item.label}</span>}
                  {item.badge && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-slate-200 text-slate-700' : 'bg-white/10 text-cyan-200'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
