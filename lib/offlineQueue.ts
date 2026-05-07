'use client'
/**
 * IndexedDB-backed offline write queue.
 *
 * When a POST to a write endpoint fails because the user is offline, callers
 * enqueue the request here. We replay the queue on the `online` event and on
 * `visibilitychange → visible`. Each entry tracks attempts so a permanently
 * failing request eventually gets dropped instead of looping forever.
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
  // Free-form key so callers can reconcile UI state once a request replays
  // (e.g. session-clue arrival keyed by sessionId+clueId).
  reconcileKey?: string
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

export async function enqueue(item: Omit<QueuedRequest, 'id' | 'addedAt' | 'attempts'>): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).add({
        ...item,
        addedAt: Date.now(),
        attempts: 0,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // IndexedDB blocked or unavailable — silently drop. Caller has already
    // optimistically updated UI; this just means we can't replay on reconnect.
  }
}

async function readAll(): Promise<QueuedRequest[]> {
  const db = await openDb()
  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedRequest[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items
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

let draining = false

export async function drain(onReplay?: (item: QueuedRequest, response: unknown) => void): Promise<{ replayed: number; failed: number }> {
  if (draining) return { replayed: 0, failed: 0 }
  draining = true
  let replayed = 0
  let failed = 0
  try {
    const items = await readAll().catch(() => [] as QueuedRequest[])
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        })
        if (res.ok) {
          let body: unknown = null
          try { body = await res.json() } catch {}
          onReplay?.(item, body)
          await remove(item.id)
          replayed++
          continue
        }
        // 4xx is a permanent failure — drop the item to avoid endless loops.
        if (res.status >= 400 && res.status < 500) {
          await remove(item.id)
          failed++
          continue
        }
        // 5xx — bump attempts and either retry next round or give up.
        item.attempts = (item.attempts ?? 0) + 1
        if (item.attempts >= MAX_ATTEMPTS) {
          await remove(item.id)
          failed++
        } else {
          await update(item)
        }
      } catch {
        // Still offline / fetch threw. Stop draining, try again on next signal.
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
type ReplayCallback = (item: QueuedRequest, response: unknown) => void
const replayCallbacks = new Set<ReplayCallback>()

export function onReplay(cb: ReplayCallback): () => void {
  replayCallbacks.add(cb)
  return () => { replayCallbacks.delete(cb) }
}

function broadcastReplay(item: QueuedRequest, response: unknown) {
  replayCallbacks.forEach(cb => { try { cb(item, response) } catch {} })
}

export function setupAutoDrain(): () => void {
  if (typeof window === 'undefined') return () => {}
  if (listenersInstalled) return () => {}
  listenersInstalled = true

  const tryDrain = () => {
    if (!navigator.onLine) return
    drain(broadcastReplay).catch(() => {})
  }
  window.addEventListener('online', tryDrain)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryDrain()
  })
  // Initial attempt — covers the case where the app boots already online with a queue.
  tryDrain()

  return () => {
    window.removeEventListener('online', tryDrain)
    listenersInstalled = false
  }
}
