// Uploads daily-blog-workflow.json to an n8n instance via its public API.
// Needs N8N_URL (e.g. https://you.app.n8n.cloud) and N8N_API_KEY
// (n8n → Settings → n8n API → Create an API key) in .env.local or the env.
//
//   node automation/n8n/upload.mjs           create (or update the same-named workflow)
import { readFileSync } from 'node:fs'

for (const f of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {}
}
const base = (process.env.N8N_URL || '').replace(/\/+$/, '')
const key = process.env.N8N_API_KEY
if (!base || !key) {
  console.error('Set N8N_URL and N8N_API_KEY in .env.local first.')
  process.exit(1)
}

const wf = JSON.parse(readFileSync(new URL('./daily-blog-workflow.json', import.meta.url), 'utf8'))
// The API accepts only these fields; credentials are picked in the editor
// afterwards (their ids differ per instance).
const payload = {
  name: wf.name,
  nodes: wf.nodes.map(({ credentials, ...n }) => n),
  connections: wf.connections,
  settings: wf.settings,
}

const api = async (method, path, body) => {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`)
  return data
}

const existing = (await api('GET', `/workflows?limit=250`)).data?.find(w => w.name === payload.name)
const saved = existing
  ? await api('PUT', `/workflows/${existing.id}`, payload)
  : await api('POST', '/workflows', payload)
console.log(`${existing ? 'Updated' : 'Created'} "${saved.name}" → ${base}/workflow/${saved.id}`)
console.log('Next: open it, select the 3 credentials in the HTTP nodes, run once, then set it Active.')
