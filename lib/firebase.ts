import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

let _db: Firestore | undefined

function init(): Firestore {
  if (_db) return _db
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  _db = getFirestore()
  return _db
}

export const db = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const instance = init()
    const value = Reflect.get(instance, prop, receiver)
    if (typeof value === 'function') return value.bind(instance)
    return value
  },
})
