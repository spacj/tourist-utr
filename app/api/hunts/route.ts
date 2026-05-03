import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, 'hunts'), where('active', '==', true)))
    const hunts = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return NextResponse.json(hunts)
  } catch {
    return NextResponse.json([])
  }
}
