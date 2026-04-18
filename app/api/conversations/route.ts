/**
 * Conversations proxy — forwards to HuggingFace backend.
 * Adapts the Next.js frontend's request format to the HF backend's URL scheme.
 *
 * HF backend:
 *   GET    /api/conversations
 *   POST   /api/conversations
 *   PATCH  /api/conversations/{id}   ← path param
 *   DELETE /api/conversations/{id}   ← path param
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

async function hfFetch(token: string, path: string, method: string, body?: object) {
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
  const token = request.headers.get('authorization') || ''
  return hfFetch(token, '/conversations', 'GET')
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = request.headers.get('authorization') || ''
  const body = await request.json().catch(() => ({}))
  return hfFetch(token, '/conversations', 'POST', body)
}

export async function PATCH(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = request.headers.get('authorization') || ''
  const body = await request.json().catch(() => ({}))
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // HF backend: PATCH /conversations/{id}
  return hfFetch(token, `/conversations/${id}`, 'PATCH', rest)
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = request.headers.get('authorization') || ''
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // HF backend: DELETE /conversations/{id}
  return hfFetch(token, `/conversations/${id}`, 'DELETE')
}
