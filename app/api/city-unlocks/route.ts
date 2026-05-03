import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json([])

  try {
    const snap = await getDocs(query(collection(db, 'cityUnlocks'), where('userId', '==', userId)))
    const cityIds = snap.docs.map(d => (d.data() as { cityId: string }).cityId)
    return NextResponse.json(cityIds)
  } catch {
    return NextResponse.json([])
  }
}
