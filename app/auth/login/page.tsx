'use client'
import { useState, useEffect } from 'react'
import { auth } from '@/lib/firebase-client'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const PROVIDERS = [
  { id:'groq',      name:'Groq',           badge:'⚡', color:'#f97316', desc:'Ultra-fast. Free tier generous.',     url:'https://console.groq.com',        prefix:'gsk_'    },
  { id:'anthropic', name:'Claude',          badge:'🔶', color:'#ff7849', desc:'Claude 3.5 Sonnet & Haiku.',          url:'https://console.anthropic.com',    prefix:'sk-ant-' },
  { id:'openai',    name:'OpenAI',          badge:'🔷', color:'#4d9fff', desc:'GPT-4o and GPT-4o Mini.',             url:'https://platform.openai.com',      prefix:'sk-'     },
  { id:'gemini',    name:'Google Gemini',   badge:'🔮', color:'#a78bfa', desc:'Gemini 1.5 Pro & Flash. Free tier.', url:'https://aistudio.google.com',      prefix:'AIza'    },
]

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(url, { ...opts, headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}`, ...opts.headers } })
}

export default function SettingsPage() {
  const [configured, setConfigured] = useState<string[]>([])
  const [inputs, setInputs] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState<Record<string,boolean>>({})
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      loadData()
    })
    return () => unsub()
  }, [])

  const loadData = async () => {
    const [keysRes, profileRes] = await Promise.all([apiFetch('/api/keys'), apiFetch('/api/profile')])
    if (keysRes.ok) { const d = await keysRes.json(); setConfigured(d.configured || []) }
    if (profileRes.ok) { const d = await profileRes.json(); setSystemPrompt(d.systemPrompt || '') }
  }

  const saveKey = async (provider: string) => {
    const key = inputs[provider]?.trim()
    if (!key) return
    setLoading(p=>({...p,[provider]:true}))
    const r = await apiFetch('/api/keys', { method:'POST', body: JSON.stringify({ provider, key }) })
    if (r.ok) { setConfigured(p=>Array.from(new Set([...p,provider]))); setInputs(p=>({...p,[provider]:''})); toast.success(`${provider} key saved!`) }
    else { const e = await r.json(); toast.error(e.error) }
    setLoading(p=>({...p,[provider]:false}))
  }

  const removeKey = async (provider: string) => {
    await apiFetch(`/api/keys?provider=${provider}`, { method:'DELETE' })
    setConfigured(p=>p.filter(x=>x!==provider))
    toast.success('Key removed')
  }

  const saveProfile = async () => {
    setSaving(true)
    await apiFetch('/api/profile', { method:'POST', body: JSON.stringify({ systemPrompt }) })
    toast.success('Saved!')
    setSaving(false)
  }

  const box = { background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'16px', overflow:'hidden', marginBottom:'16px' } as React.CSSProperties
  const head = { padding:'16px 20px', borderBottom:'1px solid var(--border)' } as React.CSSProperties
  const inp = { padding:'9px 12px', borderRadius:'10px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--text)', fontSize:'13px', outline:'none', flex:1 } as React.CSSProperties

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', overflowY:'auto' }}>
      <div style={{ maxWidth:'580px', margin:'0 auto', padding:'32px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'28px' }}>
          <button onClick={()=>router.push('/chat')} style={{ padding:'8px', borderRadius:'8px', border:'1px solid var(--border)', background:'var(--s1)', color:'var(--t2)', cursor:'pointer', display:'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 style={{ color:'#fff', fontWeight:700, fontSize:'1.2rem' }}>Settings</h1>
            <p style={{ color:'var(--t2)', fontSize:'12px' }}>{user?.email}</p>
          </div>
        </div>

        {/* API Keys */}
        <div style={box}>
          <div style={head}>
            <h2 style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>API Keys</h2>
            <p style={{ color:'var(--t2)', fontSize:'12px', marginTop:'2px' }}>Keys are encrypted and stored securely. Never exposed to the browser.</p>
          </div>
          {PROVIDERS.map(p=>(
            <div key={p.id} style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'10px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span>{p.badge}</span>
                    <span style={{ color:'#fff', fontWeight:500, fontSize:'13px' }}>{p.name}</span>
                    {configured.includes(p.id) && (
                      <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'100px', background:'rgba(0,255,163,0.1)', color:'var(--g)', border:'1px solid rgba(0,255,163,0.2)' }}>✓ Connected</span>
                    )}
                  </div>
                  <p style={{ color:'var(--t3)', fontSize:'12px', marginTop:'2px' }}>{p.desc}</p>
                </div>
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'8px', color:'var(--b)', background:'rgba(77,159,255,0.1)', border:'1px solid rgba(77,159,255,0.2)', textDecoration:'none', flexShrink:0 }}>
                  Get key →
                </a>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <input type="password" value={inputs[p.id]||''} onChange={e=>setInputs(v=>({...v,[p.id]:e.target.value}))}
                  placeholder={configured.includes(p.id)?'••••••••••• (saved)':p.prefix+'... paste here'}
                  style={inp} onKeyDown={e=>e.key==='Enter'&&saveKey(p.id)} />
                <button onClick={()=>saveKey(p.id)} disabled={!inputs[p.id]||loading[p.id]}
                  style={{ padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--g)', fontSize:'13px', cursor:'pointer', opacity:inputs[p.id]?1:0.4 }}>
                  {loading[p.id]?'…':'Save'}
                </button>
                {configured.includes(p.id) && (
                  <button onClick={()=>removeKey(p.id)}
                    style={{ padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--b2)', background:'var(--s2)', color:'#ff4444', fontSize:'13px', cursor:'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* System Prompt */}
        <div style={box}>
          <div style={head}>
            <h2 style={{ color:'#fff', fontWeight:600, fontSize:'14px' }}>Custom System Prompt</h2>
            <p style={{ color:'var(--t2)', fontSize:'12px', marginTop:'2px' }}>Applies to all your conversations.</p>
          </div>
          <div style={{ padding:'16px 20px' }}>
            <textarea value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)} rows={4}
              placeholder="You are PYXIS, a helpful and concise AI assistant..."
              style={{ ...inp, width:'100%', resize:'vertical', lineHeight:'1.6' }}/>
            <button onClick={saveProfile} disabled={saving}
              style={{ marginTop:'10px', width:'100%', padding:'10px', borderRadius:'12px', border:'none', background:'linear-gradient(135deg,#00ffa3,#00cc82)', color:'#04050a', fontWeight:700, fontSize:'13px', cursor:'pointer', opacity:saving?0.7:1 }}>
              {saving?'Saving…':'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}