import { useState, useRef, useCallback, useEffect, useReducer, Suspense } from 'react'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Code2, Play, Copy, Plus, Trash2, Loader2,
  Terminal, X, Sparkles, RefreshCw, FileCode2,
  TestTube2, Bug, BookOpen, ChevronDown, ChevronRight,
  FolderOpen, FolderClosed, RotateCcw, Zap, ArrowRight,
  Save, Square, AlignLeft, Braces, GitBranch, Send,
  LayoutGrid, Edit3, Check, PenLine,
} from 'lucide-react'
import { streamChat } from '../utils/api'
import { useWorkspace } from '../context/WorkspaceContext'
import XTerminal from '../components/XTerminal'
import toast from 'react-hot-toast'

/* ─── Extension → Monaco language ──────────────────────────── */
const EXT_LANG = {
  py:'python', js:'javascript', ts:'typescript', tsx:'typescript',
  jsx:'javascript', go:'go', rs:'rust', java:'java', cpp:'cpp',
  cc:'cpp', cs:'csharp', sql:'sql', sh:'shell', bash:'shell',
  md:'markdown', json:'json', html:'html', css:'css',
  yml:'yaml', yaml:'yaml', txt:'plaintext',
}
const langFromName = n => EXT_LANG[n.split('.').pop()?.toLowerCase()] || 'plaintext'
const extFromLang  = l => ({ python:'py', javascript:'js', typescript:'ts', go:'go', rust:'rs', java:'java', cpp:'cpp', csharp:'cs', sql:'sql', shell:'sh' }[l] || 'txt')

const FILE_ICON_COLORS = {
  py:'#4ec9b0', js:'#f7df1e', ts:'#3178c6', jsx:'#61dafb', tsx:'#61dafb',
  go:'#00add8', rs:'#f74c00', java:'#b07219', cpp:'#9c4ee4',
  md:'#519aba', json:'#cbcb41', sql:'#dad8d8', sh:'#89e051',
  html:'#e44d26', css:'#264de4',
}
const fileIconColor = name => FILE_ICON_COLORS[name.split('.').pop()?.toLowerCase()] || '#8b949e'

/* ─── Default files for a new workspace ─────────────────────── */
const DEFAULT_FILES = {
  'main.py': `# Welcome to Pyxis Code Studio\n# AI-powered development environment\n\ndef greet(name: str) -> str:\n    """Return a personalised greeting message."""\n    return f"Hello, {name}!"\n\n\ndef fibonacci(n: int) -> list[int]:\n    """Generate first n Fibonacci numbers."""\n    if n <= 0:\n        return []\n    a, b, seq = 0, 1, []\n    for _ in range(n):\n        seq.append(a)\n        a, b = b, a + b\n    return seq\n\n\nif __name__ == "__main__":\n    print(greet("World"))\n    print("Fibonacci:", fibonacci(10))\n`,
  'utils.py': `"""Utility helpers for the workspace."""\n\n\ndef chunk_list(lst: list, size: int) -> list:\n    """Split a list into equal-sized chunks."""\n    return [lst[i : i + size] for i in range(0, len(lst), size)]\n\n\ndef flatten(nested: list) -> list:\n    """Flatten a one-level nested list."""\n    return [item for sub in nested for item in sub]\n\n\ndef clamp(value: float, low: float, high: float) -> float:\n    """Clamp value between low and high."""\n    return max(low, min(value, high))\n`,
}

/* ─── Workspace localStorage helpers ───────────────────────── */
const STORAGE_KEY = 'pyxis_code_workspaces'

function makeWorkspace(name, files = DEFAULT_FILES, active = 'main.py') {
  const id = 'ws-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
  return { id, name, files, active, createdAt: Date.now(), updatedAt: Date.now() }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data?.workspaces && data?.activeId) return data
    }
  } catch {}
  // First launch — create default workspace
  const ws = makeWorkspace('My Workspace')
  return { activeId: ws.id, workspaces: { [ws.id]: ws } }
}

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

