const DB_NAME = 'utr-hunt-cache'
const DB_VERSION = 1
const STORE_HUNTS = 'hunts'
const STORE_CLUES = 'clues'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_HUNTS)) {
        db.createObjectStore(STORE_HUNTS, { keyPath: 'huntId' })
      }
      if (!db.objectStoreNames.contains(STORE_CLUES)) {
        const store = db.createObjectStore(STORE_CLUES, { keyPath: 'id' })
        store.createIndex('huntId', 'huntId', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveHuntToIndexedDB(
  huntId: string,
  huntData: Record<string, unknown>,
  clues: Array<Record<string, unknown>>
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_HUNTS, STORE_CLUES], 'readwrite')

  tx.objectStore(STORE_HUNTS).put({ huntId, ...huntData, savedAt: Date.now() })

  const clueStore = tx.objectStore(STORE_CLUES)
  const index = clueStore.index('huntId')
  const existingKeys: IDBValidKey[] = []
  const cursorReq = index.openCursor(IDBKeyRange.only(huntId))
  await new Promise<void>((resolve) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        existingKeys.push(cursor.primaryKey)
        cursor.continue()
      } else {
        resolve()
      }
    }
    cursorReq.onerror = () => resolve()
  })
  existingKeys.forEach((key) => clueStore.delete(key))

  clues.forEach((clue) => {
    clueStore.put({ ...clue, huntId })
  })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadHuntFromIndexedDB(huntId: string): Promise<{
  hunt: Record<string, unknown> | null
  clues: Array<Record<string, unknown>>
} | null> {
  const db = await openDB()
  const tx = db.transaction([STORE_HUNTS, STORE_CLUES], 'readonly')

  const huntReq = tx.objectStore(STORE_HUNTS).get(huntId)
  const cluesReq = tx.objectStore(STORE_CLUES).index('huntId').getAll(IDBKeyRange.only(huntId))

  return new Promise((resolve, reject) => {
    let hunt: Record<string, unknown> | null = null
    let clues: Array<Record<string, unknown>> = []

    huntReq.onsuccess = () => { hunt = huntReq.result || null }
    huntReq.onerror = () => reject(huntReq.error)

    cluesReq.onsuccess = () => { clues = cluesReq.result || [] }
    cluesReq.onerror = () => reject(cluesReq.error)

    tx.oncomplete = () => {
      if (hunt) {
        resolve({ hunt, clues })
      } else {
        resolve(null)
      }
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearHuntFromIndexedDB(huntId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORE_HUNTS, STORE_CLUES], 'readwrite')

  tx.objectStore(STORE_HUNTS).delete(huntId)

  const clueStore = tx.objectStore(STORE_CLUES)
  const index = clueStore.index('huntId')
  const cursorReq = index.openCursor(IDBKeyRange.only(huntId))
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result
    if (cursor) {
      clueStore.delete(cursor.primaryKey)
      cursor.continue()
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
