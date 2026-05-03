import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, 'cities'), where('active', '==', true)))
    const cities = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    return NextResponse.json(cities)
  } catch {
    return NextResponse.json([])
  }
}