/* ─── Quick actions ─────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { id:'explain',  label:'Explain',   icon: BookOpen,  color:'#60a5fa',
    prompt: (c, f) => `Explain this code from \`${f}\` clearly:\n\n\`\`\`\n${c}\n\`\`\`` },
  { id:'refactor', label:'Refactor',  icon: RefreshCw, color:'#4ade80',
    prompt: (c, f) => `Refactor \`${f}\` for better readability and performance:\n\n\`\`\`\n${c}\n\`\`\`` },
  { id:'tests',    label:'Tests',     icon: TestTube2, color:'#a78bfa',
    prompt: (c, f) => `Write comprehensive unit tests for \`${f}\`:\n\n\`\`\`\n${c}\n\`\`\`` },
  { id:'fix',      label:'Fix Bugs',  icon: Bug,       color:'#f87171',
    prompt: (c, f) => `Find and fix all bugs in \`${f}\`:\n\n\`\`\`\n${c}\n\`\`\`` },
  { id:'docs',     label:'Add Docs',  icon: AlignLeft, color:'#fbbf24',
    prompt: (c, f) => `Add comprehensive docstrings and type hints to \`${f}\`:\n\n\`\`\`\n${c}\n\`\`\`` },
  { id:'optimize', label:'Optimize',  icon: Zap,       color:'#fb923c',
    prompt: (c, f) => `Optimize \`${f}\` for performance:\n\n\`\`\`\n${c}\n\`\`\`` },
]

/* ─── Monaco themes ──────────────────────────────────────────── */
function defineThemes(monaco) {
  monaco.editor.defineTheme('pyxis-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment',  foreground: '6A9955', fontStyle: 'italic' },
      { token: 'string',   foreground: 'CE9178' },
      { token: 'keyword',  foreground: 'C586C0' },
      { token: 'number',   foreground: 'B5CEA8' },
      { token: 'type',     foreground: '4EC9B0' },
      { token: 'class',    foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'operator', foreground: 'D4D4D4' },
    ],
    colors: {
      'editor.background':                  '#0d1117',
      'editor.foreground':                  '#e6edf3',
      'editor.lineHighlightBackground':     '#161b2288',
      'editor.lineHighlightBorder':         '#00000000',
      'editor.selectionBackground':         '#388bfd33',
      'editor.inactiveSelectionBackground': '#388bfd1a',
      'editorLineNumber.foreground':        '#30363d',
      'editorLineNumber.activeForeground':  '#8b949e',
      'editorCursor.foreground':            '#58a6ff',
      'editorWidget.background':            '#161b22',
      'editorWidget.border':                '#30363d',
      'editorSuggestWidget.background':     '#161b22',
      'editorSuggestWidget.border':         '#30363d',
      'editorSuggestWidget.foreground':     '#e6edf3',
      'editorSuggestWidget.highlightForeground': '#58a6ff',
      'editorSuggestWidget.selectedBackground':  '#388bfd22',
      'editorHoverWidget.background':       '#161b22',
      'editorHoverWidget.border':           '#30363d',
      'editorIndentGuide.background':       '#21262d',
      'editorIndentGuide.activeBackground': '#30363d',
      'editorBracketMatch.background':      '#388bfd22',
      'editorBracketMatch.border':          '#388bfd',
      'input.background':                   '#21262d',
      'input.border':                       '#30363d',
      'focusBorder':                        '#388bfd',
      'scrollbarSlider.background':         '#484f5733',
      'scrollbarSlider.hoverBackground':    '#484f5766',
      'editor.findMatchBackground':         '#f2cc6044',
      'editor.findMatchHighlightBackground':'#f2cc6022',
    },
  })

  monaco.editor.defineTheme('pyxis-light', {
    base: 'vs', inherit: true,
    rules: [
      { token: 'comment',  foreground: '6e7781', fontStyle: 'italic' },
      { token: 'string',   foreground: '0a3069' },
      { token: 'keyword',  foreground: 'cf222e' },
      { token: 'type',     foreground: '0550ae' },
      { token: 'function', foreground: '6639ba' },
      { token: 'number',   foreground: '0550ae' },
    ],
    colors: {
      'editor.background':                '#ffffff',
      'editor.foreground':                '#24292f',
      'editor.lineHighlightBackground':   '#f6f8fa',
      'editor.selectionBackground':       '#0969da22',
      'editorLineNumber.foreground':      '#8c959f',
      'editorLineNumber.activeForeground':'#24292f',
      'editorCursor.foreground':          '#0969da',
      'editorWidget.background':          '#f6f8fa',
      'editorWidget.border':              '#d0d7de',
      'focusBorder':                      '#0969da',
    },
  })
}

