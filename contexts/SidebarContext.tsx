'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Conversation, Project } from '@/types'

interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
  conversations: Conversation[]
  setConversations: (convs: Conversation[]) => void
  projects: Project[]
  setProjects: (projects: Project[]) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Default open for SSR; after mount we collapse it on smaller viewports.
  const [isOpen, setIsOpen] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Keep the canvas wider on phones, tablets, and narrower desktop windows.
  useEffect(() => {
    const syncForViewport = () => {
      if (window.innerWidth < 1440 || window.innerHeight < 980) {
        setIsOpen(false)
      }
    }

    syncForViewport()
    window.addEventListener('resize', syncForViewport)
    return () => window.removeEventListener('resize', syncForViewport)
  }, [])

  const toggle = () => setIsOpen(p => !p)
  const setOpen = (open: boolean) => setIsOpen(open)

  return (
    <SidebarContext.Provider value={{
      isOpen, toggle, setOpen,
      conversations, setConversations,
      projects, setProjects,
      searchQuery, setSearchQuery,
      settingsOpen, setSettingsOpen,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
