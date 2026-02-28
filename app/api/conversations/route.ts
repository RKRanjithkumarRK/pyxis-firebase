import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const snap = await adminDb.collection(`users/${user.uid}/conversations`)
    .orderBy('updatedAt', 'desc').limit(50).get()
  const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  return NextResponse.json(convs)
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { title, model } = await request.json()
  const now = new Date().toISOString()
  const ref = await adminDb.collection(`users/${user.uid}/conversations`).add({
    title: title || 'New Chat', model: model || 'groq-llama-70b',
    createdAt: now, updatedAt: now, messageCount: 0
  })
  // Ensure user doc exists
  await adminDb.doc(`users/${user.uid}`).set({ uid: user.uid, email: user.email }, { merge: true })
  return NextResponse.json({ id: ref.id, title: title || 'New Chat', model })
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  // Delete all messages in conversation
  const msgs = await adminDb.collection(`users/${user.uid}/conversations/${id}/messages`).get()
  const batch = adminDb.batch()
  msgs.docs.forEach(d => batch.delete(d.ref))
  batch.delete(adminDb.doc(`users/${user.uid}/conversations/${id}`))
  await batch.commit()
  return NextResponse.json({ success: true })
}
