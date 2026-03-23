/**
 * XTerminal — interactive PTY terminal via WebSocket + xterm.js
 *
 * Exposed via ref:
 *   ref.current.runCode(code, language)  — run code in the PTY
 *   ref.current.clear()                  — clear the screen
 */
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { auth } from '../firebase'

const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host  = window.location.hostname
  const port  = import.meta.env.DEV ? '8000' : (window.location.port || (proto === 'wss' ? '443' : '80'))
  return `${proto}://${host}:${port}/ws/terminal`
})()

const XTerminal = forwardRef(function XTerminal(_, ref) {
  const containerRef = useRef(null)
  const termRef      = useRef(null)
  const fitRef       = useRef(null)
  const wsRef        = useRef(null)
  const reconnTimer  = useRef(null)

  /* ── Send raw bytes to PTY ──────────────────────────────────────── */
  const sendBytes = useCallback((data) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data instanceof Uint8Array ? data : new TextEncoder().encode(data))
    }
  }, [])

  /* ── Send JSON control message ───────────────────────────────────── */
  const sendJSON = useCallback((obj) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }, [])

  /* ── Exposed API ─────────────────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    runCode(code, language) {
      sendJSON({ type: 'run_code', code, language })
    },
    clear() {
      termRef.current?.clear()
    },
    focus() {
      termRef.current?.focus()
    },
  }), [sendJSON])

  /* ── Connect WebSocket ───────────────────────────────────────────── */
  const connect = useCallback(async () => {
    if (!containerRef.current || !termRef.current) return
    const term = termRef.current
    term.writeln('\x1b[90mConnecting to terminal…\x1b[0m')

    try {
      const token = (await auth.currentUser?.getIdToken()) ?? ''
      const { cols, rows } = term
      const url = `${WS_URL}?token=${encodeURIComponent(token)}&cols=${cols}&rows=${rows}`
      const ws  = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen  = () => { term.clear() }
      ws.onmessage = (ev) => {
        term.write(
          ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : ev.data
        )
      }
      ws.onclose = (ev) => {
        if (ev.code !== 1000 && ev.code !== 4001) {
          term.writeln('\r\n\x1b[90m[disconnected — reconnecting in 3 s…]\x1b[0m')
          reconnTimer.current = setTimeout(connect, 3000)
        } else {
          term.writeln('\r\n\x1b[90m[session closed]\x1b[0m')
        }
      }
      ws.onerror = () => term.writeln('\r\n\x1b[31m[connection error]\x1b[0m')
    } catch (err) {
      term.writeln(`\r\n\x1b[31m[error: ${err.message}]\x1b[0m`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Mount terminal once ─────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background:    '#0a0a0b',
        foreground:    '#d4d4d4',
        cursor:        '#a78bfa',
        cursorAccent:  '#0a0a0b',
        selectionBackground: 'rgba(167,139,250,0.3)',
        black:         '#18181b', red:     '#f87171',
        green:         '#4ade80', yellow:  '#fbbf24',
        blue:          '#60a5fa', magenta: '#c084fc',
        cyan:          '#22d3ee', white:   '#d4d4d4',
        brightBlack:   '#52525b', brightRed:     '#f87171',
        brightGreen:   '#4ade80', brightYellow:  '#fde68a',
        brightBlue:    '#93c5fd', brightMagenta: '#e879f9',
        brightCyan:    '#67e8f9', brightWhite:   '#f4f4f5',
      },
      fontFamily:   "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      fontSize:     13,
      lineHeight:   1.4,
      cursorBlink:  true,
      cursorStyle:  'block',
      scrollback:   5000,
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current  = fit

    // Keystrokes → server
    term.onData((data) => sendBytes(data))

    connect()

    // Resize observer → fit + notify server
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        const { cols, rows } = term
        sendJSON({ type: 'resize', cols, rows })
      } catch {}
    })
    ro.observe(containerRef.current)

    return () => {
      clearTimeout(reconnTimer.current)
      ro.disconnect()
      wsRef.current?.close(1000)
      term.dispose()
      termRef.current = null
      wsRef.current   = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '2px 0' }}
    />
  )
})

export default XTerminal
