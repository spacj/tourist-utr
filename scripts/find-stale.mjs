// Lists Firestore docs that are no longer in the seed data (stale content).
// Usage: node scripts/find-stale.mjs [--delete]
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COUNTRIES, CITIES, HUNTS } from './seed-data/index.mjs'

for (const f of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
const raw = process.env.FIREBASE_SERVICE_ACCOUNT
const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
initializeApp({ credential: cert(JSON.parse(json)) })
const db = getFirestore()
const del = process.argv.includes('--delete')

const stale = []
const check = async (col, keep) => {
  const snap = await db.collection(col).get()
  for (const d of snap.docs) if (!keep.has(d.id)) stale.push(d.ref)
}
await check('countries', new Set(COUNTRIES.map(c => c.id)))
await check('cities', new Set(CITIES.map(c => c.id)))
await check('hunts', new Set(HUNTS.map(h => h.id)))
for (const h of HUNTS) {
  const keep = new Set(h.clues.map(c => c.id))
  const snap = await db.collection('hunts').doc(h.id).collection('clues').get()
  for (const d of snap.docs) if (!keep.has(d.id)) stale.push(d.ref)
}
// Clues under hunts that no longer exist
for (const ref of stale.filter(r => r.parent.id === 'hunts')) {
  const sub = await ref.collection('clues').get()
  sub.docs.forEach(d => stale.push(d.ref))
}
console.log(stale.length ? stale.map(r => '  ' + r.path).join(String.fromCharCode(10)) : 'No stale documents.')
if (del && stale.length) {
  for (const r of stale) await r.delete()
  console.log(`Deleted ${stale.length} stale documents.`)
}
