import { NextResponse } from 'next/server'
import { adminDb, adminCredentialSource } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health — deployment diagnostics without secrets: is the service
 * account present and parseable, which project does it point to, and can the
 * server read the catalogue? Use it after changing hosting env variables.
 */
export async function GET() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  const out: Record<string, unknown> = {
    serviceAccountSet: !!raw && raw.trim().length > 0,
    serviceAccountLength: raw ? raw.trim().length : 0,
    appProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  }
  try {
    out.credentialSource = adminCredentialSource()
  } catch (e) {
    // Never echo the parser message: V8 quotes the offending input (the key).
    const msg = e instanceof Error ? e.message : ''
    out.credentialError = e instanceof SyntaxError ? 'not_valid_json_or_base64'
      : msg.includes('not a service-account') ? 'json_is_not_a_service_account'
      : msg.toLowerCase().includes('private key') ? 'private_key_malformed'
      : 'credential_init_failed'
    return NextResponse.json({ ok: false, ...out }, { status: 500 })
  }
  try {
    const snap = await adminDb().collection('hunts').where('active', '==', true).limit(50).get()
    out.activeHunts = snap.size
    out.firestore = 'ok'
  } catch (e: any) {
    out.firestore = 'error'
    out.firestoreError = String(e?.code ?? '') + ' ' + String(e?.message ?? '').slice(0, 160)
    return NextResponse.json({ ok: false, ...out }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...out })
}
