import { useState, useRef, useEffect } from 'react'
import {
  BookOpen, Upload, Send, Loader2, FileText, Trash2,
  User, Bot, X, File, AlertCircle, SlidersHorizontal,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { apiFetch, streamChat } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

export default function Rag() {
  const { activeWorkspace, addArtifact, getContextString } = useWorkspace()
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [docs,      setDocs]      = useState([])   // { name, chars, text }
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [busy,      setBusy]      = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef   = useRef(null)
  const abortRef  = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = e => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const upload = async (files) => {
    setUploading(true)
    for (const file of files) {
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await apiFetch('/api/parse-file', { method: 'POST', headers: {}, body: form })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(`Failed: ${file.name} — ${err.detail || res.status}`)
          continue
        }
        const data = await res.json()
        setDocs(prev => [...prev, { name: data.filename, chars: data.chars, text: data.text }])
        if (activeWorkspace) {
          addArtifact({ type: 'document', title: data.filename, content: data.text, source: '/rag' })
          toast.success(`Loaded: ${data.filename} — added to workspace`)
        } else {
          toast.success(`Loaded: ${data.filename}`)
        }
      } catch (err) {
        toast.error(`Failed to upload: ${file.name}`)
      }
    }
    setUploading(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    upload([...e.dataTransfer.files])
  }

  const send = (text = input) => {
    if (!text.trim() || busy || docs.length === 0) return
    setInput('')
    setBusy(true)

    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true }])

    const docContext = docs.map((d, i) => `[Document ${i+1}: ${d.name}]\n${d.text.slice(0, 8000)}`).join('\n\n---\n\n')
    const wsContext = getContextString()
    const systemPrompt = `${wsContext ? wsContext + '\n\n---\n\n' : ''}You are a document analysis assistant. Answer questions based ONLY on the provided documents. Always cite the document name when referencing information. If the answer isn't in the documents, say so clearly.\n\n${docContext}`

    let full = ''
    abortRef.current = streamChat(
      {
        message: text,
        model: 'gemini-2.5-flash',
        history: messages.map(m => ({ role: m.role, content: m.content })),
        systemPrompt,
      },
      token => {
        full += token
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m))
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      () => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m))
        setBusy(false)
        abortRef.current = null
      },
      err => {
        toast.error(err.message)
        setBusy(false)
      },
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isDesktop ? 'row' : 'column',
        height: isDesktop ? '100vh' : 'auto',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* Mobile header bar */}
      {!isDesktop && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 sticky top-0 z-20"
          style={{ backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}
        >
          <BookOpen className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>Knowledge Mesh</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(234,88,12,0.15)', color: '#fb923c' }}>RAG</span>
          <button
            onClick={() => setShowMobilePanel(v => !v)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ml-1"
            style={{
              backgroundColor: showMobilePanel ? 'rgba(234,88,12,0.15)' : 'var(--bg-input)',
              borderColor: showMobilePanel ? '#ea580c' : 'var(--border-color)',
              color: showMobilePanel ? '#fb923c' : 'var(--text-muted)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Docs {docs.length > 0 && `(${docs.length})`}
          </button>
        </div>
      )}

      {/* Left: doc panel */}
      <div
        className="flex flex-col"
        style={{
          width: isDesktop ? '288px' : '100%',
          flexShrink: isDesktop ? 0 : 'unset',
          display: isDesktop ? 'flex' : (showMobilePanel ? 'flex' : 'none'),
          borderRight: isDesktop ? '1px solid var(--border-color)' : 'none',
          borderBottom: !isDesktop ? '1px solid var(--border-color)' : 'none',
          backgroundColor: 'var(--bg-sidebar)',
        }}
      >
        {isDesktop && (
        <div
          className="p-4 flex items-center gap-2"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <BookOpen className="w-4 h-4 text-orange-400" />
          <h1 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Knowledge Mesh
          </h1>
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(234,88,12,0.15)', color: '#fb923c' }}>
            RAG
          </span>
        </div>
        )}

        {/* Upload zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className="m-3 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? '#fb923c' : 'var(--border-color)',
            backgroundColor: dragOver ? 'rgba(234,88,12,0.05)' : 'transparent',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md,.json,.csv"
            className="hidden"
            onChange={e => upload([...e.target.files])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Processing…</p>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Drop files or click to upload
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                PDF, Word, Excel, TXT, CSV, MD
              </p>
            </>
          )}
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {docs.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No documents uploaded</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                Upload files above to get started
              </p>
            </div>
          ) : (
            docs.map((d, i) => (
              <div key={i} className="card px-3 py-2.5 flex items-start gap-2">
                <FileText className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {d.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(d.chars / 1000).toFixed(1)}k chars
                  </p>
                </div>
                <button
                  onClick={() => setDocs(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Stats */}
        {docs.length > 0 && (
          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {docs.length} doc{docs.length > 1 ? 's' : ''} · {(docs.reduce((s, d) => s + d.chars, 0) / 1000).toFixed(0)}k chars
            </span>
            <button
              onClick={() => setDocs([])}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Right: chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: isDesktop ? 'unset' : '60vh' }}>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(234,88,12,0.1)' }}
              >
                <BookOpen className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Upload documents to start
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Ask questions about PDF, Word, Excel, CSV & text files
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  AI will cite specific documents in its answers
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="flex gap-2">
                {docs.slice(0, 5).map((d, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-input)' }}
                    title={d.name}
                  >
                    <File className="w-5 h-5 text-orange-400" />
                  </div>
                ))}
              </div>
              <div>
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  {docs.length} document{docs.length > 1 ? 's' : ''} ready
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Ask anything about your documents
                </p>
              </div>
              {/* Quick starter questions */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {['Summarize the main points', 'What are the key findings?', 'List important dates or numbers'].map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#fb923c'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                style={msg.role === 'user' ? { backgroundColor: 'var(--color-primary)' } : { backgroundColor: 'rgba(234,88,12,0.15)' }}
                >
                  {msg.role === 'user'
                    ? <User className="w-3.5 h-3.5 text-white" />
                    : <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                  }
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user' ? 'text-white rounded-tr-sm' : 'rounded-tl-sm'
                  }`}
                  style={msg.role === 'user' ? {
                    backgroundColor: 'var(--color-primary)',
                  } : {
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className={`prose-chat ${msg.streaming ? 'typing-cursor' : ''}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-5">
          {docs.length === 0 && (
            <p className="text-center text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Upload documents first to ask questions
            </p>
          )}
          <div
            className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${docs.length > 0 ? 'var(--border-color)' : 'var(--border-color)'}`,
              opacity: docs.length === 0 ? 0.5 : 1,
            }}
          >
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={docs.length > 0 ? 'Ask a question about your documents…' : 'Upload documents first'}
              disabled={docs.length === 0}
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none focus:outline-none py-0.5"
              style={{
                color: 'var(--text-primary)',
                minHeight: '24px',
                maxHeight: '120px',
              }}
            />
            {busy ? (
              <button
                onClick={() => { abortRef.current?.(); setBusy(false) }}
                className="shrink-0 w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim() || docs.length === 0}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#ea580c' }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#c2410c' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ea580c' }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
          <p className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      </div>
    </div>
  )
}
