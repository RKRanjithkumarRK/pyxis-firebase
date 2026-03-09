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

  useEffect(() => {
    if (!containerRef.current) return
    if (isStreaming) {
      // Instant scroll during streaming — prevents smooth-scroll overshooting
      // which visually clips the first characters of new content
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isStreaming])

  // Find the last assistant message id
  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id ?? null

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="py-6 pb-2">
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
          <div className="w-full max-w-3xl mx-auto px-4 py-1.5">
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">
                <PyxisIcon />
              </div>
              <div className="pt-2">
                <TypingIndicator />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
