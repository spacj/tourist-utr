import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const snap = await getDocs(query(collection(db, 'hunts'), where('active', '==', true)))
    const hunts = snap.docs.map(d => {
      const data = d.data() as Record<string, any>
      // Never ship the mystery solution to the client — it would let players
      // skip the deduction. The accusation is validated server-side (/api/accuse).
      if (data.mystery?.solution) {
        data.mystery = { ...data.mystery, solution: undefined }
      }
      return { id: d.id, ...data }
    })
    return NextResponse.json(hunts)
  } catch {
    return NextResponse.json([])
  }
}
