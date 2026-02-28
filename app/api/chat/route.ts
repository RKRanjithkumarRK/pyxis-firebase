import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-helper'
import { adminDb } from '@/lib/firebase-admin'
import { streamChat, MODELS } from '@/lib/ai-router'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, model, conversationId } = await request.json()
    if (!messages || !model) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Get user's API keys from Firestore
    const keysDoc = await adminDb.doc(`users/${user.uid}/private/apikeys`).get()
    const userKeys = keysDoc.exists ? keysDoc.data() || {} : {}

    // Get user's system prompt
    const profileDoc = await adminDb.doc(`users/${user.uid}`).get()
    const systemPrompt = profileDoc.data()?.systemPrompt || 'You are PYXIS, a helpful, accurate, and concise AI assistant.'

    const stream = await streamChat(messages, model, systemPrompt, userKeys)
    const [forClient, forSave] = stream.tee()

    // Save assistant reply in background
    ;(async () => {
      try {
        if (!conversationId) return
        let full = ''
        const reader = forSave.getReader()
        const dec = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = dec.decode(value).split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try { full += JSON.parse(line.slice(6)).t || '' } catch {}
            }
          }
        }
        if (full) {
          const modelName = MODELS[model as keyof typeof MODELS]?.name || model
          await adminDb.collection(`users/${user.uid}/conversations/${conversationId}/messages`).add({
            role: 'assistant', content: full, model: modelName,
            createdAt: new Date().toISOString()
          })
          await adminDb.doc(`users/${user.uid}/conversations/${conversationId}`).update({
            updatedAt: new Date().toISOString()
          })
        }
      } catch {}
    })()

    return new NextResponse(forClient, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
