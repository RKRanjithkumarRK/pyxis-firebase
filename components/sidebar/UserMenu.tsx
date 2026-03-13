'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const { setSettingsOpen, isOpen } = useSidebar()
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (!user) return null

  const initial = (user.displayName || user.email || '?')[0].toUpperCase()

  return (
    <div ref={ref} className={`relative ${isOpen ? 'p-3' : 'px-2 py-2'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 rounded-[24px] border border-border/80 bg-white/8 px-3 py-3 text-left transition-colors ${
          isOpen ? 'hover:border-border hover:bg-white/12' : 'justify-center'
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/12 text-sm font-semibold text-cyan-200">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-11 w-11 object-cover" />
          ) : (
            initial
          )}
        </div>
        {isOpen && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{user.displayName || 'Workspace user'}</p>
            <p className="truncate text-xs text-text-tertiary">{user.email || 'Guest session active'}</p>
          </div>
        )}
        {isOpen && (
          <div className="rounded-full border border-border/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">
            Active
          </div>
        )}
        <ChevronUp size={16} className={`text-text-tertiary transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-[24px] border border-border/80 bg-sidebar/95 p-2 shadow-2xl backdrop-blur-2xl">
          <div className="mb-2 flex items-center gap-2 rounded-[18px] bg-white/8 px-3 py-3">
            <ShieldCheck size={16} className="text-cyan-300" />
            <div>
              <p className="text-xs font-semibold text-text-primary">Workspace security</p>
              <p className="text-[11px] text-text-tertiary">Identity and session controls active</p>
            </div>
          </div>

          <button
            onClick={() => {
              setSettingsOpen(true)
              setOpen(false)
            }}
            className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm text-text-secondary transition-colors hover:bg-white/8 hover:text-text-primary"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-sm text-text-secondary transition-colors hover:bg-white/8 hover:text-text-primary"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
