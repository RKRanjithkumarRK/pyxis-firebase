import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await adminDb.doc(`users/${user.uid}/private/apikeys`).get()
  const data = doc.exists ? doc.data() || {} : {}
  // Return only which providers are configured, NOT actual keys
  const configured = Object.keys(data).filter(k => !!data[k])
  return NextResponse.json({ configured })
}

export async function POST(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, key } = await request.json()

  // Validate key format
  const prefixes: Record<string, string> = {
    openrouter: 'sk-or-',
    openai: 'sk-',
    huggingface: 'hf_',
  }
  const prefix = prefixes[provider]
  if (prefix && !key.startsWith(prefix)) {
    return NextResponse.json({ error: `Invalid ${provider} key. Should start with "${prefix}"` }, { status: 400 })
  }

  await adminDb.doc(`users/${user.uid}/private/apikeys`).set({ [provider]: key }, { merge: true })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const provider = new URL(request.url).searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'Missing provider' }, { status: 400 })

  const { FieldValue } = await import('firebase-admin/firestore')
  await adminDb.doc(`users/${user.uid}/private/apikeys`).update({
    [provider]: FieldValue.delete(),
  })
  return NextResponse.json({ success: true })
}
