import { FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { Auth, getAuth } from 'firebase/auth'
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore'

// Firebase client config is intentionally public — security comes from Firebase Security Rules.
// Fallback values ensure Firebase initialises even when env vars are missing at build time.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDJhw8gvbS6oRbDwZigmKeqobUmDKwyzLk',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pyxis-prod-e4ad9.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pyxis-prod-e4ad9',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pyxis-prod-e4ad9.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '656101705424',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:656101705424:web:7e48b60b6422491efa40d5',
}

export const firebaseEnabled = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

const forceLongPolling =
  (process.env.NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING || '').toLowerCase() === 'true'

if (typeof window !== 'undefined' && firebaseEnabled) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  auth = getAuth(app)
  db = forceLongPolling
    ? initializeFirestore(app, { experimentalForceLongPolling: true })
    : getFirestore(app)
}

export { app, auth, db }
export default app
