import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { benchSlug, benchCategoryIds } from '@/types'
import { coerceBench } from '@/lib/benches'

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
      .map(d => coerceBench(d.id, d.data()))
      .sort((a, b) => b.createdAt - a.createdAt)
    return NextResponse.json(benches)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

// POST /api/benches — create a bench. Admin-only (verified by email allowlist).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { email, uid, title, description, category, categories, lat, lng, city, address, postalCode } = body as {
    email?: string; uid?: string; title?: string; description?: string
    category?: string; categories?: string[]; lat?: number; lng?: number
    city?: string; address?: string; postalCode?: string
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
  // Normalize to a deduped list of valid ids (defaults to ['quiet']).
  const catIds = benchCategoryIds({ categories, category })

  const ref = doc(collection(db, 'benches'))
  const slug = benchSlug(title.trim(), ref.id)

  await setDoc(ref, {
    slug,
    title: title.trim().slice(0, 80),
    description: (description ?? '').trim().slice(0, 600),
    categories: catIds,
    lat,
    lng,
    address: address?.trim()?.slice(0, 120) || null,
    postalCode: postalCode?.trim()?.slice(0, 16) || null,
    city: city?.trim()?.slice(0, 60) || null,
    createdBy: uid ?? null,
    createdByEmail: String(email).toLowerCase(),
    createdAt: serverTimestamp(),
  })

  return NextResponse.json({ ok: true, id: ref.id, slug })
}

// PATCH /api/benches — update an existing bench. Admin-only. The slug stays
// fixed so existing links and SEO pages don't break, even if the title changes.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { id, email, title, description, category, categories, lat, lng, city, address, postalCode } = body as {
    id?: string; email?: string; title?: string; description?: string
    category?: string; categories?: string[]; lat?: number; lng?: number
    city?: string; address?: string; postalCode?: string
  }

  const allow = adminEmails()
  if (!email || !allow.includes(String(email).toLowerCase())) {
    return NextResponse.json({ error: 'not_admin' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  const ref = doc(db, 'benches', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (!title?.trim()) return NextResponse.json({ error: 'title_required' }, { status: 400 })
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'location_required' }, { status: 400 })
  }
  const catIds = benchCategoryIds({ categories, category })

  await updateDoc(ref, {
    title: title.trim().slice(0, 80),
    description: (description ?? '').trim().slice(0, 600),
    categories: catIds,
    lat,
    lng,
    address: address?.trim()?.slice(0, 120) || null,
    postalCode: postalCode?.trim()?.slice(0, 16) || null,
    city: city?.trim()?.slice(0, 60) || null,
    updatedAt: serverTimestamp(),
  })

  return NextResponse.json({ ok: true, id, slug: snap.data().slug })
}
