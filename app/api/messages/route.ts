/**
 * Messages proxy — forwards to HuggingFace backend which has
 * full Firebase Admin credentials and Firestore access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

async function proxyTo(req: NextRequest, path: string, method: string, body?: object) {
  const token = req.headers.get('authorization') || ''
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
  const convId = new URL(request.url).searchParams.get('conversationId')
  return proxyTo(request, `/messages?conversationId=${convId}`, 'GET')
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  return proxyTo(request, '/messages', 'POST', body)
}
