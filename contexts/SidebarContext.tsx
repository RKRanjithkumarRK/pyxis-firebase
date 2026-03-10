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
  // Default open for SSR; on mobile (<768px) we close it after mount
  const [isOpen, setIsOpen] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // On first client render, close sidebar on small screens
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsOpen(false)
    }
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
