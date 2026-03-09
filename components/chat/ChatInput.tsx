'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Mic, ArrowUp, Square, FileText, X, MicOff, AudioLines } from 'lucide-react'
import { useChat } from '@/contexts/ChatContext'
import toast from 'react-hot-toast'

interface Props {
  onSend: (content: string) => void
  onStop?: () => void
  onVoiceMode: () => void
  disabled?: boolean
  prefill?: string | null
  onPrefillConsumed?: () => void
}

type MicState = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported'

export default function ChatInput({ onSend, onStop, onVoiceMode, disabled, prefill, onPrefillConsumed }: Props) {
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [micState, setMicState] = useState<MicState>('idle')
  const [showMicPrompt, setShowMicPrompt] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const { isStreaming } = useChat()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Consume prefill (from message edit)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('File too large. Max 2MB.'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAttachment({ name: file.name, content: ev.target?.result as string })
      toast.success(`Attached: ${file.name}`)
    }
    reader.onerror = () => { toast.error('Failed to read file') }
    reader.readAsText(file)
    e.target.value = ''
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMicState('unsupported')
      setShowMicPrompt(true)
      return
    }

    // Stop any existing session first
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
      // Show interim live so user knows speech is being captured
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
    <div className="px-4 pb-4 pt-2 shrink-0">
      <div className="max-w-3xl mx-auto">

        {/* Mic permission / error dialog */}
        {showMicPrompt && (
          <div className="mb-3 p-4 bg-surface border border-border rounded-2xl shadow-lg">
            {micState === 'unsupported' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MicOff size={18} className="text-danger" />
                  <p className="text-sm font-medium text-text-primary">Voice not available</p>
                </div>
                <p className="text-xs text-text-secondary">
                  Voice input requires <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.
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
                  Click the 🔒 lock icon in your browser address bar and allow microphone access, then try again.
                </p>
                <button onClick={() => setShowMicPrompt(false)} className="text-xs text-accent hover:underline">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* File attachment preview */}
        {attachment && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-surface rounded-xl border border-border/50 text-sm text-text-secondary">
            <FileText size={14} className="text-accent shrink-0" />
            <span className="truncate flex-1">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-text-tertiary hover:text-text-primary">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Input container */}
        <div className="flex flex-col bg-surface rounded-3xl border border-border/60 input-glow overflow-hidden">
          <div className="flex items-end gap-2 px-3 py-3">

            {/* Left: Attach + Mic */}
            <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
              {/* Attach */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:border-border-light transition-colors"
                title="Attach file"
              >
                <Plus size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.js,.ts,.py,.html,.css,.xml,.yaml,.yml"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Mic — left side */}
              <button
                onClick={toggleMic}
                title={
                  micState === 'listening' ? 'Stop listening' :
                  micState === 'requesting' ? 'Requesting mic...' :
                  'Voice input'
                }
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  micState === 'listening'
                    ? 'text-red-400 bg-red-500/15 border border-red-500/30 animate-pulse'
                    : micState === 'requesting'
                    ? 'text-amber-400 bg-amber-500/10'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {micState === 'listening' ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            </div>

            {/* Textarea */}
            <div className="flex-1 relative py-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={micState === 'listening' ? 'Listening… speak now' : 'Ask anything'}
                rows={1}
                className="w-full bg-transparent text-text-primary text-[15px] placeholder:text-text-tertiary outline-none resize-none max-h-[200px] leading-relaxed"
                disabled={disabled}
              />
              {/* Live interim speech overlay */}
              {interimTranscript && (
                <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300/80 text-sm italic pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  🎙 {interimTranscript}
                </div>
              )}
            </div>

            {/* Right: Send / Stop / AudioLines */}
            <div className="flex items-center shrink-0 mb-0.5">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="w-8 h-8 rounded-full border-2 border-text-primary flex items-center justify-center text-text-primary hover:bg-surface-hover transition-colors"
                  title="Stop generating"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              ) : hasContent ? (
                <button
                  onClick={handleSubmit}
                  disabled={disabled}
                  className="w-8 h-8 rounded-full bg-text-primary flex items-center justify-center text-bg hover:opacity-90 transition-opacity disabled:opacity-25"
                  title="Send"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-secondary transition-colors"
                  title="Audio"
                  onClick={onVoiceMode}
                >
                  <AudioLines size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mic active hint */}
        {micState === 'listening' && (
          <p className="text-center text-xs text-red-400/80 mt-1.5 animate-pulse">
            🎙 Listening — speak clearly, then click mic to stop
          </p>
        )}
        {micState !== 'listening' && (
          <p className="text-center text-xs text-text-tertiary mt-2">
            Pyxis can make mistakes. Check important info.
          </p>
        )}
      </div>
    </div>
  )
}
