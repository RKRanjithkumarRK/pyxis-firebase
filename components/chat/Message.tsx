'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Message as MessageType } from '@/types'

interface Props {
  message: MessageType
  onRegenerate?: () => void
  isLast?: boolean
}

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

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[0.85em] text-text-primary" {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-white/10">
      {/* Header bar with language + copy button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161616]">
        <span className="text-xs text-[#9ca3af] font-mono select-none">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      {/* Code content */}
      <pre className="overflow-x-auto bg-[#1e1e1e] px-4 py-4 text-sm leading-relaxed" {...props}>
        <code className="font-mono text-[#e6edf3]">{code}</code>
      </pre>
    </div>
  )
}

export default function Message({ message, onRegenerate, isLast }: Props) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<boolean | null>(null)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isUser) {
    return (
      <div
        className="msg-in flex justify-end w-full max-w-3xl mx-auto px-4 py-1.5"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="max-w-[80%] px-5 py-3.5 rounded-3xl bg-surface text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
          {message.imageUrl && (
            <img src={message.imageUrl} alt="Generated" className="mt-2 rounded-xl max-w-full" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="msg-in w-full max-w-3xl mx-auto px-4 py-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-4">
        <div className="shrink-0 mt-1">
          <PyxisIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] leading-relaxed text-text-primary">
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlock as any }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            {message.imageUrl && (
              <img src={message.imageUrl} alt="Generated" className="mt-3 rounded-2xl max-w-sm" />
            )}
          </div>

          {/* Action bar — visible on hover */}
          <div className={`flex items-center gap-0.5 mt-2 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
              title="Copy response"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <button
              onClick={() => setLiked(liked === true ? null : true)}
              className={`p-1.5 rounded-lg transition-colors ${liked === true ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'}`}
              title="Good response"
            >
              <ThumbsUp size={15} />
            </button>
            <button
              onClick={() => setLiked(liked === false ? null : false)}
              className={`p-1.5 rounded-lg transition-colors ${liked === false ? 'text-danger' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'}`}
              title="Bad response"
            >
              <ThumbsDown size={15} />
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
                title="Regenerate response"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
