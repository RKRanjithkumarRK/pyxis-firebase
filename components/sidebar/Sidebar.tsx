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
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

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
        {/* Header — always sticky at top */}
        <SidebarHeader />

        {isOpen && (
          <>
            {/* ONE unified scrollable section — NavLinks + Projects + Chat history */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <NavLinks />
              <div className="h-px bg-border/50 mx-4 my-2" />
              <ProjectsList />
              <div className="h-px bg-border/50 mx-4 my-1" />
              <ChatList />
            </div>

            {/* UserMenu always pinned at bottom */}
            <UserMenu />
          </>
        )}
      </aside>
    </>
  )
}
