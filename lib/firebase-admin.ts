import { getApps, initializeApp, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

const PROJECT_ID    = (process.env.FIREBASE_PROJECT_ID   || 'pyxis-prod-e4ad9').trim()
const CLIENT_EMAIL  = (process.env.FIREBASE_CLIENT_EMAIL || '').trim()
const PRIVATE_KEY   = (process.env.FIREBASE_PRIVATE_KEY  || '').replace(/\\n/g, '\n').trim()

const hasFullCredentials = !!(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY)

function getApp(): App | null {
  try {
    if (getApps().length > 0) return getApps()[0]

    if (hasFullCredentials) {
      return initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: PRIVATE_KEY }) })
    }

    // Project-only init — enough for Firestore reads/writes via security rules,
    // but verifyIdToken falls back to JWKS path in auth-helper.ts
    return initializeApp({ projectId: PROJECT_ID })
  } catch (err) {
    console.error('[firebase-admin] initializeApp error:', err)
    return null
  }
}

let _auth: Auth | null = null
let _db: Firestore | null = null

export const adminAuth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) {
      const app = getApp()
      if (app) _auth = getAuth(app)
    }
    if (!_auth) return undefined
    return (_auth as any)[prop]
  },
})

export const adminDb = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) {
      const app = getApp()
      if (app) _db = getFirestore(app)
    }
    if (!_db) return undefined
    return (_db as any)[prop]
  },
})
