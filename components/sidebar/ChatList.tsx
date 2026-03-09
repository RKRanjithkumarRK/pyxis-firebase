'use client'

import { useRouter } from 'next/navigation'
import { useSidebar } from '@/contexts/SidebarContext'
import { useChat } from '@/contexts/ChatContext'
import { useAuth } from '@/contexts/AuthContext'
import { Trash2, MoreHorizontal, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Conversation } from '@/types'
import toast from 'react-hot-toast'

function groupByDate(convs: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)
  const monthAgo = new Date(today.getTime() - 30 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Previous 30 Days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const c of convs) {
    const d = new Date(c.updatedAt || c.createdAt)
    if (d >= today) groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else if (d >= weekAgo) groups[2].items.push(c)
    else if (d >= monthAgo) groups[3].items.push(c)
    else groups[4].items.push(c)
  }

  return groups.filter(g => g.items.length > 0)
}

export default function ChatList() {
  const { conversations, setConversations, searchQuery } = useSidebar()
  const { activeConversationId, setActiveConversationId, setMessages } = useChat()
  const { getToken } = useAuth()
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filtered = searchQuery
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations

  const groups = groupByDate(filtered)

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuId(null)
    try {
      const token = await getToken()
      if (!token) return
      await fetch(`/api/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setConversations(conversations.filter(c => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
        router.push('/chat')
      }
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuId(null)
    setRenamingId(conv.id)
    setRenameValue(conv.title)
  }

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed) return
    const original = conversations.find(c => c.id === id)?.title
    if (trimmed === original) return
    // Optimistic update
    setConversations(conversations.map(c => c.id === id ? { ...c, title: trimmed } : c))
    try {
      const token = await getToken()
      if (!token) return
      await fetch('/api/conversations', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: trimmed }),
      })
    } catch {
      // Revert on failure
      setConversations(conversations.map(c => c.id === id ? { ...c, title: original || c.title } : c))
      toast.error('Failed to rename')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1">
      {groups.map(group => (
        <div key={group.label} className="mb-3">
          <div className="px-3 py-1.5 text-xs font-medium text-text-tertiary">{group.label}</div>
          {group.items.map(conv => (
            <div
              key={conv.id}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => { setHoveredId(null); setMenuId(null) }}
              onClick={() => renamingId !== conv.id && router.push(`/chat/${conv.id}`)}
              className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                activeConversationId === conv.id
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {/* Title or rename input */}
              {renamingId === conv.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(conv.id) }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onBlur={() => commitRename(conv.id)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-transparent outline-none text-text-primary text-sm border-b border-accent pb-0.5"
                />
              ) : (
                <span className="truncate flex-1">{conv.title}</span>
              )}

              {/* More menu trigger */}
              {renamingId !== conv.id && (hoveredId === conv.id || menuId === conv.id) && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id) }}
                    className="p-1 rounded hover:bg-surface-active text-text-tertiary hover:text-text-primary"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              )}

              {/* Dropdown menu */}
              {menuId === conv.id && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                  <button
                    onClick={(e) => startRename(conv, e)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                  >
                    <Pencil size={14} />
                    Rename
                  </button>
                  <button
                    onClick={(e) => handleDelete(conv.id, e)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-text-tertiary">
          {searchQuery ? 'No matching chats' : 'No conversations yet'}
        </div>
      )}
    </div>
  )
}
