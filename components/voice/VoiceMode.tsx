'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Mic, Send } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'
import VoiceWaveform from './VoiceWaveform'

interface Props {
  onClose: () => void
  onSend: (content: string) => void
}

export default function VoiceMode({ onClose, onSend }: Props) {
  const { state, transcript, isSupported, start, stop, speak, stopSpeaking } = useVoice()
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  useEffect(() => {
    if (isSupported) start()
    return () => { stop(); stopSpeaking() }
  }, [])

  const handleSendVoice = useCallback(() => {
    const text = transcript.trim()
    if (!text) return
    stop()
    onSend(text)
    onClose()
  }, [transcript, stop, onSend, onClose])

  const handleSendText = () => {
    const text = textInput.trim()
    if (!text) return
    stop()
    onSend(text)
    onClose()
  }

  const handleEnd = () => {
    stop()
    stopSpeaking()
    onClose()
  }

  if (!isSupported) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-bg gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
          <Mic size={28} className="text-text-tertiary" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Voice not available</h2>
        <p className="text-text-secondary text-sm max-w-sm">
          Voice mode requires the Web Speech API, which is supported in <strong>Google Chrome</strong> and <strong>Microsoft Edge</strong>.
          <br /><br />
          Brave and Firefox block this API. Please switch to Chrome or Edge to use voice mode.
        </p>
        <button onClick={onClose} className="mt-2 px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-hover text-text-primary text-sm font-medium transition-colors">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-lg font-semibold text-text-primary">Pyxis Voice</h2>
        <button onClick={handleEnd} className="p-2 rounded-lg btn-ghost text-text-secondary hover:text-text-primary">
          <X size={20} />
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {state === 'permission' && (
          <>
            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
              <Mic size={32} className="text-text-tertiary" />
            </div>
            <p className="text-text-secondary text-lg">Requesting microphone access...</p>
          </>
        )}

        {state === 'connecting' && (
          <>
            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center animate-pulse">
              <Mic size={32} className="text-accent" />
            </div>
            <p className="text-text-primary text-2xl font-semibold">Connecting to voice</p>
          </>
        )}

        {state === 'listening' && (
          <>
            <VoiceWaveform active={true} />
            {transcript && (
              <p className="text-text-primary text-lg max-w-md text-center leading-relaxed">
                {transcript}
              </p>
            )}
            {!transcript && (
              <p className="text-text-secondary text-lg">Listening...</p>
            )}
          </>
        )}

        {state === 'speaking' && (
          <>
            <VoiceWaveform active={true} />
            <p className="text-text-secondary text-lg">Speaking...</p>
          </>
        )}

        {state === 'idle' && (
          <>
            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center">
              <Mic size={32} className="text-text-tertiary" />
            </div>
            <button
              onClick={start}
              className="px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
            >
              Start listening
            </button>
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-6 pb-6">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {showTextInput ? (
            <div className="flex-1 flex items-center gap-2 bg-surface rounded-full px-4 py-3">
              <input
                autoFocus
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendText() }}
                placeholder="Type"
                className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-tertiary"
              />
              <button onClick={() => setShowTextInput(false)} className="text-text-tertiary hover:text-text-primary">
                <Mic size={18} />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2 bg-surface rounded-full px-4 py-3 cursor-text" onClick={() => setShowTextInput(true)}>
              <span className="text-text-tertiary text-sm">Type</span>
              <div className="flex-1" />
              <Mic size={18} className="text-text-tertiary" />
            </div>
          )}

          {transcript && state === 'listening' && (
            <button
              onClick={handleSendVoice}
              className="p-3 rounded-full bg-accent hover:bg-accent-hover text-white transition-colors shrink-0"
            >
              <Send size={18} />
            </button>
          )}

          <button
            onClick={handleEnd}
            className="px-5 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-medium transition-colors shrink-0"
          >
            End
          </button>
        </div>
      </div>
    </div>
  )
}
