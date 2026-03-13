'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Mic, ArrowUp, Square, FileText, X, MicOff, AudioLines } from 'lucide-react'
import { useChat } from '@/contexts/ChatContext'
import toast from 'react-hot-toast'

interface Props {
  onSend: (content: string) => void
  onStop?: () => void
  onVoiceMode?: () => void
  disabled?: boolean
  prefill?: string | null
  onPrefillConsumed?: () => void
}

type MicState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

export default function ChatInput({ onSend, onStop, disabled, prefill, onPrefillConsumed }: Props) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [micState, setMicState] = useState<MicState>('idle')
  const [showMicPrompt, setShowMicPrompt] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const { isStreaming } = useChat()
  const router = useRouter()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  useEffect(() => {
    if (prefill != null) {
      setInput(prefill)
      onPrefillConsumed?.()
      setTimeout(() => {
        textareaRef.current?.focus()
        const len = prefill.length
        textareaRef.current?.setSelectionRange(len, len)
      }, 50)
    }
  }, [prefill]) // eslint-disable-line

  const handleSubmit = () => {
    const trimmed = input.trim()
    if ((!trimmed && !attachment) || disabled || isStreaming) return
    const content = attachment
      ? `${trimmed}\n\n[File: ${attachment.name}]\n\`\`\`\n${attachment.content}\n\`\`\``
      : trimmed
    onSend(content)
    setInput('')
    setAttachment(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10MB.'); return }
    e.target.value = ''

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const binaryExts = ['pdf', 'doc', 'docx', 'xlsx', 'xls', 'pptx', 'ppt']

    if (binaryExts.includes(ext)) {
      const toastId = toast.loading(`Parsing ${file.name}...`)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/parse-file', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) { toast.error(data.error || 'Failed to parse file', { id: toastId }); return }
        setAttachment({ name: file.name, content: data.text })
        toast.success(`Attached: ${file.name}${data.truncated ? ' (truncated)' : ''}`, { id: toastId })
      } catch {
        toast.error('Failed to parse file', { id: toastId })
      }
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachment({ name: file.name, content: ev.target?.result as string })
        toast.success(`Attached: ${file.name}`)
      }
      reader.onerror = () => { toast.error('Failed to read file') }
      reader.readAsText(file)
    }
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicState('unsupported')
      setShowMicPrompt(true)
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onstart = () => setMicState('listening')

    recognition.onresult = (e: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript
        } else {
          interim += e.results[i][0].transcript
        }
      }
      setInterimTranscript(interim)
      if (final) {
        setInput(prev => prev ? prev + ' ' + final : final)
        setInterimTranscript('')
        setTimeout(() => textareaRef.current?.focus(), 50)
      }
    }

    recognition.onend = () => {
      setMicState('idle')
      setInterimTranscript('')
    }

    recognition.onerror = (e: any) => {
      setMicState('idle')
      setInterimTranscript('')
      if (e.error === 'not-allowed') {
        setMicState('denied')
        setShowMicPrompt(true)
      }
    }

    recognition.start()
    setMicState('requesting')
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setMicState('idle')
    setInterimTranscript('')
  }

  const toggleMic = () => {
    if (micState === 'listening') {
      stopListening()
    } else if (micState === 'idle' || micState === 'requesting') {
      startListening()
    }
  }

  const hasContent = !!(input.trim() || attachment)

  return (
    <div className="chat-input-area">
      <div className="chat-input-card">
        {showMicPrompt && (
          <div className="panel mb-3 space-y-2">
            {micState === 'unsupported' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MicOff size={18} className="text-danger" />
                  <p className="text-sm font-medium text-text-primary">Voice not available</p>
                </div>
                <p className="text-xs text-text-secondary">
                  Voice input requires Google Chrome or Microsoft Edge.
                </p>
                <button onClick={() => setShowMicPrompt(false)} className="text-xs text-accent hover:underline">Dismiss</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MicOff size={18} className="text-danger" />
                  <p className="text-sm font-medium text-text-primary">Microphone blocked</p>
                </div>
                <p className="text-xs text-text-secondary">
                  Open the browser lock icon and allow microphone access, then try again.
                </p>
                <button onClick={() => setShowMicPrompt(false)} className="text-xs text-accent hover:underline">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {attachment && (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface/60 px-3 py-2 text-sm text-text-secondary">
            <FileText size={14} className="text-accent shrink-0" />
            <span className="truncate flex-1">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-text-tertiary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="chat-input-row">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-xl border border-border/60 bg-surface flex items-center justify-center text-text-tertiary transition-colors hover:border-accent hover:text-accent"
              title="Attach file"
            >
              <Plus size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv,.js,.ts,.jsx,.tsx,.py,.html,.css,.xml,.yaml,.yml,.pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={toggleMic}
              className={`w-10 h-10 rounded-xl border border-border/60 flex items-center justify-center transition-all ${
                micState === 'listening'
                  ? 'border-red-500/50 bg-red-500/10 text-red-400 animate-pulse'
                  : micState === 'requesting'
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-400'
                  : 'border-border/50 bg-surface text-text-tertiary hover:border-accent hover:text-accent'
              }`}
              title={
                micState === 'listening' ? 'Stop listening' :
                micState === 'requesting' ? 'Requesting mic...' :
                'Voice input'
              }
            >
              {micState === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={micState === 'listening' ? 'Listening... speak now' : 'Ask Pyxis anything...'}
              rows={1}
              className="w-full max-h-[200px] overflow-y-auto bg-transparent text-text-primary text-base placeholder:text-text-muted outline-none resize-none leading-relaxed"
              disabled={disabled}
            />
            {interimTranscript && (
              <div className="absolute bottom-full left-0 mb-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200 shadow-lg">
                Listening: {interimTranscript}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="w-12 h-12 rounded-xl border-2 border-text-primary flex items-center justify-center text-text-primary transition hover:bg-white/10"
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : hasContent ? (
              <button
                onClick={handleSubmit}
                disabled={disabled}
                className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center transition hover:bg-accent-strong disabled:opacity-50 disabled:hover:bg-accent"
                title="Send"
              >
                <ArrowUp size={18} />
              </button>
            ) : (
              <button
                className="w-12 h-12 rounded-xl border border-border/60 text-text-tertiary flex items-center justify-center transition hover:border-accent hover:text-accent"
                title="Audio"
                onClick={() => router.push('/voice')}
              >
                <AudioLines size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="input-meta text-xs text-text-muted">
          <span>Enter to send, Shift+Enter for new line</span>
          {attachment && <span>Attachment will be included</span>}
        </div>

        {micState === 'listening' ? (
          <p className="text-center text-xs text-red-400/80 animate-pulse">
            Listening... tap the mic to stop.
          </p>
        ) : (
          <p className="text-center text-xs text-text-muted">
            Pyxis may be inaccurate. Verify critical outputs before acting.
          </p>
        )}
      </div>
    </div>
  )
}
