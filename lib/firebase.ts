import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyADOg0QLSeWOEM6rSlKpPoQnzQyplR4fX0",
  authDomain: "touristutr.firebaseapp.com",
  projectId: "touristutr",
  storageBucket: "touristutr.firebasestorage.app",
  messagingSenderId: "15098601915",
  appId: "1:15098601915:web:939d22c0f928349fa8a49e",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getFirestore(app)
