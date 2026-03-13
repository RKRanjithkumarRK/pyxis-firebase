'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Zap } from 'lucide-react'
import { useChat } from '@/contexts/ChatContext'
import { models, getModel } from '@/lib/models'

// Per-provider accent colors for the logo dot
const PROVIDER_COLORS: Record<string, string> = {
  'Google':                'bg-blue-500',
  'Anthropic':             'bg-amber-500',
  'OpenAI':                'bg-emerald-500',
  'Meta (OpenRouter)':     'bg-blue-400',
  'Google via OpenRouter': 'bg-blue-500',
  'DeepSeek (OpenRouter)': 'bg-indigo-500',
}

// Speed indicator for each model
const MODEL_SPEED: Record<string, { label: string; color: string }> = {
  'gemini-2.5-flash':                        { label: 'Fast',      color: 'text-emerald-400' },
  'gemini-2.0-flash':                        { label: 'Fast',      color: 'text-emerald-400' },
  'gemini-2.0-flash-lite':                   { label: 'Fastest',   color: 'text-green-400' },
  'gemini-1.5-flash':                        { label: 'Fast',      color: 'text-emerald-400' },
  'gemini-1.5-pro':                          { label: 'Balanced',  color: 'text-blue-400' },
  'anthropic/claude-3.7-sonnet':             { label: 'Smart',     color: 'text-purple-400' },
  'anthropic/claude-3.5-haiku':              { label: 'Fast',      color: 'text-emerald-400' },
  'openai/gpt-4o':                           { label: 'Smart',     color: 'text-purple-400' },
  'openai/gpt-4o-mini':                      { label: 'Fast',      color: 'text-emerald-400' },
  'meta-llama/llama-3.3-70b-instruct:free':  { label: 'Balanced',  color: 'text-blue-400' },
  'google/gemini-2.0-flash-001':             { label: 'Fast',      color: 'text-emerald-400' },
  'deepseek/deepseek-chat-v3-0324:free':     { label: 'Reasoning', color: 'text-violet-400' },
}

// Dot color shown in the trigger button for the active model
const SPEED_DOT: Record<string, string> = {
  'Fastest':   'bg-green-400',
  'Fast':      'bg-emerald-400',
  'Balanced':  'bg-blue-400',
  'Smart':     'bg-purple-400',
  'Reasoning': 'bg-violet-400',
}

function ProviderDot({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? 'bg-zinc-500'
  // First letter of the provider as logo substitute
  const letter = provider.charAt(0)
  return (
    <span className={`flex-shrink-0 w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
      {letter}
    </span>
  )
}

export default function ModelSelector() {
  const { model, setModel } = useChat()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = getModel(model)
  const currentSpeed = MODEL_SPEED[model]
  const dotColor = currentSpeed ? (SPEED_DOT[currentSpeed.label] ?? 'bg-zinc-400') : 'bg-zinc-400'

  const freeModels = models.filter(m => m.free)
  const premiumModels = models.filter(m => !m.free)

  return (
    <div ref={ref} className="relative max-w-full">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-surface-hover transition-colors group"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} shadow-sm flex-shrink-0`} />
        <span className="text-xl font-display font-semibold text-text-primary leading-none">Pyxis One</span>
        {current && (
          <span className="hidden sm:inline text-xs text-text-tertiary border border-border/50 px-1.5 py-0.5 rounded-md bg-surface-hover/50">
            {current.name}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`text-text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-50 mt-2 w-[calc(100vw-1.5rem)] max-w-[340px] overflow-y-auto rounded-2xl border border-border bg-surface py-2 shadow-2xl shadow-black/20 max-h-[75vh] sm:w-[340px]"
        >
          {/* Free section */}
          <div className="px-4 pt-2 pb-1.5 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Free</span>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-medium">
              No key required
            </span>
          </div>

          {freeModels.map(m => {
            const speed = MODEL_SPEED[m.id]
            const isSelected = model === m.id
            return (
              <button
                key={m.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => { setModel(m.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left ${isSelected ? 'bg-surface-hover/50' : ''}`}
              >
                <ProviderDot provider={m.provider} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{m.name}</span>
                    {speed && (
                      <span className={`text-[10px] font-semibold ${speed.color}`}>{speed.label}</span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5 truncate">{m.description}</div>
                </div>
                {isSelected && <Check size={15} className="text-accent shrink-0" />}
              </button>
            )
          })}

          {/* Divider */}
          <div className="h-px bg-border/50 mx-3 my-2" />

          {/* Premium section */}
          <div className="px-4 pb-1.5 flex items-center gap-1.5">
            <Zap size={11} className="text-amber-400" />
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Premium</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-medium">
              OpenRouter key
            </span>
          </div>

          {premiumModels.map(m => {
            const speed = MODEL_SPEED[m.id]
            const isSelected = model === m.id
            return (
              <button
                key={m.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => { setModel(m.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left ${isSelected ? 'bg-surface-hover/50' : ''}`}
              >
                <ProviderDot provider={m.provider} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{m.name}</span>
                    {speed && (
                      <span className={`text-[10px] font-semibold ${speed.color}`}>{speed.label}</span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5 truncate">{m.provider} - {m.description}</div>
                </div>
                {isSelected && <Check size={15} className="text-accent shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
