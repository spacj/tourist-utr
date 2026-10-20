import 'server-only'
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

/**
 * Server-only Firebase Admin SDK. Every API route and server component reads
 * and writes Firestore through this — it bypasses security rules, which is
 * why the rules themselves can be deny-by-default for clients.
 *
 * Credentials, in order of preference:
 *  1. FIREBASE_SERVICE_ACCOUNT — the service-account JSON, raw or base64.
 *  2. GOOGLE_APPLICATION_CREDENTIALS / platform default credentials.
 */
function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    }
    return cert(parsed)
  }
  return applicationDefault()
}

function adminApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]
  return initializeApp({
    credential: loadCredential(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

let _db: Firestore | null = null
let _auth: Auth | null = null

/** Lazily initialised so `next build` doesn't need credentials. */
export function adminDb(): Firestore {
  if (!_db) _db = getFirestore(adminApp())
  return _db
}

export function adminAuth(): Auth {
  if (!_auth) _auth = getAuth(adminApp())
  return _auth
}

export { FieldValue, Timestamp }
