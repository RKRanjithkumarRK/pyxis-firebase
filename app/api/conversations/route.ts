/**
 * Conversations proxy — forwards to HuggingFace backend which has
 * full Firebase Admin credentials and Firestore access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

async function proxyTo(req: NextRequest, path: string, method: string, body?: object) {
  const token = req.headers.get('authorization') || ''
  const url = `${HF}/api${path}`
  const res = await fetch(url, {
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
  return proxyTo(request, '/conversations', 'GET')
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  return proxyTo(request, '/conversations', 'POST', body)
}

export async function PATCH(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  return proxyTo(request, '/conversations', 'PATCH', body)
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  return proxyTo(request, `/conversations?id=${id}`, 'DELETE')
}
