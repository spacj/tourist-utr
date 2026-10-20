'use client'
import { apiFetch } from '@/lib/apiFetch'

/**
 * IndexedDB-backed offline write queue.
 *
 * When a POST to a game endpoint can't reach the server, callers enqueue it
 * here. The queue replays in insertion order on the `online` event and on
 * `visibilitychange → visible`, through apiFetch (so each replay carries a
 * FRESH ID token), with an `Idempotency-Key` header. The game routes are
 * idempotent by design (an arrival / puzzle claim / quiz answer is recorded
 * once), so a replay that already landed is harmless.
 *
 * Items rejected by the server (4xx) or failing too often are dropped and
 * reported to `onDropped` listeners, so the UI can tell the player.
 */

const DB_NAME = 'tourhunts-offline'
const STORE = 'pending'
const MAX_ATTEMPTS = 6

export interface QueuedRequest {
  id: number
  url: string
  body: unknown
  addedAt: number
  attempts: number
  /** Idempotency key sent as a header; also used to de-duplicate the queue. */
  reconcileKey?: string
}

export interface DroppedRequest {
  item: QueuedRequest
  /** HTTP status (0 when it ran out of retries on server errors). */
  status: number
  /** Server error code, e.g. 'implausible_speed'. */
  code: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readAll(): Promise<QueuedRequest[]> {
  const db = await openDb()
  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedRequest[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items.sort((a, b) => a.id - b.id)
}

/**
 * Queue a POST for replay. Returns false if it couldn't be stored (IndexedDB
 * blocked) — the caller should then tell the player progress may not sync.
 * An item with the same reconcileKey already queued is not added twice.
 */
export async function enqueue(item: { url: string; body: unknown; reconcileKey?: string }): Promise<boolean> {
  try {
    if (item.reconcileKey) {
      const existing = await readAll().catch(() => [] as QueuedRequest[])
      if (existing.some(e => e.reconcileKey === item.reconcileKey)) return true
    }
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).add({ ...item, addedAt: Date.now(), attempts: 0 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    return true
  } catch {
    return false
  }
}

async function update(item: QueuedRequest): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function remove(id: number): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

type ReplayCallback = (item: QueuedRequest, response: unknown) => void
type DropCallback = (d: DroppedRequest) => void
const replayCallbacks = new Set<ReplayCallback>()
const dropCallbacks = new Set<DropCallback>()

/** Called after each successful replay with the server's JSON reply. */
export function onReplay(cb: ReplayCallback): () => void {
  replayCallbacks.add(cb)
  return () => { replayCallbacks.delete(cb) }
}

/** Called when a queued request is dropped (rejected by the server or out of retries). */
export function onDropped(cb: DropCallback): () => void {
  dropCallbacks.add(cb)
  return () => { dropCallbacks.delete(cb) }
}

let draining = false

export async function drain(): Promise<{ replayed: number; failed: number }> {
  if (draining) return { replayed: 0, failed: 0 }
  draining = true
  let replayed = 0
  let failed = 0
  try {
    const items = await readAll().catch(() => [] as QueuedRequest[])
    for (const item of items) {
      let res: Response
      try {
        const headers: Record<string, string> = {}
        if (item.reconcileKey) headers['Idempotency-Key'] = item.reconcileKey
        res = await apiFetch(item.url, { method: 'POST', headers, body: JSON.stringify(item.body) })
      } catch {
        // Still offline. Stop and try again on the next signal.
        break
      }
      let data: any = null
      try { data = await res.json() } catch {}
      if (res.ok) {
        replayCallbacks.forEach(cb => { try { cb(item, data) } catch {} })
        await remove(item.id).catch(() => {})
        replayed++
        continue
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        await remove(item.id).catch(() => {})
        failed++
        const d: DroppedRequest = { item, status: res.status, code: data?.error ?? `http_${res.status}` }
        dropCallbacks.forEach(cb => { try { cb(d) } catch {} })
        continue
      }
      item.attempts = (item.attempts ?? 0) + 1
      if (item.attempts >= MAX_ATTEMPTS) {
        await remove(item.id).catch(() => {})
        failed++
        const d: DroppedRequest = { item, status: 0, code: data?.error ?? 'server_error' }
        dropCallbacks.forEach(cb => { try { cb(d) } catch {} })
      } else {
        await update(item).catch(() => {})
        // Keep order: later items may depend on this one (next stop's arrival).
        break
      }
    }
  } finally {
    draining = false
  }
  return { replayed, failed }
}

export async function pendingCount(): Promise<number> {
  try {
    return (await readAll()).length
  } catch { return 0 }
}

let listenersInstalled = false

export function setupAutoDrain(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (listenersInstalled) return () => {}
  listenersInstalled = true

  const tryDrain = () => {
    if (!navigator.onLine) return
    drain().catch(() => {})
  }
  const onVisible = () => { if (document.visibilityState === 'visible') tryDrain() }
  window.addEventListener('online', tryDrain)
  document.addEventListener('visibilitychange', onVisible)
  tryDrain()

  return () => {
    window.removeEventListener('online', tryDrain)
    document.removeEventListener('visibilitychange', onVisible)
    listenersInstalled = false
  }
}
