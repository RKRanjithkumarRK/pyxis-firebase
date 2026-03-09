import { NextRequest, NextResponse } from 'next/server'

// Judge0 Community Edition — free, no key required
const JUDGE0 = 'https://ce.judge0.com'

// Language IDs in Judge0 CE
const LANG_IDS: Record<string, number> = {
  python:     71,  // Python 3
  bash:       46,  // Bash
  shell:      46,
  sh:         46,
  typescript: 74,  // TypeScript
  ts:         74,
}

export async function POST(req: NextRequest) {
  const { language, code } = await req.json()
  const lang = (language || '').toLowerCase()
  const langId = LANG_IDS[lang]

  if (!langId) {
    return NextResponse.json({ error: `"${language}" is not executable on the server. Supported: Python, TypeScript, Bash` }, { status: 400 })
  }

  try {
    const res = await fetch(`${JUDGE0}/submissions?wait=true&base64_encoded=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_code: code, language_id: langId, stdin: '' }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`Judge0 error ${res.status}`)

    const data = await res.json()
    const stdout = (data.stdout || '').trim()
    const stderr = (data.stderr || data.compile_output || '').trim()
    const combined = [stdout, stderr].filter(Boolean).join('\n')

    return NextResponse.json({ output: combined || '(no output)' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Execution failed' }, { status: 500 })
  }
}
