'use client'
import { useState, useEffect, useRef } from 'react'
import { auth } from '@/lib/firebase-client'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { MODELS } from '@/lib/ai-router'

type Msg = { id?:string; role:'user'|'assistant'; content:string; model?:string }
type Conv = { id:string; title:string; model:string; updatedAt:string; messageCount:number }

const MODEL_LIST = Object.entries(MODELS).map(([k,v])=>({key:k,...v}))

async function apiFetch(url: string, opts: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}`, ...opts.headers },
  })
}

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [convs, setConvs] = useState<Conv[]>([])
  const [activeId, setActiveId] = useState<string|null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('groq-llama-70b')
  const [streaming, setStreaming] = useState(false)
  const [sidebar, setSidebar] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      loadConvs()
    })
    return () => unsub()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px'
    }
  }, [input])

  const loadConvs = async () => {
    const r = await apiFetch('/api/conversations')
    if (r.ok) setConvs(await r.json())
  }

  const loadMsgs = async (convId: string) => {
    setLoadingMsgs(true)
    const r = await apiFetch(`/api/messages?convId=${convId}`)
    if (r.ok) setMsgs(await r.json())
    setLoadingMsgs(false)
  }

  const selectConv = (c: Conv) => { setActiveId(c.id); setModel(c.model); loadMsgs(c.id) }
  const newChat = () => { setActiveId(null); setMsgs([]) }

  const deleteConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await apiFetch(`/api/conversations?id=${id}`, { method:'DELETE' })
    setConvs(p => p.filter(c => c.id !== id))
    if (activeId === id) newChat()
    toast.success('Deleted')
  }

  const send = async () => {
    if (!input.trim() || streaming) return
    const text = input.trim()
    setInput('')
    setStreaming(true)
    const newMsgs: Msg[] = [...msgs, { role:'user', content:text }]
    setMsgs(newMsgs)

    // Create conv if needed
    let convId = activeId
    if (!convId) {
      const r = await apiFetch('/api/conversations', { method:'POST', body: JSON.stringify({ model }) })
      const c = await r.json()
      convId = c.id
      setActiveId(convId)
      setConvs(p => [{ id:c.id, title:'New Chat', model, updatedAt:new Date().toISOString(), messageCount:0 }, ...p])
    }

    // Save user msg
    await apiFetch('/api/messages', { method:'POST', body: JSON.stringify({ convId, content:text, role:'user' }) })

    // Stream
    setMsgs(p => [...p, { role:'assistant', content:'' }])
    try {
      const r = await apiFetch('/api/chat', {
        method:'POST',
        body: JSON.stringify({ messages: newMsgs.map(m=>({ role:m.role, content:m.content })), model, conversationId:convId })
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error) }

      const reader = r.body!.getReader()
      const dec = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = dec.decode(value).split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try { full += JSON.parse(line.slice(6)).t || '' } catch {}
          }
        }
        setMsgs(p => { const u=[...p]; u[u.length-1]={role:'assistant',content:full,model}; return u })
      }
      // Update conv title
      setConvs(p => p.map(c => c.id===convId ? {...c, title: text.slice(0,55), messageCount: c.messageCount+2 } : c))
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
      setMsgs(p => p.slice(0,-1))
    } finally { setStreaming(false) }
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const modelInfo = MODELS[model as keyof typeof MODELS]

  const S = {
    sidebar: { width: sidebar?'240px':'0', overflow:'hidden', transition:'width .25s', background:'var(--s1)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' as const, flexShrink:0 },
    sideBtn: (active:boolean) => ({ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'8px', cursor:'pointer', background: active?'var(--s2)':'transparent', border: active?'1px solid var(--b2)':'1px solid transparent', marginBottom:'2px' }),
    iconBtn: { padding:'6px', borderRadius:'8px', cursor:'pointer', background:'transparent', border:'none', color:'var(--t2)', display:'flex', alignItems:'center' },
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'var(--bg)' }}>
      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={{ padding:'12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:'linear-gradient(135deg,#00ffa3,#4d9fff)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="#04050a" strokeWidth="2.5" fill="none"/><circle cx="16" cy="16" r="3" fill="#04050a"/></svg>
          </div>
          <span style={{ fontWeight:800, fontSize:'13px', color:'#fff', letterSpacing:'1px' }}>PYXIS</span>
        </div>

        <div style={{ padding:'10px' }}>
          <button onClick={newChat} style={{ width:'100%', padding:'9px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#00ffa3,#00cc82)', color:'#04050a', fontWeight:700, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            New Chat
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 8px', paddingBottom:'8px' }}>
          {convs.map(c => (
            <div key={c.id} onClick={()=>selectConv(c)} style={S.sideBtn(activeId===c.id)}>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'12px', color: activeId===c.id?'#fff':'var(--t2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.title}</p>
                <p style={{ fontSize:'11px', color:'var(--t3)' }}>{c.messageCount} msgs</p>
              </div>
              <button onClick={e=>deleteConv(c.id,e)} style={{ ...S.iconBtn, opacity:0.5, marginLeft:'4px', flexShrink:0 }}
                onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0.5')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>

        <div style={{ borderTop:'1px solid var(--border)', padding:'8px' }}>
          <button onClick={()=>router.push('/settings')} style={{ ...S.iconBtn, width:'100%', justifyContent:'flex-start', gap:'8px', padding:'8px 10px', borderRadius:'8px', fontSize:'12px', color:'var(--t2)' }}
            onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Settings & API Keys
          </button>
          <button onClick={()=>{signOut(auth);router.push('/auth/login')}} style={{ ...S.iconBtn, width:'100%', justifyContent:'flex-start', gap:'8px', padding:'8px 10px', borderRadius:'8px', fontSize:'12px', color:'var(--t3)' }}
            onMouseEnter={e=>(e.currentTarget.style.background='var(--s2)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Sign out · {user?.email?.split('@')[0]}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', borderBottom:'1px solid var(--border)', background:'var(--s1)' }}>
          <button onClick={()=>setSidebar(!sidebar)} style={S.iconBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <select value={model} onChange={e=>setModel(e.target.value)}
            style={{ fontSize:'12px', padding:'6px 10px', borderRadius:'8px', border:'1px solid var(--b2)', background:'var(--s2)', color:'var(--text)', outline:'none', cursor:'pointer' }}>
            {MODEL_LIST.map(m=>(
              <option key={m.key} value={m.key}>{m.badge} {m.name}</option>
            ))}
          </select>
          {modelInfo && (
            <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'100px', background: modelInfo.free?'rgba(0,255,163,0.1)':'rgba(77,159,255,0.1)', color: modelInfo.free?'var(--g)':'var(--b)', border:`1px solid ${modelInfo.free?'rgba(0,255,163,0.2)':'rgba(77,159,255,0.2)'}` }}>
              {modelInfo.free ? '✓ Free' : 'Key Required'}
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 16px' }}>
          {loadingMsgs ? (
            <div style={{ display:'flex', justifyContent:'center', paddingTop:'40px' }}>
              <span className="dot" style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--t3)', display:'inline-block', margin:'0 3px' }} />
              <span className="dot" style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--t3)', display:'inline-block', margin:'0 3px' }} />
              <span className="dot" style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--t3)', display:'inline-block', margin:'0 3px' }} />
            </div>
          ) : msgs.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', paddingBottom:'80px', textAlign:'center' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'20px', background:'linear-gradient(135deg,rgba(0,255,163,0.1),rgba(77,159,255,0.1))', border:'1px solid var(--b2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'20px' }}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="url(#g)" strokeWidth="2" fill="none"/><circle cx="16" cy="16" r="3" fill="url(#g)"/><defs><linearGradient id="g" x1="4" y1="4" x2="28" y2="28"><stop stopColor="#00ffa3"/><stop offset="1" stopColor="#4d9fff"/></linearGradient></defs></svg>
              </div>
              <h2 style={{ color:'#fff', fontWeight:700, fontSize:'1.2rem', marginBottom:'8px' }}>What can I help you with?</h2>
              <p style={{ color:'var(--t2)', fontSize:'13px' }}>Using <strong style={{ color:'var(--g)' }}>{modelInfo?.name}</strong> · Switch models anytime above</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'24px', maxWidth:'380px' }}>
                {['Explain a concept', 'Write some code', 'Analyse data', 'Draft an email'].map(s=>(
                  <button key={s} onClick={()=>setInput(s)}
                    style={{ padding:'12px', borderRadius:'12px', border:'1px solid var(--b2)', background:'var(--s1)', color:'var(--t2)', fontSize:'12px', cursor:'pointer', textAlign:'left' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(0,255,163,0.3)';e.currentTarget.style.color='#fff'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--b2)';e.currentTarget.style.color='var(--t2)'}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth:'760px', margin:'0 auto' }}>
              {msgs.map((m,i)=>(
                <div key={i} className="msg-in" style={{ display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start', marginBottom:'20px' }}>
                  {m.role==='assistant' && (
                    <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'linear-gradient(135deg,#00ffa3,#4d9fff)', display:'flex', alignItems:'center', justifyContent:'center', marginRight:'10px', marginTop:'2px', flexShrink:0 }}>
                      <svg width="11" height="11" viewBox="0 0 32 32" fill="none"><path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="#04050a" strokeWidth="2.5" fill="none"/><circle cx="16" cy="16" r="3" fill="#04050a"/></svg>
                    </div>
                  )}
                  <div style={{ maxWidth:'680px' }}>
                    <div style={{ padding:'12px 16px', borderRadius: m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px', background: m.role==='user'?'linear-gradient(135deg,#0f2a1a,#0a1f2e)':'var(--s1)', border: m.role==='user'?'1px solid rgba(0,255,163,0.15)':'1px solid var(--border)', fontSize:'14px', lineHeight:'1.6' }}>
                      {m.role==='assistant' ? (
                        m.content==='' ? (
                          <div style={{ display:'flex', gap:'4px', padding:'4px 0' }}>
                            {[0,1,2].map(j=><span key={j} className="dot" style={{ width:'8px', height:'8px', borderRadius:'50%', background:'var(--g)', display:'inline-block', animationDelay:`${j*0.2}s` }}/>)}
                          </div>
                        ) : (
                          <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                        )
                      ) : (
                        <p style={{ color:'var(--text)', whiteSpace:'pre-wrap' }}>{m.content}</p>
                      )}
                    </div>
                    {m.model && m.role==='assistant' && (
                      <p style={{ fontSize:'11px', color:'var(--t3)', marginTop:'4px', marginLeft:'4px' }}>{m.model}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
          <div style={{ maxWidth:'760px', margin:'0 auto' }}>
            <div className="input-wrap" style={{ display:'flex', alignItems:'flex-end', gap:'10px', padding:'10px 14px', borderRadius:'16px', border:'1px solid var(--b2)', background:'var(--s1)', transition:'box-shadow .2s' }}>
              <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey}
                placeholder={`Message ${modelInfo?.name || 'PYXIS'}… (Shift+Enter for new line)`} rows={1}
                style={{ flex:1, background:'transparent', color:'var(--text)', resize:'none', outline:'none', border:'none', fontSize:'14px', lineHeight:'1.6', maxHeight:'180px', overflowY:'auto' }}/>
              <button onClick={send} disabled={!input.trim()||streaming}
                style={{ width:'36px', height:'36px', flexShrink:0, borderRadius:'10px', border:'none', background: streaming||!input.trim()?'var(--s2)':'linear-gradient(135deg,#00ffa3,#00cc82)', color:'#04050a', display:'flex', alignItems:'center', justifyContent:'center', cursor: input.trim()&&!streaming?'pointer':'default', opacity: input.trim()&&!streaming?1:0.4, transition:'all .2s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
            <p style={{ textAlign:'center', fontSize:'11px', color:'var(--t3)', marginTop:'6px' }}>PYXIS can make mistakes · Verify important info</p>
          </div>
        </div>
      </div>
    </div>
  )
}
