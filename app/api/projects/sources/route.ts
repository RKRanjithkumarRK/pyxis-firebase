/**
 * Project sources proxy — forwards to HuggingFace backend.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

async function hf(token: string, path: string, method: string, body?: object) {
  const res = await fetch(`${HF}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: token },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.ok ? 200 : res.status })
}

export async function GET(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId') || ''
  return hf(request.headers.get('authorization') || '', `/projects/${projectId}/sources`, 'GET')
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { projectId, ...rest } = body
  return hf(request.headers.get('authorization') || '', `/projects/${projectId}/sources`, 'POST', rest)
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(request.url).searchParams
  const projectId = sp.get('projectId') || ''
  const sourceId = sp.get('sourceId') || ''
  return hf(request.headers.get('authorization') || '', `/projects/${projectId}/sources/${sourceId}`, 'DELETE')
}
