import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'
import { defaultModel } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snap = await adminDb
    .collection(`users/${user.uid}/conversations`)
    .orderBy('updatedAt', 'desc')
    .limit(50)
    .get()

  const conversations = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as any))
    .filter(c => !c.archived)
  return NextResponse.json({ conversations })
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, model, projectId } = await request.json()
  const now = new Date().toISOString()

  const ref = await adminDb.collection(`users/${user.uid}/conversations`).add({
    title: title || 'New Chat',
    model: model || defaultModel,
    createdAt: now,
    updatedAt: now,
    archived: false,
    ...(projectId ? { projectId } : {}),
  })

  return NextResponse.json({ id: ref.id })
}

export async function PATCH(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, title } = await request.json()
  if (!id || !title?.trim()) return NextResponse.json({ error: 'Missing id or title' }, { status: 400 })

  await adminDb.doc(`users/${user.uid}/conversations/${id}`).update({
    title: title.trim(),
    updatedAt: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Delete all messages
  const msgs = await adminDb.collection(`users/${user.uid}/conversations/${id}/messages`).get()
  const batch = adminDb.batch()
  msgs.docs.forEach(d => batch.delete(d.ref))
  batch.delete(adminDb.doc(`users/${user.uid}/conversations/${id}`))
  await batch.commit()

  return NextResponse.json({ success: true })
}
