import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { BENCH_CATEGORIES, benchSlug } from '@/types'

/** Admin allowlist — server reads ADMIN_EMAILS first (private), falls back to
 *  the public NEXT_PUBLIC_ADMIN_EMAILS that the client useIsAdmin() hook uses,
 *  so a single env var keeps both in sync if you only set the public one. */
function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

// GET /api/benches — list all benches (newest first)
export async function GET() {
  try {
    const snap = await getDocs(collection(db, 'benches'))
    const benches = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => {
        const am = typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt?.toMillis?.() ?? 0)
        const bm = typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt?.toMillis?.() ?? 0)
        return bm - am
      })
    return NextResponse.json(benches)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

// POST /api/benches — create a bench. Admin-only (verified by email allowlist).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { email, uid, title, description, category, lat, lng, city } = body as {
    email?: string; uid?: string; title?: string; description?: string
    category?: string; lat?: number; lng?: number; city?: string
  }

  // ── Admin gate ──
  const allow = adminEmails()
  if (!email || !allow.includes(String(email).toLowerCase())) {
    return NextResponse.json({ error: 'not_admin' }, { status: 403 })
  }

  // ── Validate ──
  if (!title?.trim()) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'location_required' }, { status: 400 })
  }
  const catId = BENCH_CATEGORIES.some(c => c.id === category) ? category! : 'quiet'

  const ref = doc(collection(db, 'benches'))
  const slug = benchSlug(title.trim(), ref.id)

  await setDoc(ref, {
    slug,
    title: title.trim().slice(0, 80),
    description: (description ?? '').trim().slice(0, 600),
    category: catId,
    lat,
    lng,
    city: city?.trim()?.slice(0, 60) || null,
    createdBy: uid ?? null,
    createdByEmail: String(email).toLowerCase(),
    createdAt: serverTimestamp(),
  })

  return NextResponse.json({ ok: true, id: ref.id, slug })
}
