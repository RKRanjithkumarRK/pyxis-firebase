'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sparkles, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AccountSettings() {
  const { user, signOut, getToken } = useAuth()
  const [showKeys, setShowKeys] = useState(false)
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [huggingfaceKey, setHuggingfaceKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState<string[]>([])

  useEffect(() => { if (showKeys) loadKeyStatus() }, [showKeys])

  const loadKeyStatus = async () => {
    const token = await getToken()
    if (!token) return
    try {
      const res = await fetch('/api/keys', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setConfigured(data.configured || [])
      }
    } catch {}
  }

  const saveKey = async (provider: string, key: string) => {
    if (!key.trim()) return
    setSaving(true)
    const token = await getToken()
    if (!token) { setSaving(false); return }
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: key.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${provider} key saved`)
      if (provider === 'openrouter') setOpenrouterKey('')
      if (provider === 'openai') setOpenaiKey('')
      if (provider === 'gemini') setGeminiKey('')
      if (provider === 'huggingface') setHuggingfaceKey('')
      loadKeyStatus()
    } catch (err: any) { toast.error(err.message || 'Failed to save key') }
    setSaving(false)
  }

  const removeKey = async (provider: string) => {
    const token = await getToken()
    if (!token) return
    try {
      await fetch(`/api/keys?provider=${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success(`${provider} key removed`)
      loadKeyStatus()
    } catch { toast.error('Failed to remove key') }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-text-primary">Name</span>
        <span className="text-sm text-text-secondary">{user?.displayName || 'User'}</span>
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-text-primary">Email</span>
        <span className="text-sm text-text-secondary">{user?.email}</span>
      </div>
      <div className="h-px bg-border" />

      {/* Plan */}
      <div className="py-4">
        <div className="bg-surface/50 rounded-xl p-4 space-y-2.5">
          <p className="text-sm font-medium text-accent flex items-center gap-2"><Sparkles size={16} />Pyxis Free — Your plan includes:</p>
          {[
            'Free AI models: Gemini 2.5 Flash, Gemini 2.0 Flash, Gemini 2.0 Flash Lite and more',
            'Chat history saved to your account',
            'Image generation (free via Pollinations.ai)',
            'Custom instructions applied to every chat',
            'Projects and conversation management',
            'Voice mode (use Chrome or Edge browser)',
          ].map(f => (
            <p key={f} className="text-sm text-text-secondary flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-text-tertiary shrink-0" />{f}
            </p>
          ))}
        </div>
      </div>
      <div className="h-px bg-border" />

      {/* API Keys */}
      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-text-primary">API Keys</span>
            <p className="text-xs text-text-tertiary mt-0.5">Add your own keys to unlock paid models.</p>
          </div>
          <button onClick={() => setShowKeys(!showKeys)}
            className="px-4 py-1.5 rounded-lg border border-border text-sm text-text-primary hover:bg-surface-hover transition-colors">
            {showKeys ? 'Hide' : 'Manage'}
          </button>
        </div>

        {showKeys && (
          <div className="space-y-4 mt-3">
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">OpenRouter Key</span>
                {configured.includes('openrouter') ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-accent">● Active</span>
                    <button onClick={() => removeKey('openrouter')} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button>
                  </div>
                ) : <span className="text-xs text-text-tertiary">Not set</span>}
              </div>
              <p className="text-xs text-text-tertiary mb-3">Get from openrouter.ai/keys — unlocks Claude, GPT-4o, Gemini</p>
              <div className="flex gap-2">
                <input value={openrouterKey} onChange={e => setOpenrouterKey(e.target.value)}
                  placeholder="sk-or-v1-..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent"
                />
                <button onClick={() => saveKey('openrouter', openrouterKey)} disabled={saving || !openrouterKey}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">OpenAI Key</span>
                {configured.includes('openai') ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-accent">● Active</span>
                    <button onClick={() => removeKey('openai')} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button>
                  </div>
                ) : <span className="text-xs text-text-tertiary">Not set</span>}
              </div>
              <p className="text-xs text-text-tertiary mb-3">Get from platform.openai.com — enables DALL-E 3 image quality upgrade</p>
              <div className="flex gap-2">
                <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent"
                />
                <button onClick={() => saveKey('openai', openaiKey)} disabled={saving || !openaiKey}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">Gemini / Imagen Key</span>
                {configured.includes('gemini') ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-accent">● Active</span>
                    <button onClick={() => removeKey('gemini')} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button>
                  </div>
                ) : <span className="text-xs text-text-tertiary">Not set</span>}
              </div>
              <p className="text-xs text-text-tertiary mb-3">Get from Google AI Studio — enables fast Gemini/Imagen image generation</p>
              <div className="flex gap-2">
                <input value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent"
                />
                <button onClick={() => saveKey('gemini', geminiKey)} disabled={saving || !geminiKey}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>

            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">Hugging Face Key</span>
                {configured.includes('huggingface') ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-accent">● Active</span>
                    <button onClick={() => removeKey('huggingface')} className="text-danger hover:text-danger/80"><Trash2 size={14} /></button>
                  </div>
                ) : <span className="text-xs text-text-tertiary">Not set</span>}
              </div>
              <p className="text-xs text-text-tertiary mb-3">Get from huggingface.co/settings/tokens — enables FLUX image generation</p>
              <div className="flex gap-2">
                <input value={huggingfaceKey} onChange={e => setHuggingfaceKey(e.target.value)}
                  placeholder="hf_..."
                  className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent"
                />
                <button onClick={() => saveKey('huggingface', huggingfaceKey)} disabled={saving || !huggingfaceKey}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="h-px bg-border" />

      <div className="flex items-center justify-between py-4">
        <span className="text-sm text-text-primary">Sign out</span>
        <button onClick={signOut} className="px-4 py-1.5 rounded-lg border border-border text-sm text-text-primary hover:bg-surface-hover transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}