/* ─── AI code block component ────────────────────────────────── */
function makeComponents(onApply, clr) {
  return {
    code({ node, inline, className, children }) {
      const lang = /language-(\w+)/.exec(className || '')?.[1] || ''
      const code = String(children).replace(/\n$/, '')
      if (inline) return (
        <code style={{ background: 'rgba(110,118,129,0.15)', color: '#e6edf3', padding: '1px 6px', borderRadius: 4, fontSize: '0.82em', fontFamily: "'Fira Code', monospace" }}>{code}</code>
      )
      return (
        <div style={{ margin: '10px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #30363d' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{lang || 'code'}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { navigator.clipboard.writeText(code); toast.success('Copied!') }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid #30363d', borderRadius: 5, color: '#8b949e', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e6edf3'} onMouseLeave={e => e.currentTarget.style.color = '#8b949e'}
              >
                <Copy style={{ width: 10, height: 10 }} /> Copy
              </button>
              <button onClick={() => onApply?.(code)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#238636', color: '#fff', border: '1px solid #2ea043' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2ea043'} onMouseLeave={e => e.currentTarget.style.background = '#238636'}
              >
                <ArrowRight style={{ width: 10, height: 10 }} /> Apply
              </button>
            </div>
          </div>
          <pre style={{ margin: 0, padding: '14px 16px', overflowX: 'auto', fontSize: 12.5, fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace", background: '#0d1117', color: '#e6edf3', lineHeight: 1.65 }}>
            <code>{code}</code>
          </pre>
        </div>
      )
    },
    p:          ({ children }) => <p style={{ color: '#c9d1d9', lineHeight: 1.7, margin: '6px 0', fontSize: 13 }}>{children}</p>,
    strong:     ({ children }) => <strong style={{ color: '#e6edf3', fontWeight: 600 }}>{children}</strong>,
    h1:         ({ children }) => <h1 style={{ color: '#e6edf3', fontSize: 16, fontWeight: 700, margin: '14px 0 6px', borderBottom: '1px solid #30363d', paddingBottom: 6 }}>{children}</h1>,
    h2:         ({ children }) => <h2 style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, margin: '12px 0 5px' }}>{children}</h2>,
    h3:         ({ children }) => <h3 style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600, margin: '10px 0 4px' }}>{children}</h3>,
    ul:         ({ children }) => <ul style={{ paddingLeft: 20, margin: '6px 0', color: '#c9d1d9' }}>{children}</ul>,
    ol:         ({ children }) => <ol style={{ paddingLeft: 20, margin: '6px 0', color: '#c9d1d9' }}>{children}</ol>,
    li:         ({ children }) => <li style={{ margin: '3px 0', lineHeight: 1.6, fontSize: 13 }}>{children}</li>,
    blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #388bfd', paddingLeft: 12, margin: '8px 0', color: '#8b949e' }}>{children}</blockquote>,
    a:          ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', textDecoration: 'none' }}>{children}</a>,
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CodeStudio() {

  /* ── Workspace state (persisted) ────────────────────────────── */
  const [wsData, setWsData] = useState(loadFromStorage)

  // Auto-save on every change (debounced 600ms)
  useEffect(() => {
    const t = setTimeout(() => saveToStorage(wsData), 600)
    return () => clearTimeout(t)
  }, [wsData])

  const activeWs     = wsData.workspaces[wsData.activeId] ?? Object.values(wsData.workspaces)[0]
  const activeId     = activeWs?.id
  const wsFiles      = activeWs?.files ?? {}
  const activeFile   = activeWs?.active ?? null

  /* ── File dispatch (updates current workspace) ─────────────── */
  const fsDispatch = useCallback((action) => {
    setWsData(d => {
      const ws = d.workspaces[d.activeId]
      if (!ws) return d
      let updated
      switch (action.type) {
        case 'CREATE':
          if (ws.files[action.name]) { toast.error(`${action.name} already exists`); return d }
          updated = { ...ws, files: { ...ws.files, [action.name]: action.content ?? '' }, active: action.name, updatedAt: Date.now() }
          break
        case 'UPDATE':
          updated = { ...ws, files: { ...ws.files, [action.name]: action.content }, updatedAt: Date.now() }
          break
        case 'DELETE': {
          const f = { ...ws.files }
          delete f[action.name]
          const keys = Object.keys(f)
          updated = { ...ws, files: f, active: action.name === ws.active ? (keys[0] ?? null) : ws.active, updatedAt: Date.now() }
          break
        }
        case 'SET_ACTIVE':
          updated = { ...ws, active: action.name }
          break
        default: return d
      }
      return { ...d, workspaces: { ...d.workspaces, [d.activeId]: updated } }
    })
  }, [])

  /* ── Workspace operations ───────────────────────────────────── */
  const switchWorkspace = useCallback((id) => {
    setWsData(d => ({ ...d, activeId: id }))
    // Reset editor content — editor will re-mount via key
  }, [])

  const createWorkspace = useCallback((name) => {
    const ws = makeWorkspace(name || `Workspace ${Date.now().toString().slice(-4)}`)
    setWsData(d => ({ ...d, activeId: ws.id, workspaces: { ...d.workspaces, [ws.id]: ws } }))
    toast.success(`Created "${ws.name}"`)
  }, [])

  const renameWorkspace = useCallback((id, name) => {
    if (!name?.trim()) return
    setWsData(d => ({
      ...d,
      workspaces: { ...d.workspaces, [id]: { ...d.workspaces[id], name: name.trim(), updatedAt: Date.now() } }
    }))
  }, [])

  const deleteWorkspace = useCallback((id) => {
    setWsData(d => {
      const wsList = { ...d.workspaces }
      delete wsList[id]
      const remaining = Object.keys(wsList)
      if (remaining.length === 0) {
        // Always keep at least one — recreate default
        const def = makeWorkspace('My Workspace')
        return { activeId: def.id, workspaces: { [def.id]: def } }
      }
      return { activeId: d.activeId === id ? remaining[0] : d.activeId, workspaces: wsList }
    })
    toast.success('Workspace deleted')
  }, [])

  /* ── Editor ─────────────────────────────────────────────────── */
  const editorRef    = useRef(null)
  const monacoRef    = useRef(null)
  const [editorReady, setEditorReady] = useState(false)
  const [cursorPos,   setCursorPos]   = useState({ line: 1, col: 1 })
  const [monacoTheme, setMonacoTheme] = useState('pyxis-dark')

  // When workspace switches, reset the editor key to force remount
  const editorKey = activeId

  /* ── AI Chat ─────────────────────────────────────────────────── */
  const [messages,     setMessages]     = useState([])
  const [chatInput,    setChatInput]    = useState('')
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiPanelOpen,  setAiPanelOpen]  = useState(() => window.innerWidth >= 1100)
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const s = localStorage.getItem('cs_ai_panel_width')
    return s ? parseInt(s, 10) : 360
  })
  const [aiModel, setAiModel] = useState('gemini-2.5-flash')
  const abortRef   = useRef(null)
  const aiDragRef  = useRef(null)
  const chatEndRef = useRef(null)
  const { activeWorkspace: globalWs, addArtifact, getContextString } = useWorkspace()

  /* ── Terminal ────────────────────────────────────────────────── */
  const [termOpen,   setTermOpen]   = useState(false)
  const [termHeight, setTermHeight] = useState(() => {
    const s = localStorage.getItem('cs_term_height')
    return s ? parseInt(s, 10) : 220
  })
  const termDragRef = useRef(null)
  const [termTabs,      setTermTabs]      = useState([{ id: '1', label: 'bash' }])
  const [activeTermTab, setActiveTermTab] = useState('1')
  const termRefs = useRef({})

  /* ── Sidebar UI state ────────────────────────────────────────── */
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [wsMenuOpen,  setWsMenuOpen]  = useState(false)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const newFileRef = useRef(null)
  // Inline workspace rename
  const [renamingWsId, setRenamingWsId] = useState(null)
  const [renameVal,    setRenameVal]    = useState('')
  const renameRef = useRef(null)
  // New workspace name input
  const [showNewWs, setShowNewWs] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const newWsRef = useRef(null)

  /* ── Monaco theme sync ──────────────────────────────────────── */
  useEffect(() => {
    const read = () => {
      const t = document.documentElement.getAttribute('data-theme')
      setMonacoTheme(t === 'light' ? 'pyxis-light' : 'pyxis-dark')
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (monacoRef.current && editorReady) monacoRef.current.editor.setTheme(monacoTheme)
  }, [monacoTheme, editorReady])

  /* ── Auto-scroll chat ───────────────────────────────────────── */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  /* ── Focus helpers ──────────────────────────────────────────── */
  useEffect(() => { if (showNewFile) setTimeout(() => newFileRef.current?.focus(), 50) }, [showNewFile])
  useEffect(() => { if (showNewWs)   setTimeout(() => newWsRef.current?.focus(),   50) }, [showNewWs])
  useEffect(() => { if (renamingWsId && renameRef.current) { renameRef.current.focus(); renameRef.current.select() } }, [renamingWsId])

  /* ── Close ws menu on outside click ────────────────────────── */
  useEffect(() => {
    if (!wsMenuOpen) return
    const handler = (e) => {
      if (!e.target.closest('[data-ws-menu]')) setWsMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [wsMenuOpen])

  const activeContent = activeFile ? (wsFiles[activeFile] ?? '') : ''
  const activeLang    = activeFile ? langFromName(activeFile) : 'plaintext'

  /* ── Monaco handlers ─────────────────────────────────────────── */
  const handleBeforeMount = useCallback((monaco) => { monacoRef.current = monaco; defineThemes(monaco) }, [])
  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor; monacoRef.current = monaco; setEditorReady(true)
    editor.onDidChangeCursorPosition(e => setCursorPos({ line: e.position.lineNumber, col: e.position.column }))
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => document.getElementById('cs-run-btn')?.click())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,  () => document.getElementById('cs-save-btn')?.click())
    editor.focus()
  }, [])

  /* ── File operations ─────────────────────────────────────────── */
  const createFile = () => {
    const raw = newFileName.trim(); if (!raw) return
    const name = raw.includes('.') ? raw : `${raw}.${extFromLang(activeLang)}`
    fsDispatch({ type: 'CREATE', name, content: '' })
    setNewFileName(''); setShowNewFile(false)
  }

  const deleteFile = (name, e) => {
    e.stopPropagation()
    if (Object.keys(wsFiles).length <= 1) { toast.error('Cannot delete the last file'); return }
    fsDispatch({ type: 'DELETE', name })
    toast.success(`Deleted ${name}`)
  }

  const downloadFile = () => {
    const content = editorRef.current?.getValue() ?? activeContent
    const blob = new Blob([content], { type: 'text/plain' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: activeFile || 'code.txt' })
    a.click(); URL.revokeObjectURL(a.href); toast.success(`Downloaded ${activeFile}`)
  }

  /* ── Apply AI code ───────────────────────────────────────────── */
  const applyToEditor = useCallback((code) => {
    if (!editorRef.current) return
    const editor = editorRef.current
    const sel = editor.getSelection()
    if (sel && !sel.isEmpty()) editor.executeEdits('ai-apply', [{ range: sel, text: code }])
    else editor.setValue(code)
    if (activeFile) fsDispatch({ type: 'UPDATE', name: activeFile, content: editor.getValue() })
    editor.focus(); toast.success('Applied to editor')
  }, [activeFile, fsDispatch])

  /* ── Run code ───────────────────────────────────────────────── */
  const runCode = useCallback(() => {
    if (!activeFile) return
    const code = editorRef.current?.getValue() ?? activeContent
    const lang = activeLang === 'shell' ? 'bash' : activeLang
    setTermOpen(true)
    setTimeout(() => termRefs.current[activeTermTab]?.runCode(code, lang), 80)
  }, [activeFile, activeContent, activeLang, activeTermTab])

  /* ── AI panel drag ───────────────────────────────────────────── */
  const startAiDrag = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX, startW = aiDragRef.current
    const onMove = ev => { const n = Math.min(600, Math.max(280, startW + startX - ev.clientX)); setAiPanelWidth(n); localStorage.setItem('cs_ai_panel_width', n) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  /* ── Terminal drag ───────────────────────────────────────────── */
  const startTermDrag = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY, startH = termDragRef.current
    const onMove = ev => { const n = Math.min(600, Math.max(100, startH + startY - ev.clientY)); setTermHeight(n); localStorage.setItem('cs_term_height', n) }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [])

  /* ── AI send ─────────────────────────────────────────────────── */
  const sendMessage = useCallback((text = chatInput) => {
    if (!text.trim() || aiLoading) return
    setChatInput('')
    const fileContent = editorRef.current?.getValue() ?? activeContent
    const contextMsg  = `[File: ${activeFile} — ${activeLang}]\n\`\`\`${activeLang}\n${fileContent}\n\`\`\`\n\n${text}`
    const wsCtx = getContextString()
    const systemPrompt = `${wsCtx ? wsCtx + '\n\n---\n\n' : ''}You are an expert AI coding assistant in Pyxis Code Studio. Provide concise, production-ready code in proper markdown code blocks.`
    setMessages(p => [...p, { role: 'user', content: text }])
    setAiLoading(true)
    let full = ''
    setMessages(p => [...p, { role: 'assistant', content: '', streaming: true }])
    abortRef.current = streamChat(
      { message: contextMsg, model: aiModel, systemPrompt },
      token => { full += token; setMessages(p => { const c = [...p]; c[c.length - 1] = { role: 'assistant', content: full, streaming: true }; return c }) },
      () => {
        setAiLoading(false)
        setMessages(p => { const c = [...p]; c[c.length - 1] = { role: 'assistant', content: full, streaming: false }; return c })
        if (globalWs && full) addArtifact({ type: 'code', title: `${activeFile}: ${text.slice(0, 40)}`, content: full, source: '/code' })
      },
      err => { toast.error(err.message); setAiLoading(false); setMessages(p => p.slice(0, -1)) },
    )
  }, [chatInput, aiLoading, activeContent, activeFile, activeLang, aiModel, globalWs, addArtifact, getContextString])

  const runQuickAction = useCallback((action) => {
    const code = editorRef.current?.getValue() ?? activeContent
    sendMessage(action.prompt(code, activeFile))
  }, [activeContent, activeFile, sendMessage])

  const stopAI = () => {
    abortRef.current?.(); setAiLoading(false)
    setMessages(p => { const c = [...p]; if (c.length && c[c.length - 1].streaming) c[c.length - 1] = { ...c[c.length - 1], streaming: false }; return c })
  }

  /* ── Terminal tabs ───────────────────────────────────────────── */
  const addTermTab = useCallback(() => {
    const id = crypto.randomUUID()
    setTermTabs(prev => [...prev, { id, label: 'bash' }]); setActiveTermTab(id)
  }, [])
  const closeTermTab = useCallback((id, e) => {
    e.stopPropagation()
    setTermTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) { setTermOpen(false); return prev }
      if (activeTermTab === id) setActiveTermTab(next[next.length - 1].id)
      delete termRefs.current[id]; return next
    })
  }, [activeTermTab])

  /* ── Workspace rename helpers ────────────────────────────────── */
  const startRename = (ws) => { setRenamingWsId(ws.id); setRenameVal(ws.name) }
  const confirmRename = () => { renameWorkspace(renamingWsId, renameVal); setRenamingWsId(null) }

  const codeComponents = makeComponents(applyToEditor)

  /* ── Color scheme ────────────────────────────────────────────── */
  const isDark = monacoTheme === 'pyxis-dark'
  const clr = {
    bg0: isDark ? '#0d1117' : '#ffffff',
    bg1: isDark ? '#161b22' : '#f6f8fa',
    bg2: isDark ? '#21262d' : '#eaeef2',
    border: isDark ? '#30363d' : '#d0d7de',
    text0: isDark ? '#e6edf3' : '#24292f',
    text1: isDark ? '#c9d1d9' : '#57606a',
    text2: isDark ? '#8b949e' : '#8c959f',
    accent: isDark ? '#388bfd' : '#0969da',
    tabActive: isDark ? '#0d1117' : '#ffffff',
    tabHover: isDark ? '#1c2128' : '#eaeef2',
  }

  const wsList = Object.values(wsData.workspaces).sort((a, b) => a.createdAt - b.createdAt)
  const wsCount = wsList.length

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: clr.bg0, color: clr.text0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ══ TITLEBAR ════════════════════════════════════════════ */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${clr.border}`, background: clr.bg1, flexShrink: 0 }}>

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen(p => !p)} title="Toggle Explorer"
          style={{ height: 40, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: clr.text2, cursor: 'pointer', flexShrink: 0, borderRight: `1px solid ${clr.border}` }}
          onMouseEnter={e => { e.currentTarget.style.color = clr.text0; e.currentTarget.style.background = clr.bg2 }}
          onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
        >
          {sidebarOpen ? <FolderOpen style={{ width: 15, height: 15 }} /> : <FolderClosed style={{ width: 15, height: 15 }} />}
        </button>

        {/* File tabs */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 40, alignItems: 'stretch' }}>
          {Object.keys(wsFiles).map(name => {
            const isActive = name === activeFile
            return (
              <button key={name} onClick={() => fsDispatch({ type: 'SET_ACTIVE', name })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', flexShrink: 0, cursor: 'pointer', fontSize: 12.5, whiteSpace: 'nowrap', maxWidth: 160, background: isActive ? clr.tabActive : 'transparent', color: isActive ? clr.text0 : clr.text2, border: 'none', borderRight: `1px solid ${clr.border}`, borderBottom: isActive ? `2px solid ${clr.accent}` : '2px solid transparent', transition: 'all 0.1s', userSelect: 'none' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = clr.tabHover }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <FileCode2 style={{ width: 13, height: 13, color: fileIconColor(name), flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <span onClick={e => deleteFile(name, e)} style={{ marginLeft: 2, display: 'flex', opacity: 0.4, cursor: 'pointer', borderRadius: 3, padding: '1px 2px' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = clr.bg2 }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.background = 'transparent' }}
                >
                  <X style={{ width: 11, height: 11 }} />
                </span>
              </button>
            )
          })}
          <button onClick={() => setShowNewFile(true)} title="New file"
            style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: clr.text2, cursor: 'pointer', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = clr.text0; e.currentTarget.style.background = clr.bg2 }}
            onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', flexShrink: 0, borderLeft: `1px solid ${clr.border}` }}>
          <span style={{ fontSize: 11, color: clr.text2, fontFamily: 'monospace', padding: '2px 7px', background: clr.bg2, borderRadius: 4, border: `1px solid ${clr.border}` }}>{activeLang}</span>
          <button id="cs-save-btn" onClick={downloadFile} title="Download (Ctrl+S)"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: 'transparent', border: `1px solid ${clr.border}`, color: clr.text1 }}
            onMouseEnter={e => { e.currentTarget.style.background = clr.bg2; e.currentTarget.style.color = clr.text0 }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = clr.text1 }}
          >
            <Save style={{ width: 13, height: 13 }} /> Save
          </button>
          <button id="cs-run-btn" onClick={runCode} disabled={!activeFile} title="Run (Ctrl+Enter)"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 14px', borderRadius: 5, fontSize: 12, cursor: activeFile ? 'pointer' : 'default', background: '#238636', border: '1px solid #2ea043', color: '#fff', fontWeight: 600, opacity: !activeFile ? 0.5 : 1 }}
            onMouseEnter={e => { if (activeFile) e.currentTarget.style.background = '#2ea043' }}
            onMouseLeave={e => e.currentTarget.style.background = '#238636'}
          >
            <Play style={{ width: 13, height: 13 }} /> Run
          </button>
          <button onClick={() => setTermOpen(p => !p)} title="Terminal"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: `1px solid ${termOpen ? clr.accent : clr.border}`, background: termOpen ? `${clr.accent}18` : 'transparent', color: termOpen ? clr.accent : clr.text2 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = clr.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = termOpen ? clr.accent : clr.border}
          >
            <Terminal style={{ width: 13, height: 13 }} />
          </button>
          <button onClick={() => setAiPanelOpen(p => !p)} title="AI Copilot"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 28, borderRadius: 5, cursor: 'pointer', border: `1px solid ${aiPanelOpen ? clr.accent : clr.border}`, background: aiPanelOpen ? `${clr.accent}18` : 'transparent', color: aiPanelOpen ? clr.accent : clr.text2 }}
            onMouseEnter={e => e.currentTarget.style.borderColor = clr.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = aiPanelOpen ? clr.accent : clr.border}
          >
            <Sparkles style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* ══ NEW FILE BAR ════════════════════════════════════════ */}
      {showNewFile && (
        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${clr.border}`, background: clr.bg1, display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
          <FileCode2 style={{ width: 13, height: 13, color: clr.text2 }} />
          <input ref={newFileRef} value={newFileName} onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createFile(); if (e.key === 'Escape') { setShowNewFile(false); setNewFileName('') } }}
            placeholder="filename.py"
            style={{ flex: 1, height: 26, fontSize: 12, padding: '2px 10px', borderRadius: 5, border: `1px solid ${clr.accent}`, background: clr.bg0, color: clr.text0, outline: 'none' }}
          />
          <button onClick={createFile} style={{ padding: '3px 12px', borderRadius: 5, fontSize: 12, background: '#238636', border: '1px solid #2ea043', color: '#fff', cursor: 'pointer' }}>Create</button>
          <button onClick={() => { setShowNewFile(false); setNewFileName('') }} style={{ padding: '3px 10px', borderRadius: 5, fontSize: 12, background: 'transparent', border: `1px solid ${clr.border}`, color: clr.text1, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {/* ══ MAIN AREA ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── SIDEBAR (Explorer + Workspaces) ─────────────────── */}
        {sidebarOpen && (
          <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${clr.border}`, background: clr.bg1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── WORKSPACE SWITCHER ── */}
            <div data-ws-menu style={{ position: 'relative', flexShrink: 0 }}>

              {/* Current workspace button */}
              <button
                onClick={() => setWsMenuOpen(p => !p)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${clr.border}`, textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = clr.bg2}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 22, height: 22, borderRadius: 6, background: `${clr.accent}22`, border: `1px solid ${clr.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LayoutGrid style={{ width: 12, height: 12, color: clr.accent }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: clr.text0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeWs?.name || 'Workspace'}
                  </div>
                  <div style={{ fontSize: 10, color: clr.text2 }}>{wsCount} workspace{wsCount !== 1 ? 's' : ''}</div>
                </div>
                <ChevronDown style={{ width: 12, height: 12, color: clr.text2, flexShrink: 0, transform: wsMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>

              {/* Workspace dropdown */}
              {wsMenuOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: isDark ? '#1c2128' : '#fff', border: `1px solid ${clr.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>

                  {/* Workspace list */}
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {wsList.map(ws => (
                      <div key={ws.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: 6, cursor: 'pointer', background: ws.id === activeId ? `${clr.accent}18` : 'transparent' }}
                        onMouseEnter={e => { if (ws.id !== activeId) e.currentTarget.style.background = clr.bg2 }}
                        onMouseLeave={e => { if (ws.id !== activeId) e.currentTarget.style.background = 'transparent' }}
                      >
                        {renamingWsId === ws.id ? (
                          /* Inline rename input */
                          <input
                            ref={renameRef} value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingWsId(null) }}
                            onBlur={confirmRename}
                            style={{ flex: 1, fontSize: 12, padding: '2px 6px', border: `1px solid ${clr.accent}`, borderRadius: 4, background: clr.bg0, color: clr.text0, outline: 'none' }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }} onClick={() => { switchWorkspace(ws.id); setWsMenuOpen(false) }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {ws.id === activeId && <div style={{ width: 5, height: 5, borderRadius: '50%', background: clr.accent, flexShrink: 0 }} />}
                              <span style={{ fontSize: 12.5, color: ws.id === activeId ? clr.text0 : clr.text1, fontWeight: ws.id === activeId ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ws.name}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: clr.text2, marginLeft: ws.id === activeId ? 10 : 0 }}>
                              {Object.keys(ws.files).length} file{Object.keys(ws.files).length !== 1 ? 's' : ''} · {new Date(ws.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        )}

                        {/* Rename / Delete buttons */}
                        {renamingWsId !== ws.id && (
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button onClick={e => { e.stopPropagation(); startRename(ws) }} title="Rename"
                              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: clr.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                              onMouseEnter={e => { e.currentTarget.style.color = clr.text0; e.currentTarget.style.background = clr.bg2 }}
                              onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
                            >
                              <PenLine style={{ width: 10, height: 10 }} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); deleteWorkspace(ws.id) }} title="Delete workspace"
                              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: clr.text2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#f85149'; e.currentTarget.style.background = clr.bg2 }}
                              onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
                            >
                              <Trash2 style={{ width: 10, height: 10 }} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* New workspace form */}
                  <div style={{ borderTop: `1px solid ${clr.border}`, padding: '8px 10px' }}>
                    {showNewWs ? (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <input ref={newWsRef} value={newWsName} onChange={e => setNewWsName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { createWorkspace(newWsName); setNewWsName(''); setShowNewWs(false); setWsMenuOpen(false) } if (e.key === 'Escape') setShowNewWs(false) }}
                          placeholder="Workspace name…"
                          style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: `1px solid ${clr.accent}`, borderRadius: 5, background: clr.bg0, color: clr.text0, outline: 'none' }}
                        />
                        <button onClick={() => { createWorkspace(newWsName); setNewWsName(''); setShowNewWs(false); setWsMenuOpen(false) }}
                          style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, background: '#238636', border: '1px solid #2ea043', color: '#fff', cursor: 'pointer' }}
                        >
                          <Check style={{ width: 11, height: 11 }} />
                        </button>
                        <button onClick={() => setShowNewWs(false)}
                          style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, background: 'transparent', border: `1px solid ${clr.border}`, color: clr.text2, cursor: 'pointer' }}
                        >
                          <X style={{ width: 11, height: 11 }} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewWs(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 6, border: `1px dashed ${clr.border}`, background: 'transparent', color: clr.text2, cursor: 'pointer', fontSize: 12 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = clr.accent; e.currentTarget.style.color = clr.text0 }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = clr.border; e.currentTarget.style.color = clr.text2 }}
                      >
                        <Plus style={{ width: 13, height: 13 }} /> New Workspace
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── FILE EXPLORER ── */}
            <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ChevronDown style={{ width: 11, height: 11, color: clr.text2 }} />
                <FolderOpen style={{ width: 12, height: 12, color: '#e3b341' }} />
                <span style={{ fontSize: 11.5, color: clr.text1, fontWeight: 500 }}>{activeWs?.name || 'workspace'}</span>
              </div>
              <button onClick={() => setShowNewFile(true)} title="New file"
                style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: clr.text2, cursor: 'pointer', borderRadius: 4 }}
                onMouseEnter={e => { e.currentTarget.style.color = clr.text0; e.currentTarget.style.background = clr.bg2 }}
                onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
              >
                <Plus style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* File list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2px 4px' }}>
              {Object.keys(wsFiles).map(name => {
                const isActive = name === activeFile
                return (
                  <div key={name} onClick={() => fsDispatch({ type: 'SET_ACTIVE', name })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12.5, background: isActive ? `${clr.accent}1a` : 'transparent', color: isActive ? clr.text0 : clr.text1, marginBottom: 1, userSelect: 'none' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = clr.bg2 }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden', minWidth: 0 }}>
                      <FileCode2 style={{ width: 13, height: 13, color: fileIconColor(name), flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    </span>
                    <button onClick={e => deleteFile(name, e)}
                      style={{ opacity: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: clr.text2, padding: '1px 3px', display: 'flex', borderRadius: 3 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                    >
                      <Trash2 style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── EDITOR + TERMINAL ────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>

          {/* Breadcrumb */}
          <div style={{ height: 25, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 5, background: clr.bg0, borderBottom: `1px solid ${clr.border}`, flexShrink: 0 }}>
            <LayoutGrid style={{ width: 11, height: 11, color: clr.text2 }} />
            <span style={{ fontSize: 11, color: clr.text2 }}>{activeWs?.name || 'workspace'}</span>
            <ChevronRight style={{ width: 10, height: 10, color: clr.text2 }} />
            {activeFile && (<>
              <FileCode2 style={{ width: 11, height: 11, color: fileIconColor(activeFile) }} />
              <span style={{ fontSize: 11, color: clr.text1 }}>{activeFile}</span>
            </>)}
          </div>

          {/* Monaco Editor — key forces remount on workspace switch */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, background: clr.bg0 }}><Loader2 style={{ width: 20, height: 20, color: clr.accent }} className="animate-spin" /><span style={{ color: clr.text2, fontSize: 13 }}>Loading editor…</span></div>}>
              <Editor
                key={editorKey}
                height="100%"
                language={activeLang}
                value={activeContent}
                theme={monacoTheme}
                beforeMount={handleBeforeMount}
                onMount={handleMount}
                onChange={val => { if (activeFile) fsDispatch({ type: 'UPDATE', name: activeFile, content: val ?? '' }) }}
                options={{
                  fontSize: 13.5, fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
                  fontLigatures: true, lineHeight: 22, minimap: { enabled: true, scale: 1 },
                  scrollBeyondLastLine: false, renderLineHighlight: 'line',
                  cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on', smoothScrolling: true,
                  padding: { top: 16, bottom: 16 }, lineNumbers: 'on',
                  bracketPairColorization: { enabled: true }, guides: { bracketPairs: true, indentation: true },
                  folding: true, wordWrap: 'off', tabSize: 4, insertSpaces: true, automaticLayout: true,
                  quickSuggestions: { other: true, comments: false, strings: true },
                  suggestOnTriggerCharacters: true, tabCompletion: 'on', formatOnPaste: true,
                  autoClosingBrackets: 'always', autoClosingQuotes: 'always', linkedEditing: true,
                  occurrencesHighlight: 'singleFile', selectionHighlight: true,
                  hover: { enabled: true, delay: 400 }, parameterHints: { enabled: true },
                  inlayHints: { enabled: 'on' }, contextmenu: true, mouseWheelZoom: true,
                  multiCursorModifier: 'ctrlCmd',
                  scrollbar: { useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8, arrowSize: 0 },
                  overviewRulerBorder: false, renderValidationDecorations: 'on',
                }}
              />
            </Suspense>
          </div>

          {/* ── TERMINAL PANEL ── */}
          {termOpen && (
            <div style={{ height: termHeight, flexShrink: 0, display: 'flex', flexDirection: 'column', borderTop: `1px solid #21262d`, background: '#0d1117', overflow: 'hidden' }}>
              {/* Drag handle */}
              <div onMouseDown={e => { termDragRef.current = termHeight; startTermDrag(e) }}
                style={{ height: 5, flexShrink: 0, cursor: 'row-resize', background: 'transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = clr.accent}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              />
              {/* Tab bar */}
              <div style={{ display: 'flex', alignItems: 'stretch', background: '#0d1117', borderBottom: '1px solid #21262d', flexShrink: 0, height: 34 }}>
                <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
                  {termTabs.map((tab, idx) => {
                    const isAct = activeTermTab === tab.id
                    return (
                      <div key={tab.id} onClick={() => { setActiveTermTab(tab.id); termRefs.current[tab.id]?.focus() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 34, cursor: 'pointer', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap', userSelect: 'none', borderRight: '1px solid #21262d', background: isAct ? '#0d1117' : 'transparent', color: isAct ? '#58a6ff' : '#484f57', borderTop: isAct ? '1px solid #388bfd' : '1px solid transparent' }}
                        onMouseEnter={e => { if (!isAct) e.currentTarget.style.color = '#8b949e' }}
                        onMouseLeave={e => { if (!isAct) e.currentTarget.style.color = '#484f57' }}
                      >
                        <Terminal style={{ width: 12, height: 12 }} />
                        {tab.label} {idx + 1}
                        {termTabs.length > 1 && (
                          <button onClick={e => closeTermTab(tab.id, e)}
                            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', opacity: 0.6, marginLeft: 2 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                          >
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, padding: '0 8px', flexShrink: 0, borderLeft: '1px solid #21262d' }}>
                  <button onClick={addTermTab} title="New terminal"
                    style={{ width: 26, height: 26, background: 'transparent', border: 'none', color: '#484f57', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = '#21262d' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#484f57'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <Plus style={{ width: 13, height: 13 }} />
                  </button>
                  <button onClick={() => termRefs.current[activeTermTab]?.clear()} title="Clear"
                    style={{ padding: '2px 8px', background: 'transparent', border: 'none', color: '#484f57', cursor: 'pointer', fontSize: 11, borderRadius: 5, fontFamily: 'monospace' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = '#21262d' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#484f57'; e.currentTarget.style.background = 'transparent' }}
                  >clear</button>
                  <button onClick={() => setTermOpen(false)} title="Close"
                    style={{ width: 26, height: 26, background: 'transparent', border: 'none', color: '#484f57', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f85149'; e.currentTarget.style.background = '#21262d' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#484f57'; e.currentTarget.style.background = 'transparent' }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
              {/* Terminal bodies */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {termTabs.map(tab => (
                  <div key={tab.id} style={{ position: 'absolute', inset: 0, display: activeTermTab === tab.id ? 'block' : 'none' }}>
                    <XTerminal ref={el => { if (el) termRefs.current[tab.id] = el }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══ AI CHAT PANEL ══════════════════════════════════════ */}
        {aiPanelOpen && (
          <div style={{ width: aiPanelWidth, flexShrink: 0, borderLeft: `1px solid ${clr.border}`, background: clr.bg0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Drag handle */}
            <div onMouseDown={e => { aiDragRef.current = aiPanelWidth; startAiDrag(e) }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10, background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = clr.accent}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            />

            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${clr.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: clr.bg1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${clr.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${clr.accent}44` }}>
                  <Sparkles style={{ width: 14, height: 14, color: clr.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: clr.text0 }}>Copilot</div>
                  <div style={{ fontSize: 10.5, color: clr.text2 }}>{activeFile || 'No file open'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                  style={{ fontSize: 11, padding: '3px 6px', borderRadius: 5, border: `1px solid ${clr.border}`, backgroundColor: clr.bg2, color: clr.text1, cursor: 'pointer', outline: 'none' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-2.0-flash-lite">Gemini Lite</option>
                  <option value="liquid/lfm-2.5-1.2b-instruct:free">LFM 2.5</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3</option>
                  <option value="mistralai/mistral-small-3.1-24b-instruct:free">Mistral</option>
                </select>
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])}
                    style={{ width: 26, height: 26, background: 'transparent', border: `1px solid ${clr.border}`, borderRadius: 5, cursor: 'pointer', color: clr.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => { e.currentTarget.style.color = clr.text0; e.currentTarget.style.borderColor = clr.text1 }}
                    onMouseLeave={e => { e.currentTarget.style.color = clr.text2; e.currentTarget.style.borderColor = clr.border }}
                  >
                    <RotateCcw style={{ width: 11, height: 11 }} />
                  </button>
                )}
                {aiLoading && (
                  <button onClick={stopAI}
                    style={{ width: 26, height: 26, background: '#da3633', border: 'none', borderRadius: 5, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Square style={{ width: 10, height: 10 }} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${clr.border}`, display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0 }}>
              {QUICK_ACTIONS.map(action => {
                const Icon = action.icon
                return (
                  <button key={action.id} onClick={() => runQuickAction(action)} disabled={aiLoading || !editorReady}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: `1px solid ${clr.border}`, background: 'transparent', color: clr.text2, transition: 'all 0.12s', opacity: (aiLoading || !editorReady) ? 0.4 : 1 }}
                    onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.color = clr.text0; e.currentTarget.style.background = clr.bg2 } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = clr.border; e.currentTarget.style.color = clr.text2; e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon style={{ width: 10, height: 10, color: action.color }} /> {action.label}
                  </button>
                )
              })}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, scrollbarWidth: 'thin', scrollbarColor: `${clr.border} transparent` }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, background: `${clr.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${clr.accent}33` }}>
                    <Sparkles style={{ width: 26, height: 26, color: clr.accent }} />
                  </div>
                  <div>
                    <p style={{ color: clr.text0, fontSize: 14, fontWeight: 600, marginBottom: 5 }}>Ask Copilot</p>
                    <p style={{ color: clr.text2, fontSize: 12, lineHeight: 1.5, maxWidth: 200 }}>Full context of <strong style={{ color: clr.text1 }}>{activeFile || 'your file'}</strong> in <strong style={{ color: clr.text1 }}>{activeWs?.name}</strong></p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                    {[
                      { icon: '🔍', text: 'Explain how this code works' },
                      { icon: '🐛', text: 'Find and fix bugs' },
                      { icon: '⚡', text: 'Optimize for performance' },
                      { icon: '✅', text: 'Write unit tests' },
                    ].map(({ icon, text }) => (
                      <button key={text} onClick={() => sendMessage(text)}
                        style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12, textAlign: 'left', cursor: 'pointer', background: clr.bg1, border: `1px solid ${clr.border}`, color: clr.text1, transition: 'all 0.12s', display: 'flex', gap: 8, alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = clr.accent; e.currentTarget.style.color = clr.text0 }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = clr.border; e.currentTarget.style.color = clr.text1 }}
                      >
                        <span>{icon}</span>{text}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 10.5, color: clr.text2 }}>
                    <kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${clr.border}`, fontSize: 10, background: clr.bg1 }}>Ctrl+Enter</kbd> runs code
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                    {msg.role === 'user' ? (
                      <div style={{ maxWidth: '88%', padding: '8px 13px', borderRadius: '12px 12px 3px 12px', background: clr.accent, color: '#ffffff', fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.content}</div>
                    ) : (
                      <div style={{ maxWidth: '100%', fontSize: 12.5, color: clr.text1, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: `${clr.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles style={{ width: 10, height: 10, color: clr.accent }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: clr.text2 }}>Copilot</span>
                        </div>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={codeComponents}>{msg.content}</ReactMarkdown>
                        {msg.streaming && <span style={{ display: 'inline-block', width: 2, height: '0.85em', background: clr.accent, marginLeft: 3, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${clr.border}`, flexShrink: 0, background: clr.bg1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', background: clr.bg0, border: `1px solid ${clr.border}`, borderRadius: 10, padding: '6px 8px 6px 12px', transition: 'border-color 0.15s' }}
                onFocusCapture={e => e.currentTarget.style.borderColor = clr.accent}
                onBlurCapture={e => e.currentTarget.style.borderColor = clr.border}
              >
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Ask about your code…" disabled={aiLoading} rows={2}
                  style={{ flex: 1, resize: 'none', fontSize: 13, border: 'none', background: 'transparent', color: clr.text0, outline: 'none', fontFamily: 'inherit', lineHeight: 1.55, maxHeight: 120, overflowY: 'auto' }}
                />
                <button onClick={() => sendMessage()} disabled={!chatInput.trim() || aiLoading}
                  style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (!chatInput.trim() || aiLoading) ? clr.bg2 : clr.accent, border: 'none', cursor: (!chatInput.trim() || aiLoading) ? 'default' : 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (chatInput.trim() && !aiLoading) e.currentTarget.style.background = '#58a6ff' }}
                  onMouseLeave={e => { if (chatInput.trim() && !aiLoading) e.currentTarget.style.background = clr.accent }}
                >
                  {aiLoading
                    ? <Loader2 style={{ width: 14, height: 14, color: clr.text2 }} className="animate-spin" />
                    : <Send style={{ width: 14, height: 14, color: (!chatInput.trim() || aiLoading) ? clr.text2 : '#fff' }} />
                  }
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: clr.text2, marginTop: 5, textAlign: 'center' }}>Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        )}
      </div>

      {/* ══ STATUS BAR ══════════════════════════════════════════ */}
      <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: clr.accent, color: '#ffffffcc', fontSize: 11, flexShrink: 0, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
            <Braces style={{ width: 11, height: 11 }} /> Pyxis Studio
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.8 }}>
            <GitBranch style={{ width: 10, height: 10 }} /> main
          </span>
          {activeWs && <span style={{ opacity: 0.75 }}>📁 {activeWs.name}</span>}
          {activeFile && <span style={{ opacity: 0.75 }}>{activeFile}</span>}
          {termOpen && <span style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: 4 }}><Terminal style={{ width: 10, height: 10 }} /> Terminal</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.8 }}>
          <span>{activeLang}</span>
          <span>UTF-8</span>
          <span>Spaces: 4</span>
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #484f57; }
      `}</style>
    </div>
  )
}
