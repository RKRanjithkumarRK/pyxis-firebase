'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CheckCircle,
  FileText,
  FileUp,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocFile = {
  id: string
  name: string
  ext: 'pdf' | 'docx' | 'xlsx' | 'txt'
  size: string
  pages: string
  date: string
  tokens: number
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citation?: string
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_DOCS: DocFile[] = [
  {
    id: 'doc-1',
    name: 'Q4 Financial Report.pdf',
    ext: 'pdf',
    size: '2.4 MB',
    pages: '47 pages',
    date: '3 days ago',
    tokens: 12847,
  },
  {
    id: 'doc-2',
    name: 'Product Roadmap 2026.docx',
    ext: 'docx',
    size: '890 KB',
    pages: '12 pages',
    date: '1 week ago',
    tokens: 4231,
  },
  {
    id: 'doc-3',
    name: 'Market Research.xlsx',
    ext: 'xlsx',
    size: '1.1 MB',
    pages: '5 sheets',
    date: '2 weeks ago',
    tokens: 6590,
  },
]

const SAMPLE_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Summarize the key financial highlights',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content:
      "Based on the Q4 Financial Report, here are the key highlights:\n\n**Revenue:** Total revenue reached $4.2M, up 23% YoY, driven by strong enterprise contract renewals and a record number of new logo acquisitions in APAC.\n\n**Margins:** Gross margin improved to 67%, driven by infrastructure optimizations and a shift toward higher-margin SaaS contracts. Operating expenses grew only 8% despite 23% revenue growth.\n\n**Outlook:** Management projects 30% growth in Q1 2026, backed by a $12M pipeline already in late-stage negotiation. Key risk flagged is enterprise churn in the mid-market segment (+3pts QoQ).",
    citation: 'Page 3, Executive Summary',
  },
]

const SUGGESTED_QUESTIONS = [
  'Summarize the key findings',
  'What are the main risks mentioned?',
  'Extract all action items',
  "What's the conclusion?",
  'Compare Q3 vs Q4 results',
]

const AI_FOLLOW_UP_RESPONSES: Record<string, string> = {
  default:
    "I've analyzed the document and found several relevant sections. The content covers key strategic themes including market positioning, operational efficiency, and forward guidance. Would you like me to dive deeper into any specific area?\n\n**Key themes identified:**\n- Revenue diversification strategy\n- Cost optimization initiatives\n- Expansion roadmap for FY2026\n\nFeel free to ask a more specific question for targeted insights.",
}

// ─── File Type Config ─────────────────────────────────────────────────────────

function getFileConfig(ext: DocFile['ext']) {
  switch (ext) {
    case 'pdf':
      return { bg: 'bg-red-500/15', border: 'border-red-500/25', color: 'text-red-400', icon: FileText }
    case 'docx':
      return { bg: 'bg-blue-500/15', border: 'border-blue-500/25', color: 'text-blue-400', icon: FileText }
    case 'xlsx':
      return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', color: 'text-emerald-400', icon: BarChart3 }
    case 'txt':
      return { bg: 'bg-zinc-500/15', border: 'border-zinc-500/25', color: 'text-zinc-400', icon: FileText }
  }
}

function getExtLabel(ext: DocFile['ext']) {
  return ext.toUpperCase()
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function RenderContent({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line === '') return <div key={i} className="h-1" />

        // Bold segments: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const rendered = parts.map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <span key={j} className="font-semibold text-text-primary">
                {part.slice(2, -2)}
              </span>
            )
          }
          // Italic: *text*
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <span key={j} className="italic text-text-tertiary">
                {part.slice(1, -1)}
              </span>
            )
          }
          return <span key={j}>{part}</span>
        })

        return (
          <p key={i} className="text-sm leading-7 text-text-secondary">
            {rendered}
          </p>
        )
      })}
    </div>
  )
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────

