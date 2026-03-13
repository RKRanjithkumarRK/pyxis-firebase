'use client'

import { useEffect, useRef } from 'react'
import { useChat } from '@/contexts/ChatContext'
import Message from './Message'
import TypingIndicator from './TypingIndicator'

function PyxisIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
        <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

interface Props {
  onRegenerate?: () => void
  onEdit?: (content: string, index: number) => void
}

export default function MessageList({ onRegenerate, onEdit }: Props) {
  const { messages, isStreaming } = useChat()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevMessageCountRef = useRef(0)
  const isInitialLoadRef = useRef(true)

  useEffect(() => {
    if (!containerRef.current) return
    const isNewMessage = messages.length > prevMessageCountRef.current
    prevMessageCountRef.current = messages.length

    if (isStreaming) {
      // During streaming: pin to bottom instantly
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    } else if (isInitialLoadRef.current && messages.length > 0) {
      // On first load of a conversation: jump to bottom instantly (no animation)
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      isInitialLoadRef.current = false
    } else if (isNewMessage) {
      // New message appended: smooth scroll to bottom
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  // Reset initial-load flag when messages are cleared (new conversation)
  useEffect(() => {
    if (messages.length === 0) {
      isInitialLoadRef.current = true
      prevMessageCountRef.current = 0
    }
  }, [messages.length])

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id ?? null

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto pr-1 custom-scrollbar scrollable"
    >
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <Message
            key={msg.id}
            message={msg}
            isLast={msg.id === lastAssistantId && !isStreaming}
            onRegenerate={onRegenerate}
            index={index}
            onEdit={onEdit}
          />
        ))}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex items-center gap-3">
            <PyxisIcon />
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
