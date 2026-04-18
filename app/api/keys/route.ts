/**
 * Keys proxy — forwards to HuggingFace backend which has
 * full Firebase Admin credentials and Firestore access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

async function proxy(req: NextRequest, method: string, body?: object, qs = '') {
  const token = req.headers.get('authorization') || ''
  const res = await fetch(`${HF}/api/keys${qs}`, {
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
  return proxy(request, 'GET')
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  return proxy(request, 'POST', body)
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // HF backend expects provider in JSON body, not query param
  const provider = new URL(request.url).searchParams.get('provider')
    || (await request.json().catch(() => ({}))).provider
    || ''
  return proxy(request, 'DELETE', { provider })
}
