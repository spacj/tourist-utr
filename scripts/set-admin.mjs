#!/usr/bin/env node
/**
 * Grant (or revoke) the `admin: true` custom claim on a Firebase user.
 *
 *   npm run set-admin -- you@example.com           # grant
 *   npm run set-admin -- you@example.com --revoke  # revoke
 *
 * Reads FIREBASE_SERVICE_ACCOUNT (raw JSON or base64) and
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID from the environment, .env.local or .env.
 * The user must sign out and back in (or wait ≤1h) for the claim to apply.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function loadDotEnv(file) {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadDotEnv('.env.local')
loadDotEnv('.env')

const args = process.argv.slice(2)
const email = args.find(a => !a.startsWith('--'))
const revoke = args.includes('--revoke')
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error('Usage: npm run set-admin -- <email> [--revoke]')
  process.exit(1)
}

function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) return applicationDefault()
  const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(json)
  if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
  return cert(parsed)
}

try {
  initializeApp({ credential: credential(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
  const auth = getAuth()
  const user = await auth.getUserByEmail(email)
  const claims = { ...(user.customClaims ?? {}) }
  if (revoke) delete claims.admin
  else claims.admin = true
  await auth.setCustomUserClaims(user.uid, claims)
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin for ${email} (uid ${user.uid}). Sign out and back in to refresh the token.`)
  process.exit(0)
} catch (e) {
  console.error('Failed:', e?.message ?? e)
  process.exit(1)
}
