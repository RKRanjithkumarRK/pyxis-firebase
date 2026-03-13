'use client'

import SettingsModal from '@/components/settings/SettingsModal'
import { useSidebar } from '@/contexts/SidebarContext'
import ChatList from './ChatList'
import NavLinks from './NavLinks'
import ProjectsList from './ProjectsList'
import SidebarHeader from './SidebarHeader'
import UserMenu from './UserMenu'

export default function Sidebar() {
  const { isOpen, toggle, settingsOpen, setSettingsOpen } = useSidebar()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={toggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-transition flex h-full min-h-0 flex-col overflow-hidden ${
          isOpen
            ? 'w-[272px] max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:h-full max-md:max-w-[calc(100vw-0.75rem)] max-md:pb-safe max-md:pl-safe'
            : 'w-0'
        } md:relative md:h-full md:shrink-0`}
      >
        <div className="h-full min-h-0 p-2 sm:p-3 md:p-4">
          <div className="panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-border/80">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(97,211,255,0.08),transparent_35%),radial-gradient(circle_at_bottom,rgba(99,102,241,0.08),transparent_38%)]" />
            <div className="relative flex h-full min-h-0 flex-col">
              <SidebarHeader />

              {isOpen && (
                <>
                  <div className="px-4 pb-3">
                    <div className="rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-text-tertiary">Workspace status</p>
                          <p className="mt-2 text-base font-semibold text-text-primary">Operational</p>
                          <p className="text-xs text-text-tertiary">Control plane online and ready for daily work</p>
                        </div>
                        <span className="pill shrink-0 text-[11px] text-emerald-200">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
                          Healthy
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-[18px] border border-border/70 bg-white/8 px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-text-tertiary">Models</p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">5 lanes</p>
                        </div>
                        <div className="rounded-[18px] border border-border/70 bg-white/8 px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-text-tertiary">Surfaces</p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">Chat, research, code</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-1 overflow-y-scroll px-2 pb-2 pr-1 custom-scrollbar scroll-shell">
                    <NavLinks />
                    <div className="mx-3 my-3 h-px bg-border/60" />
                    <ProjectsList />
                    <div className="mx-3 my-2 h-px bg-border/60" />
                    <ChatList />
                  </div>

                  <div className="relative border-t border-border/60">
                    <UserMenu />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
