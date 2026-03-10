'use client'
import { useState, useRef } from 'react'
import { FileText, Send, Loader2, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface Message { role: 'user' | 'assistant'; content: string }

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

// Simple TF-IDF style embedding (client-side, no API needed)
function embed(text: string, vocab: string[]): number[] {
  const words = text.toLowerCase().split(/\W+/)
  return vocab.map(w => words.filter(x => x === w).length / (words.length || 1))
}

function buildVocab(texts: string[]): string[] {
  const freq: Record<string, number> = {}
  for (const t of texts) for (const w of t.toLowerCase().split(/\W+/)) if (w.length > 2) freq[w] = (freq[w] || 0) + 1
  return Object.entries(freq).filter(([, f]) => f >= 1).sort((a, b) => b[1] - a[1]).slice(0, 300).map(([w]) => w)
}

export default function RAGPage() {
  const [docText, setDocText] = useState('')
  const [docLoaded, setDocLoaded] = useState(false)
  const [chunks, setChunks] = useState<string[]>([])
  const [vocab, setVocab] = useState<string[]>([])
  const [embeddings, setEmbeddings] = useState<number[][]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadDocument = () => {
    if (!docText.trim()) return
    const sentences = docText.split(/(?<=[.!?])\s+|\n{2,}/).filter(s => s.trim().length > 20)
    const chunkSize = 3
    const newChunks: string[] = []
    for (let i = 0; i < sentences.length; i += chunkSize) {
      newChunks.push(sentences.slice(i, i + chunkSize).join(' '))
    }
    const v = buildVocab([docText])
    const embs = newChunks.map(c => embed(c, v))
    setChunks(newChunks)
    setVocab(v)
    setEmbeddings(embs)
    setDocLoaded(true)
    setMessages([])
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large. Max 20MB.'); return }
    e.target.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const binaryExts = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'pptx', 'ppt']

    if (binaryExts.includes(ext)) {
      const toastId = toast.loading(`Parsing ${file.name}…`)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/parse-file', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error || 'Failed to parse file', { id: toastId }); return }
        setDocText(data.text)
        toast.success(`Loaded: ${file.name}${data.truncated ? ' (truncated)' : ''}`, { id: toastId })
      } catch {
        toast.error('Failed to parse file', { id: toastId })
      }
    } else {
      const reader = new FileReader()
      reader.onload = ev => {
        setDocText(ev.target?.result as string)
        toast.success(`Loaded: ${file.name}`)
      }
      reader.onerror = () => { toast.error('Failed to read file') }
      reader.readAsText(file)
    }
  }

  const retrieve = (query: string, topK = 3): string => {
    if (!chunks.length) return ''
    const qEmb = embed(query, vocab)
    const scored = chunks.map((c, i) => ({ c, score: cosineSim(qEmb, embeddings[i]) }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map((s, i) => `[${i + 1}] ${s.c}`).join('\n\n')
  }

  const send = async () => {
    if (!input.trim() || streaming || !docLoaded) return
    const context = retrieve(input)
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages([...newMessages, assistantMsg])

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 45000)

      const res = await fetch('/api/tool-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemPrompt: `You are a document Q&A assistant. Answer questions ONLY based on the provided document context. If the answer is not in the context, say so clearly. Always cite which part of the document you used.`,
          messages: [
            ...newMessages.slice(-4).map(m => ({ role: m.role, content: m.content })),
            {
              role: 'user',
              content: `Document Context:\n${context || 'No relevant context found.'}\n\nQuestion: ${input.trim()}`
            }
          ],
          stream: false,
        }),
      })

      clearTimeout(timer)
      const data = await res.json()
      const content = data.content || data.error || '⚠️ Empty response from AI.'

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content }
        return updated
      })
    } catch (e: any) {
      const msg = e.name === 'AbortError'
        ? '⚠️ Request timed out. Please try again.'
        : '⚠️ Error connecting to AI. Please try again.'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: msg }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg text-text-primary">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-semibold text-text-primary">Document Q&A</h1>
          <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">RAG · Free</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!docLoaded ? (
          /* Document input panel */
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="mb-6">
              <h2 className="text-text-primary font-medium mb-1">Load Your Document</h2>
              <p className="text-text-secondary text-sm">Paste text or upload any document (PDF, Word, Excel, CSV, TXT…) — then ask anything about it.</p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-3 p-4 border border-dashed border-border rounded-xl mb-4 cursor-pointer hover:border-emerald-500/40 transition-all group"
            >
              <Upload className="w-4 h-4 text-text-tertiary group-hover:text-emerald-400" />
              <span className="text-sm text-text-tertiary group-hover:text-emerald-400">Upload document (PDF, DOCX, XLSX, TXT, CSV…)</span>
              <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt,.py,.js,.ts,.html" className="hidden" onChange={handleFile} />
            </div>

            <textarea
              value={docText}
              onChange={e => setDocText(e.target.value)}
              placeholder="Or paste your document text here…"
              rows={14}
              className="w-full bg-surface border border-border focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none transition-all mb-4"
            />

            <button
              onClick={loadDocument}
              disabled={!docText.trim()}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-medium transition-all"
            >
              Load Document & Start Chatting
            </button>
          </div>
        ) : (
          /* Chat panel */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">{chunks.length} chunks indexed · {vocab.length} vocab terms</span>
              </div>
              <button
                onClick={() => { setDocLoaded(false); setDocText(''); setMessages([]); setChunks([]); setVocab([]); setEmbeddings([]) }}
                className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Load new doc
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
                    <p className="text-text-secondary text-sm">Document loaded! Ask anything about it.</p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {['Summarize this document', 'What are the main points?', 'What conclusions are drawn?'].map(s => (
                        <button key={s} onClick={() => setInput(s)}
                          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary hover:border-emerald-500/40 transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center flex-shrink-0 mr-3 mt-0.5">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-surface border border-border text-text-primary'
                    }`}>
                      <pre className="whitespace-pre-wrap font-sans">{msg.content}
                        {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                          <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-1 animate-pulse rounded-sm" />
                        )}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-4 border-t border-border flex-shrink-0">
              <div className="max-w-3xl mx-auto flex gap-3">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Ask anything about your document…"
                  rows={1}
                  className="flex-1 bg-surface border border-border focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary outline-none resize-none transition-all"
                />
                <button onClick={send} disabled={streaming || !input.trim()}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-all">
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
