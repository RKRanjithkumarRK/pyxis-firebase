/**
 * Guest session — proxy to HuggingFace backend which has Firebase Admin creds.
 * Note: Firebase anonymous sign-in (firebaseSignInAnonymously) is tried first
 * in AuthContext.tsx — this endpoint is only the fallback.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const HF = process.env.BACKEND_URL || 'https://ranjith00743-pyxis-one-backend.hf.space'

export async function POST() {
  try {
    const res = await fetch(`${HF}/api/guest`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (err: any) {
    console.error('[guest-proxy] error:', err?.message)
    return NextResponse.json({ error: 'Guest session unavailable' }, { status: 500 })
  }
}
