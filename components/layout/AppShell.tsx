'use client'

import { ReactNode } from 'react'
import Sidebar from '@/components/sidebar/Sidebar'

interface AppShellProps {
  header?: ReactNode
  children: ReactNode
}

export default function AppShell({ header, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {header && <div className="main-header">{header}</div>}
        <div className="main-scroll custom-scrollbar scrollable">{children}</div>
      </main>
    </div>
  )
}
