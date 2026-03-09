'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useChat } from '@/contexts/ChatContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { useAuth } from '@/contexts/AuthContext'
import ModelSelector from './ModelSelector'
import WelcomeScreen from './WelcomeScreen'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import VoiceMode from '@/components/voice/VoiceMode'
import { Message } from '@/types'

interface Props {
  conversationId?: string
}

export default function ChatView({ conversationId }: Props) {
  const {
    messages, setMessages,
    model,
    isStreaming, setIsStreaming,
    activeConversationId, setActiveConversationId,
    abortController,
  } = useChat()
  const { setConversations } = useSidebar()
  const { getToken } = useAuth()
  const [voiceMode, setVoiceMode] = useState(false)
  const [editContent, setEditContent] = useState<string | null>(null)
  const currentConvIdRef = useRef<string | null>(null)

  // Sync ref with state
  useEffect(() => {
    currentConvIdRef.current = activeConversationId
  }, [activeConversationId])

  // Load conversation
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId)
      currentConvIdRef.current = conversationId
      loadMessages(conversationId)
    } else {
      setActiveConversationId(null)
      currentConvIdRef.current = null
      setMessages([])
    }
  }, [conversationId])

  const loadMessages = async (convId: string) => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch(`/api/messages?conversationId=${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {}
  }

  const refreshConversations = async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {}
  }

  useEffect(() => {
    refreshConversations()
  }, [])

  const streamResponse = useCallback(async (
    apiMessages: { role: 'user' | 'assistant'; content: string }[],
    convId: string,
    token: string,
  ) => {
    // Create abort controller for this request
    const controller = new AbortController()
    abortController.current = controller

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, model }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `Error ${res.status}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let assistantContent = ''
    let buffer = ''

    const assistantMsg: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              const chunk = parsed.content
              assistantContent += chunk
              // Use chunk directly in functional update — avoids stale closure
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + chunk }
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Generation was stopped by user — keep what we have
        return assistantContent
      }
      throw err
    }

    return assistantContent
  }, [model, setMessages, abortController])

  const handleSend = useCallback(async (content: string) => {
    const token = await getToken()
    if (!token) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    try {
      let convId = currentConvIdRef.current

      // Create conversation if new
      if (!convId) {
        const convRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: content.slice(0, 60), model }),
        })
        if (convRes.ok) {
          const data = await convRes.json()
          convId = data.id
          setActiveConversationId(convId)
          currentConvIdRef.current = convId
          window.history.replaceState(null, '', `/chat/${convId}`)
          refreshConversations()
        }
      }

      // Save user message
      if (convId) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: convId, role: 'user', content }),
        })
      }

      // Build message history for API (current messages + new user message)
      const apiMessages = [...messages, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const assistantContent = await streamResponse(apiMessages, convId!, token)

      // Save assistant message
      if (convId && assistantContent) {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: convId, role: 'assistant', content: assistantContent }),
        })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, something went wrong: ${err.message}`,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    } finally {
      setIsStreaming(false)
      abortController.current = null
    }
  }, [getToken, model, setMessages, setIsStreaming, streamResponse])

  const handleStop = useCallback(() => {
    abortController.current?.abort()
  }, [abortController])

  // Edit a user message: slice history back to that point, prefill input
  const handleEditMessage = useCallback((content: string, index: number) => {
    setMessages(prev => prev.slice(0, index))
    setEditContent(content)
  }, [setMessages])

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return
    const token = await getToken()
    if (!token) return

    // Get current messages — remove last assistant message, re-send
    setMessages(prev => {
      const withoutLast = prev[prev.length - 1]?.role === 'assistant'
        ? prev.slice(0, -1)
        : prev
      return withoutLast
    })

    // Wait a tick then re-stream
    setTimeout(async () => {
      setIsStreaming(true)
      try {
        // Get messages without the last assistant message
        const currentMsgs = messages[messages.length - 1]?.role === 'assistant'
          ? messages.slice(0, -1)
          : messages
        const apiMessages = currentMsgs
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        const convId = currentConvIdRef.current
        const assistantContent = await streamResponse(apiMessages, convId!, token)

        if (convId && assistantContent) {
          await fetch('/api/messages', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: convId, role: 'assistant', content: assistantContent }),
          })
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setMessages(prev => [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: `Sorry: ${err.message}`,
              createdAt: new Date().toISOString(),
            },
          ])
        }
      } finally {
        setIsStreaming(false)
        abortController.current = null
      }
    }, 50)
  }, [isStreaming, getToken, setMessages, setIsStreaming, streamResponse])

  if (voiceMode) {
    return <VoiceMode onClose={() => setVoiceMode(false)} onSend={handleSend} />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar — model selector */}
      <div className="flex items-center px-4 py-2 shrink-0">
        <ModelSelector />
      </div>

      {/* Messages or welcome */}
      {messages.length === 0 ? (
        <WelcomeScreen onSend={handleSend} />
      ) : (
        <MessageList onRegenerate={handleRegenerate} onEdit={handleEditMessage} />
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        onVoiceMode={() => setVoiceMode(true)}
        prefill={editContent}
        onPrefillConsumed={() => setEditContent(null)}
      />
    </div>
  )
}
