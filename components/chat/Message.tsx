'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import python from 'react-syntax-highlighter/dist/cjs/languages/prism/python'
import javascript from 'react-syntax-highlighter/dist/cjs/languages/prism/javascript'
import typescript from 'react-syntax-highlighter/dist/cjs/languages/prism/typescript'
import jsx from 'react-syntax-highlighter/dist/cjs/languages/prism/jsx'
import tsx from 'react-syntax-highlighter/dist/cjs/languages/prism/tsx'
import bash from 'react-syntax-highlighter/dist/cjs/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json'
import css from 'react-syntax-highlighter/dist/cjs/languages/prism/css'
import sql from 'react-syntax-highlighter/dist/cjs/languages/prism/sql'
import markdown from 'react-syntax-highlighter/dist/cjs/languages/prism/markdown'
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('jsx', jsx)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('markdown', markdown)
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Play, Loader2, Pencil } from 'lucide-react'
import { Message as MessageType } from '@/types'
import { useTheme } from '@/contexts/ThemeContext'

interface Props {
  message: MessageType
  onRegenerate?: () => void
  isLast?: boolean
  index?: number
  onEdit?: (content: string, index: number) => void
}

const RUNNABLE_LANGS = new Set(['python', 'javascript', 'js', 'typescript', 'ts', 'bash', 'shell', 'sh'])
const JS_LANGS = new Set(['javascript', 'js'])

// Run JS in a sandboxed Web Worker (no server needed)
async function runJavaScript(code: string): Promise<string> {
  return new Promise((resolve) => {
    const workerSrc = `
      const _logs=[];
      const _con={log:(...a)=>_logs.push(a.map(String).join(' ')),error:(...a)=>_logs.push('[err] '+a.map(String).join(' ')),warn:(...a)=>_logs.push('[warn] '+a.map(String).join(' '))};
      try{
        (new Function('console','Math','Date','JSON','Array','Object','String','Number','Boolean','parseInt','parseFloat','isNaN','isFinite',${JSON.stringify(code)}))(_con,Math,Date,JSON,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,isFinite);
        postMessage({ok:true,out:_logs.join('\\n')||'(no output)'});
      }catch(e){postMessage({ok:false,out:'❌ '+e.message});}
    `
    const blob = new Blob([workerSrc], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const worker = new Worker(url)
    const timer = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve('❌ Timed out (5s)') }, 5000)
    worker.onmessage = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(e.data.out) }
    worker.onerror = (e) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve('❌ ' + e.message) }
  })
}

function PyxisIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
        <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = async () => {
    const lang = language?.toLowerCase() || ''
    if (!RUNNABLE_LANGS.has(lang)) {
      setOutput(`⚠ "${language || 'unknown'}" can't be executed here.\nSupported: Python, JavaScript, TypeScript, Bash`)
      return
    }
    setIsRunning(true)
    setOutput(null)
    try {
      let result: string
      if (JS_LANGS.has(lang)) {
        // Run JavaScript in sandboxed Web Worker (instant, no API)
        result = await runJavaScript(code)
      } else {
        // Run Python / TypeScript / Bash via server-side Judge0
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang, code }),
        })
        const data = await res.json()
        result = data.error ? `❌ ${data.error}` : (data.output || '(no output)')
      }
      setOutput(result)
    } catch {
      setOutput('❌ Failed to run code')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div
      className="relative my-4 rounded-xl overflow-hidden"
      style={{ border: `1px solid var(--border)` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: isLight ? '#f5f5f5' : '#161616',
          borderBottom: isLight ? 'none' : `1px solid var(--border)`,
        }}
      >
        <div className="flex items-center gap-1.5 select-none">
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{'</>'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace', textTransform: 'capitalize' }}>
            {language || 'code'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              color: isRunning ? 'var(--accent)' : 'var(--text-tertiary)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '3px 10px',
              cursor: isRunning ? 'default' : 'pointer',
              opacity: isRunning ? 0.7 : 1,
            }}
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isRunning ? 'Running…' : 'Run'}
          </button>
        </div>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={isLight ? oneLight : oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: isLight ? '#f5f5f5' : '#1e1e1e',
          fontSize: '0.875rem',
          lineHeight: '1.6',
          padding: '1rem',
        }}
        wrapLongLines={false}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>

      {/* Output panel */}
      {(output !== null || isRunning) && (
        <div
          style={{
            background: isLight ? '#ebebeb' : '#0d0d0d',
            borderTop: `1px solid var(--border)`,
            padding: '0.6rem 1rem 0.75rem',
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            color: isLight ? '#333' : '#bbb',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isRunning ? '⏳ running…' : 'output'}
          </div>
          {isRunning ? '' : output}
        </div>
      )}
    </div>
  )
}

export default function Message({ message, onRegenerate, isLast, index, onEdit }: Props) {
  const [hovered, setHovered] = useState(false)
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<boolean | null>(null)
  const isUser = message.role === 'user'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isUser) {
    return (
      <div
        className="msg-in flex justify-end items-end gap-2 w-full max-w-3xl mx-auto px-4 py-1.5"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Edit button — appears to the left of the bubble on hover */}
        {onEdit && index !== undefined && (
          <button
            onClick={() => onEdit(message.content, index)}
            className={`p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-all ${hovered ? 'opacity-100' : 'opacity-0'}`}
            title="Edit message"
          >
            <Pencil size={14} />
          </button>
        )}
        <div className="max-w-[80%] px-5 py-3.5 rounded-3xl bg-surface text-text-primary text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
          {message.imageUrl && (
            <img src={message.imageUrl} alt="Generated" className="mt-2 rounded-xl max-w-full" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="msg-in w-full max-w-3xl mx-auto px-4 py-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex gap-4">
        <div className="shrink-0 mt-1">
          <PyxisIcon />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-[15px] leading-relaxed text-text-primary">
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    return <>{children}</>
                  },
                  code({ node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const language = match ? match[1] : ''
                    const code = String(children).replace(/\n$/, '')
                    const isBlock = code.includes('\n') || !!language

                    if (!isBlock) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[0.85em] text-text-primary"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }

                    return <CodeBlock language={language} code={code} />
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            {message.imageUrl && (
              <img src={message.imageUrl} alt="Generated" className="mt-3 rounded-2xl max-w-sm" />
            )}
          </div>

          {/* Action bar — visible on hover */}
          <div className={`flex items-center gap-0.5 mt-2 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
              title="Copy response"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
            <button
              onClick={() => setLiked(liked === true ? null : true)}
              className={`p-1.5 rounded-lg transition-colors ${liked === true ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'}`}
              title="Good response"
            >
              <ThumbsUp size={15} />
            </button>
            <button
              onClick={() => setLiked(liked === false ? null : false)}
              className={`p-1.5 rounded-lg transition-colors ${liked === false ? 'text-danger' : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover'}`}
              title="Bad response"
            >
              <ThumbsDown size={15} />
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors"
                title="Regenerate response"
              >
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
