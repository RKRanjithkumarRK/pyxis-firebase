'use client'

import SettingsModal from '@/components/settings/SettingsModal'
import { useSidebar } from '@/contexts/SidebarContext'
import ChatList from './ChatList'
import NavLinks from './NavLinks'
import ProjectsList from './ProjectsList'
import SidebarHeader from './SidebarHeader'
import UserMenu from './UserMenu'

export default function Sidebar() {
  const { isOpen, toggle, setOpen, settingsOpen, setSettingsOpen } = useSidebar()

  return (
    <>
      <div
        className="sidebar-backdrop"
        data-open={isOpen ? 'true' : 'false'}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        <div className="sidebar-shell">
          <SidebarHeader />
          <div className="sidebar-scroll custom-scrollbar scrollable">
            <NavLinks />
            {isOpen && (
              <>
                <div className="sidebar-divider" />
                <ProjectsList />
                <div className="sidebar-divider" />
                <ChatList />
              </>
            )}
          </div>
          <div className="sidebar-footer">
            <UserMenu />
          </div>
        </div>
      </aside>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
