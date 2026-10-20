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
 *     Tolerates the usual hosting-dashboard paste mistakes: surrounding
 *     quotes, escaped JSON, literal "\n" in the key, stray whitespace.
 *  2. GOOGLE_APPLICATION_CREDENTIALS / platform default credentials.
 */

export type CredentialSource = 'env-json' | 'env-base64' | 'default'

export function parseServiceAccount(raw: string): { account: Record<string, any>; source: CredentialSource } {
  let v = raw.trim()
  // A JSON string literal ("{\"type\":…}") — decode it once.
  if (v.startsWith('"') && v.endsWith('"')) {
    try { const s = JSON.parse(v); if (typeof s === 'string') v = s.trim() } catch {}
  }
  // Strip one layer of surrounding quotes added by some dashboards / .env files.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim()
  let source: CredentialSource = 'env-json'
  if (!v.startsWith('{')) {
    v = Buffer.from(v.replace(/\s+/g, ''), 'base64').toString('utf8').trim()
    source = 'env-base64'
  }
  let account: any = JSON.parse(v)
  // Double-encoded JSON ("{\"type\":...}") parses to a string the first time.
  if (typeof account === 'string') account = JSON.parse(account)
  if (typeof account.private_key === 'string') {
    account.private_key = account.private_key.replace(/\\n/g, '\n')
  }
  if (account.type !== 'service_account' || !account.private_key || !account.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not a service-account JSON')
  }
  return { account, source }
}

let credentialSource: CredentialSource = 'default'

function adminApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw && raw.trim()) {
    const { account, source } = parseServiceAccount(raw)
    credentialSource = source
    return initializeApp({
      credential: cert(account),
      projectId: account.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
  }
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
}

export function adminCredentialSource(): CredentialSource {
  adminApp()
  return credentialSource
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
