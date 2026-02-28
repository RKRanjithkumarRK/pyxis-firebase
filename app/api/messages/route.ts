import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const convId = new URL(request.url).searchParams.get('convId')
  if (!convId) return NextResponse.json({ error: 'Missing convId' }, { status: 400 })
  const snap = await adminDb
    .collection(`users/${user.uid}/conversations/${convId}/messages`)
    .orderBy('createdAt', 'asc').get()
  return NextResponse.json(snap.docs.map(d => ({ id: d.id, ...d.data() })))
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { convId, content, role } = await request.json()
  const ref = await adminDb
    .collection(`users/${user.uid}/conversations/${convId}/messages`)
    .add({ role, content, createdAt: new Date().toISOString() })
  // Update conversation title on first user message
  const conv = await adminDb.doc(`users/${user.uid}/conversations/${convId}`).get()
  const data = conv.data()
  if (data?.messageCount === 0 && role === 'user') {
    await conv.ref.update({ title: content.slice(0, 55), messageCount: 1, updatedAt: new Date().toISOString() })
  } else {
    await conv.ref.update({ messageCount: (data?.messageCount || 0) + 1, updatedAt: new Date().toISOString() })
  }
  return NextResponse.json({ id: ref.id })
}
