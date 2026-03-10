'use client'

import { useSidebar } from '@/contexts/SidebarContext'
import SidebarHeader from './SidebarHeader'
import NavLinks from './NavLinks'
import ChatList from './ChatList'
import ProjectsList from './ProjectsList'
import UserMenu from './UserMenu'

export default function Sidebar() {
  const { isOpen, toggle } = useSidebar()

  return (
    <>
      {/* Mobile backdrop — tap to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel
          Mobile  (<md): fixed overlay on top of content (z-50)
          Desktop (md+): normal document-flow column (shrink-0, relative) */}
      <aside
        className={`
          sidebar-transition flex flex-col bg-sidebar overflow-hidden
          ${isOpen
            ? 'w-[260px] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-full max-md:shadow-2xl'
            : 'w-0'
          }
          md:relative md:shrink-0 md:h-full
        `}
      >
        <SidebarHeader />

        {isOpen && (
          <>
            <NavLinks />
            <div className="h-px bg-border/50 mx-4 my-2" />
            <ProjectsList />
            <div className="h-px bg-border/50 mx-4 my-1" />
            <ChatList />
            <UserMenu />
          </>
        )}
      </aside>
    </>
  )
}
