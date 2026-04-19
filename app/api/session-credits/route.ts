import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')
  if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

  const snap = await getDoc(doc(db, 'sessions', sessionId))
  if (!snap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ credits: snap.data().credits })
}
