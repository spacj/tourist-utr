#!/usr/bin/env node
/**
 * Seed Firestore with countries, cities, hunts, clues and hunt secrets.
 *
 *   npm run seed                  # validate, then write (upsert, `set` per doc)
 *   npm run seed -- --dry-run     # validate and print counts, write nothing
 *
 * Content lives in scripts/seed-data/ (one module per hunt); the builders,
 * cipher checks and validation rules live in scripts/seed-lib/.
 *
 * Writes go through firebase-admin, because the Firestore rules are
 * deny-by-default for clients. Credentials, in order of preference:
 *   1. FIREBASE_SERVICE_ACCOUNT — service-account JSON, raw or base64
 *      (from the environment, .env.local or .env)
 *   2. applicationDefault() — GOOGLE_APPLICATION_CREDENTIALS / gcloud login
 * --dry-run never touches credentials or the network.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { COUNTRIES, CITIES, HUNTS } from './seed-data/index.mjs'
import { validateContent } from './seed-lib/validate.mjs'

const DRY_RUN = process.argv.includes('--dry-run')

// ── .env loading (no dotenv dependency) ───────────────────────────────
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

// ── Validation (always) ───────────────────────────────────────────────
const clueCount = HUNTS.reduce((n, h) => n + h.clues.length, 0)
const { errors, stats } = validateContent({ COUNTRIES, CITIES, HUNTS })

console.log(`Content: ${COUNTRIES.length} countries, ${CITIES.length} cities, ${HUNTS.length} hunts, ${clueCount} clues.`)
console.log(`Checks:  ${stats.ciphersVerified} ciphers re-encoded ${JSON.stringify(stats.schemes ?? {})}, ` +
  `${stats.anagramsVerified} anagrams, ${stats.reversesVerified} reverses verified; ` +
  `${stats.onSite} on-site questions (${stats.onSiteFieldChecked} field-checked).`)

if (errors.length) {
  console.error(`\n✗ Validation failed with ${errors.length} error(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('✓ Validation passed.')

if (DRY_RUN) {
  for (const h of HUNTS) {
    console.log(`  ${h.id.padEnd(30)} ${String(h.clues.length).padStart(2)} stops  ${h.meta.cityId}${h.secrets ? '  (+ huntSecrets)' : ''}`)
  }
  console.log('\nDry run — nothing written.')
  process.exit(0)
}

// ── Write ─────────────────────────────────────────────────────────────
loadDotEnv('.env.local')
loadDotEnv('.env')

const { initializeApp, cert, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    if (typeof parsed.private_key === 'string') parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    return cert(parsed)
  }
  console.warn('FIREBASE_SERVICE_ACCOUNT not set — falling back to application default credentials.')
  return applicationDefault()
}

initializeApp({ credential: loadCredential(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
const db = getFirestore()

async function seed() {
  // 1. Countries
  for (const country of COUNTRIES) {
    const cityCount = CITIES.filter(c => c.countryId === country.id).length
    const huntCount = HUNTS.filter(h => CITIES.find(c => c.id === h.meta.cityId)?.countryId === country.id).length
    const { id, ...data } = country
    await db.collection('countries').doc(id).set({ ...data, cityCount, huntCount, createdAt: FieldValue.serverTimestamp() })
    console.log(`✓ country ${id}: "${country.name}" (${cityCount} cities, ${huntCount} hunts${country.comingSoon ? ' — coming soon' : ''})`)
  }

  // 2. Cities
  for (const city of CITIES) {
    const huntCount = HUNTS.filter(h => h.meta.cityId === city.id).length
    const { id, ...data } = city
    await db.collection('cities').doc(id).set({ ...data, huntCount, createdAt: FieldValue.serverTimestamp() })
    console.log(`✓ city ${id}: "${city.name}" (${huntCount} hunts${city.active === false ? ", hidden" : ""})`)
  }

  // 3. Hunts, clues and (server-only) hunt secrets
  for (const hunt of HUNTS) {
    await db.collection('hunts').doc(hunt.id).set({
      ...hunt.meta,
      clueCount: hunt.clues.length,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    })
    for (const { id, ...clueData } of hunt.clues) {
      await db.collection('hunts').doc(hunt.id).collection('clues').doc(id).set({ hint2PhotoUrl: null, ...clueData })
    }
    if (hunt.secrets) {
      await db.collection('huntSecrets').doc(hunt.id).set(hunt.secrets)
    }
    console.log(`✓ ${hunt.id}: "${hunt.meta.title}" (${hunt.clues.length} clues, order=${hunt.meta.order}${hunt.secrets ? ', + huntSecrets' : ''})`)
  }

  console.log(`\nSeeded ${COUNTRIES.length} countries, ${CITIES.length} cities, ${HUNTS.length} hunts, ${clueCount} clues.`)
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
