import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let text = ''

    if (ext === 'pdf') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse')
      const data = await pdfParse(buffer)
      text = data.text?.trim() || ''
      if (!text) return NextResponse.json({ error: 'Could not extract text from PDF. It may be scanned/image-only.' }, { status: 422 })

    } else if (ext === 'docx' || ext === 'doc') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value?.trim() || ''
      if (!text) return NextResponse.json({ error: 'Could not extract text from Word document.' }, { status: 422 })

    } else if (ext === 'xlsx' || ext === 'xls') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const lines: string[] = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) lines.push(`--- Sheet: ${sheetName} ---\n${csv}`)
      }
      text = lines.join('\n\n').trim()
      if (!text) return NextResponse.json({ error: 'Could not extract data from Excel file.' }, { status: 422 })

    } else {
      // For all other types (txt, md, csv, json, js, ts, etc.) — decode as UTF-8
      text = buffer.toString('utf-8')
    }

    // Truncate to ~100k chars to stay within model context limits
    const MAX = 100_000
    const truncated = text.length > MAX
    if (truncated) text = text.slice(0, MAX) + '\n\n[... content truncated to 100,000 characters ...]'

    return NextResponse.json({ text, truncated, chars: text.length })

  } catch (err: any) {
    console.error('[parse-file]', err)
    return NextResponse.json({ error: err.message || 'Failed to parse file' }, { status: 500 })
  }
}
