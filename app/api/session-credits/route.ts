import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session')
  if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

  const snap = await db.collection('sessions').doc(sessionId).get()
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ credits: snap.data()!.credits })
}
