import * as crypto from 'crypto'
import { NextRequest } from 'next/server'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'pyxis-prod-e4ad9'
const CERTS_URL  = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// ── Public-cert cache (re-fetched when expired per Cache-Control) ────────────
let _certs: Record<string, string> = {}
let _certsExpiry = 0

async function fetchFirebaseCerts(): Promise<Record<string, string>> {
  if (Date.now() < _certsExpiry && Object.keys(_certs).length) return _certs
  try {
    const res = await fetch(CERTS_URL, { next: { revalidate: 3600 } })
    const cc  = res.headers.get('cache-control') || ''
    const max = parseInt(cc.match(/max-age=(\d+)/)?.[1] || '3600', 10)
    _certsExpiry = Date.now() + max * 1000
    _certs = await res.json()
  } catch (err) {
    console.warn('[auth] Failed to fetch Firebase certs:', err)
  }
  return _certs
}

// ── Pure JWKS verification — no service-account private key needed ───────────
async function verifyFirebaseJWT(token: string): Promise<Record<string, unknown>> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('invalid_jwt_structure')

  const header  = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'))
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))

  // Claims checks
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now)                                                throw new Error('token_expired')
  if (payload.aud !== PROJECT_ID)                                        throw new Error('wrong_audience')
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`)   throw new Error('wrong_issuer')

  // RSA-SHA256 signature check against Firebase public certs
  const certs = await fetchFirebaseCerts()
  const cert  = certs[header.kid]
  if (!cert) throw new Error(`unknown_kid:${header.kid}`)

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${parts[0]}.${parts[1]}`)
  const sigBuf = Buffer.from(parts[2], 'base64url')
  if (!verifier.verify(cert, sigBuf)) throw new Error('invalid_signature')

  return { uid: payload.user_id || payload.sub, ...payload }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function verifyToken(request: NextRequest): Promise<Record<string, unknown> | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  // 1. Try Firebase Admin SDK (fastest, works when FIREBASE_PRIVATE_KEY is set)
  try {
    const { adminAuth } = await import('./firebase-admin')
    if (typeof adminAuth?.verifyIdToken === 'function') {
      const decoded = await adminAuth.verifyIdToken(token)
      return decoded as unknown as Record<string, unknown>
    }
  } catch (adminErr: any) {
    // If it's a token-level error (expired, invalid) propagate it as null — don't fall through
    const tokenErrors = new Set([
      'auth/id-token-expired', 'auth/invalid-id-token', 'auth/id-token-revoked',
      'auth/user-disabled', 'auth/argument-error',
    ])
    if (tokenErrors.has(adminErr?.code)) {
      console.warn('[auth] Admin SDK token rejection:', adminErr.code)
      return null
    }
    // Otherwise it's a credential/config error → fall through to JWKS path
    console.warn('[auth] Admin SDK unavailable, falling back to JWKS:', adminErr?.message?.slice(0, 80))
  }

  // 2. JWKS fallback — verifies signature using Firebase public certs
  try {
    return await verifyFirebaseJWT(token)
  } catch (jwksErr: any) {
    console.warn('[auth] JWKS verification failed:', jwksErr?.message)
    return null
  }
}
