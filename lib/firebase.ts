import { initializeApp, getApps } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

/**
 * On the client, enable IndexedDB persistence so onSnapshot listeners and
 * getDoc reads return cached data even when the app boots offline. This is
 * what makes the "Resume race" banner show up correctly when the user opens
 * the app from a cold start without network — userActiveRooms / players
 * snapshots replay from cache.
 *
 * On the server (API routes, server components), there's no IndexedDB and
 * we just use the default Firestore instance.
 *
 * initializeFirestore must be called before any getFirestore(app) — once
 * it's been initialized (HMR, multiple imports), we fall back to the
 * existing instance.
 */
function makeDb(): Firestore {
  if (typeof window === 'undefined') {
    return getFirestore(app)
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    // Already initialized (e.g. HMR re-import) or the browser doesn't support
    // the required APIs — fall back to the default cached instance.
    return getFirestore(app)
  }
}

export const db = makeDb()
