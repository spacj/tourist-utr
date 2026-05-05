import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const countryId = req.nextUrl.searchParams.get('countryId')
  try {
    const snap = await getDocs(query(collection(db, 'cities'), where('active', '==', true)))
    let cities = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]

    // Backfill: legacy cities without a countryId default to Netherlands so
    // existing rows don't disappear from /country/nl after the migration.
    cities = cities.map(c => ({ ...c, countryId: c.countryId ?? 'nl' }))

    if (countryId) cities = cities.filter(c => c.countryId === countryId)

    cities.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    return NextResponse.json(cities)
  } catch {
    return NextResponse.json([])
  }
}