function DocCard({
  doc,
  isSelected,
  onSelect,
  onDelete,
}: {
  doc: DocFile
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const cfg = getFileConfig(doc.ext)
  const Icon = cfg.icon

  return (
    <div
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-[18px] border p-3.5 transition-all duration-200 ${
        isSelected
          ? 'border-accent/40 bg-accent/8 shadow-[0_0_0_1px_rgba(91,140,255,0.2)]'
          : 'border-border/60 bg-surface-hover hover:border-border hover:bg-surface-active'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* File type icon */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.bg} ${cfg.border}`}
        >
          <Icon size={16} className={cfg.color} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{doc.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
            {doc.size} · {doc.pages}
          </p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">{doc.date}</p>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="shrink-0 rounded-lg p-1 text-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Active badge */}
      {isSelected && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(91,140,255,0.8)]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Active</span>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentIntelligencePage() {
  const router = useRouter()

  const [docs, setDocs] = useState<DocFile[]>(SAMPLE_DOCS)
  const [selectedDocId, setSelectedDocId] = useState<string>('doc-1')
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedDoc = docs.find((d) => d.id === selectedDocId) ?? null

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Reset messages when doc changes
  const handleSelectDoc = (id: string) => {
    setSelectedDocId(id)
    if (id === 'doc-1') {
      setMessages(SAMPLE_MESSAGES)
    } else {
      setMessages([])
    }
  }

  const handleDeleteDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id))
    if (selectedDocId === id) {
      const remaining = docs.filter((d) => d.id !== id)
      setSelectedDocId(remaining[0]?.id ?? '')
      setMessages([])
    }
  }

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || !selectedDoc || isLoading) return

    const userMsg: Message = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)

    // Simulate AI response
    await new Promise((res) => setTimeout(res, 1500))

    const aiMsg: Message = {
      id: `msg-${Date.now()}-a`,
      role: 'assistant',
      content: AI_FOLLOW_UP_RESPONSES.default,
      citation: 'Page 12, Section 3.2',
    }
    setMessages((prev) => [...prev, aiMsg])
    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestedQuestion = (q: string) => {
    setInputText(q)
    textareaRef.current?.focus()
  }

  const handleQuickAction = (action: string) => {
    setInputText(action)
    textareaRef.current?.focus()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // In a real app, process dropped files here
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {})
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">

      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-sidebar/80 px-5 py-3.5 backdrop-blur-xl">
        <button
          onClick={() => router.push('/hub')}
          className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm text-text-secondary transition-all hover:border-border hover:bg-surface-hover hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Hub
        </button>

        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-xl"
            style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
          >
            <FileText size={14} className="text-orange-400" />
          </div>
          <span className="font-display text-sm font-semibold text-text-primary">Document Intelligence</span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#C4B5FD' }}
          >
            NEW ✦
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="pill text-[10px] text-emerald-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            AI Ready
          </span>
          <Zap size={14} className="text-text-tertiary" />
        </div>
      </div>

      {/* ── 3-Panel Layout ───────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ══════════════════════════════════════════════════════════════
            LEFT PANEL — Documents list (280px)
        ══════════════════════════════════════════════════════════════ */}
        <aside className="flex w-[280px] shrink-0 flex-col border-r border-border/60 bg-sidebar/60 backdrop-blur-sm">

          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-text-tertiary" />
              <span className="font-display text-sm font-semibold text-text-primary">Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-tertiary">{docs.length} documents</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-accent-hover hover:scale-[1.02]"
              >
                <FileUp size={11} />
                Upload
              </button>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.txt"
            className="hidden"
          />

          {/* Scrollable content */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 custom-scrollbar">

            {/* Upload dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-[18px] border-2 border-dashed p-5 text-center transition-all duration-200 ${
                isDragging
                  ? 'border-accent/60 bg-accent/8'
                  : 'border-border/40 hover:border-border/80 hover:bg-surface-hover'
              }`}
            >
              <div
                className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(91,140,255,0.12)', border: '1px solid rgba(91,140,255,0.25)' }}
              >
                <FileUp size={18} className="text-accent" />
              </div>
              <p className="text-xs font-medium text-text-secondary">Drop files here or click to upload</p>
              <p className="mt-1 font-mono text-[10px] text-text-tertiary">PDF · DOCX · Excel · TXT</p>
              <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">Max 50MB per file</p>
            </div>

            {/* Document list */}
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  isSelected={doc.id === selectedDocId}
                  onSelect={() => handleSelectDoc(doc.id)}
                  onDelete={() => handleDeleteDoc(doc.id)}
                />
              ))}
            </div>

            {docs.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-text-tertiary">No documents uploaded yet.</p>
              </div>
            )}
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════════════
            CENTER PANEL — Chat area (flex-1)
        ══════════════════════════════════════════════════════════════ */}
        <main className="flex min-w-0 flex-1 flex-col">

          {/* Chat header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-5 py-3.5"
            style={{ background: 'var(--chat-header-bg)' }}
          >
            {selectedDoc ? (
              <>
                {(() => {
                  const cfg = getFileConfig(selectedDoc.ext)
                  const Icon = cfg.icon
                  return (
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${cfg.bg} ${cfg.border}`}>
                      <Icon size={14} className={cfg.color} />
                    </div>
                  )
                })()}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-primary">{selectedDoc.name}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${getFileConfig(selectedDoc.ext).bg} ${getFileConfig(selectedDoc.ext).color}`}
                    >
                      {getExtLabel(selectedDoc.ext)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <CheckCircle size={11} />
                      Ready
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="pill text-[10px] text-text-secondary"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Sparkles size={10} className="text-accent" />
                    {selectedDoc.tokens.toLocaleString()} tokens indexed
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-text-tertiary">No document selected</p>
            )}
          </div>

          {/* Messages area */}
          <div className="flex flex-1 flex-col overflow-y-auto p-5 custom-scrollbar">

            {/* Welcome state */}
            {messages.length === 0 && selectedDoc && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-[22px]"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251,146,60,0.2), rgba(91,140,255,0.15))',
                    border: '1px solid rgba(251,146,60,0.3)',
                    boxShadow: '0 8px 32px rgba(251,146,60,0.15)',
                  }}
                >
                  <FileText size={28} className="text-orange-400" />
                </div>
                <div className="text-center">
                  <h2 className="font-display text-xl text-text-primary">
                    Ask anything about{' '}
                    <span className="text-gradient">{selectedDoc.name.replace(/\.[^.]+$/, '')}</span>
                  </h2>
                  <p className="mt-2 text-sm text-text-tertiary">
                    {selectedDoc.tokens.toLocaleString()} tokens indexed · {selectedDoc.pages}
                  </p>
                </div>

                {/* Suggested questions */}
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSuggestedQuestion(q)}
                      className="rounded-full border border-border/60 bg-surface-hover px-4 py-2 text-sm text-text-secondary transition-all hover:border-accent/40 hover:bg-accent/8 hover:text-text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No doc selected */}
            {!selectedDoc && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-[22px]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <FileUp size={28} className="text-text-tertiary" />
                </div>
                <p className="font-display text-lg text-text-secondary">Upload a document to get started</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
                >
                  <FileUp size={14} />
                  Upload Document
                </button>
              </div>
            )}

            {/* Message list */}
            {messages.length > 0 && (
              <div className="flex flex-col gap-5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* AI avatar */}
                    {msg.role === 'assistant' && (
                      <div
                        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: 'linear-gradient(135deg, #FB923C, #5B8CFF)' }}
                      >
                        <Sparkles size={12} color="white" />
                      </div>
                    )}

                    <div className={`group relative max-w-[75%] ${msg.role === 'user' ? 'max-w-[65%]' : ''}`}>
                      {/* Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'message-bubble user'
                            : 'message-bubble assistant'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <p className="text-sm leading-7 text-text-primary">{msg.content}</p>
                        ) : (
                          <RenderContent text={msg.content} />
                        )}
                      </div>

                      {/* Citation pill */}
                      {msg.citation && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] text-text-tertiary"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                          >
                            <FileText size={10} />
                            Source: {msg.citation}
                          </span>
                        </div>
                      )}

                      {/* Copy button on hover */}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopyMessage(msg.content)}
                          className="absolute -right-8 top-2 rounded-lg p-1.5 text-text-tertiary opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-hover hover:text-text-primary"
                          title="Copy"
                        >
                          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div
                      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: 'linear-gradient(135deg, #FB923C, #5B8CFF)' }}
                    >
                      <Sparkles size={12} color="white" />
                    </div>
                    <div className="message-bubble assistant flex items-center gap-1.5 px-4 py-3.5">
                      <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                      <span className="typing-dot" style={{ animationDelay: '160ms' }} />
                      <span className="typing-dot" style={{ animationDelay: '320ms' }} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message input */}
          {selectedDoc && (
            <div className="chat-input-area shrink-0">
              <div className="chat-input-card mx-auto max-w-4xl">
                {/* Attachment label */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = getFileConfig(selectedDoc.ext)
                    const Icon = cfg.icon
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] ${cfg.bg} ${cfg.color}`}
                        style={{ border: `1px solid` }}
                      >
                        <Icon size={10} />
                        {selectedDoc.name} attached
                      </span>
                    )
                  })()}
                </div>

                {/* Textarea + send */}
                <div className="chat-input-row">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your document..."
                    className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                    style={{ minHeight: 44, maxHeight: 140 }}
                  />
                  {inputText && (
                    <button
                      onClick={() => setInputText('')}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-primary"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isLoading}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                      inputText.trim() && !isLoading
                        ? 'bg-accent text-white shadow-[0_4px_16px_rgba(91,140,255,0.4)] hover:bg-accent-hover hover:scale-105'
                        : 'bg-surface-active text-text-tertiary opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>

                {/* Meta row */}
                <div className="input-meta">
                  <span className="font-mono text-[10px] text-text-tertiary">
                    Enter to send · Shift+Enter for newline
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT PANEL — Document details (280px)
        ══════════════════════════════════════════════════════════════ */}
        <aside className="flex w-[280px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/60 bg-sidebar/60 p-4 custom-scrollbar backdrop-blur-sm">

          {selectedDoc ? (
            <>
              {/* Document Info */}
              <div className="glass-panel rounded-[20px]">
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  {(() => {
                    const cfg = getFileConfig(selectedDoc.ext)
                    const Icon = cfg.icon
                    return (
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${cfg.bg} ${cfg.border}`}>
                        <Icon size={15} className={cfg.color} />
                      </div>
                    )
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{selectedDoc.name}</p>
                    <p className="font-mono text-[10px] text-text-tertiary">{getExtLabel(selectedDoc.ext)} document</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    { label: 'Size', value: selectedDoc.size },
                    { label: 'Uploaded', value: selectedDoc.date },
                    { label: 'Pages', value: selectedDoc.pages },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-text-tertiary">{label}</span>
                      <span className="font-mono text-xs text-text-primary">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">Status</span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                      Indexed
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass-panel rounded-[20px]">
                <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-text-tertiary">Quick Actions</p>
                <div className="space-y-2">
                  {[
                    { label: 'Summarize Document', prompt: 'Please provide a comprehensive summary of this document.' },
                    { label: 'Extract Key Points', prompt: 'List the key points and main takeaways from this document.' },
                    { label: 'Find Action Items', prompt: 'Extract all action items, tasks, and next steps mentioned in this document.' },
                    { label: 'Generate Report', prompt: 'Generate a structured executive report based on this document.' },
                  ].map(({ label, prompt }) => (
                    <button
                      key={label}
                      onClick={() => handleQuickAction(prompt)}
                      className="flex w-full items-center gap-2.5 rounded-[14px] border border-border/40 bg-surface-hover px-3 py-2.5 text-left text-xs text-text-secondary transition-all hover:border-accent/30 hover:bg-accent/8 hover:text-text-primary"
                    >
                      <Zap size={12} className="shrink-0 text-accent" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Document Stats */}
              <div className="glass-panel rounded-[20px]">
                <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-text-tertiary">Document Stats</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Tokens', value: selectedDoc.tokens.toLocaleString(), color: 'text-accent' },
                    { label: 'Pages', value: selectedDoc.pages.replace(' pages', '').replace(' sheets', ''), color: 'text-text-primary' },
                    { label: 'Language', value: 'English', color: 'text-text-primary' },
                    { label: 'Confidence', value: '98%', color: 'text-emerald-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between rounded-[12px] bg-surface-hover px-3 py-2">
                      <span className="text-xs text-text-tertiary">{label}</span>
                      <span className={`font-mono text-xs font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Documents */}
              {docs.length > 1 && (
                <div className="glass-panel rounded-[20px]">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-text-tertiary">Related Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {docs
                      .filter((d) => d.id !== selectedDocId)
                      .map((d) => {
                        const cfg = getFileConfig(d.ext)
                        return (
                          <button
                            key={d.id}
                            onClick={() => handleSelectDoc(d.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[10px] transition-all hover:scale-[1.02] ${cfg.bg} ${cfg.border} ${cfg.color}`}
                          >
                            <FileText size={9} />
                            {d.name.replace(/\.[^.]+$/, '').slice(0, 16)}{d.name.length > 20 ? '…' : ''}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="glass-panel flex flex-col items-center gap-3 rounded-[20px] py-10 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <FileText size={22} className="text-text-tertiary" />
              </div>
              <p className="text-sm text-text-tertiary">Select a document to see details</p>
            </div>
          )}

          {/* Powered by badge */}
          <div
            className="mt-auto flex items-center justify-center gap-2 rounded-[16px] px-3 py-2.5"
            style={{ background: 'rgba(91,140,255,0.06)', border: '1px solid rgba(91,140,255,0.15)' }}
          >
            <Sparkles size={11} className="text-accent" />
            <span className="font-mono text-[10px] text-text-tertiary">Powered by Pyxis AI</span>
          </div>
        </aside>

      </div>
    </div>
  )
}
