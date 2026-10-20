import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminDb, FieldValue } from '@/lib/firebaseAdmin'
import { handle, requireAdmin, readJson, id, num, oneOf, HttpError } from '@/lib/apiAuth'
import { benchSlug, spotCategoryIds, deriveSpotKind, SPOT_KINDS, type SpotKind } from '@/types'
import { getEverySpot } from '@/lib/benches'

export const dynamic = 'force-dynamic'

/** Refresh the cached pages that list or render a spot (and the sitemap) so a
 *  new/edited spot goes live immediately instead of waiting for hourly ISR. */
function revalidateSpot(kind: SpotKind, slug?: string) {
  try {
    const base = SPOT_KINDS[kind].urlBase
    revalidatePath(`/${base}`)
    revalidatePath('/sitemap.xml')
    if (slug) revalidatePath(`/${base}/${slug}`)
  } catch (e) {
    console.error('[benches] revalidate failed', e)
  }
}

const KINDS = ['bench', 'fountain'] as const

/** Optional trimmed string, bounded; empty → null. */
function optText(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') throw new HttpError(400, `invalid_${field}`)
  const s = v.trim()
  if (s.length > max) throw new HttpError(400, `invalid_${field}`)
  return s || null
}

/** Shared validation for POST + PATCH bodies. */
function parseSpotFields(body: Record<string, unknown>, kind: SpotKind) {
  const title = optText(body.title, 'title', 80)
  if (!title) throw new HttpError(400, 'title_required')
  const description = optText(body.description, 'description', 600) ?? ''
  const lat = num(body.lat, 'lat', -90, 90)
  const lng = num(body.lng, 'lng', -180, 180)
  const city = optText(body.city, 'city', 60)
  const address = optText(body.address, 'address', 120)
  const postalCode = optText(body.postalCode, 'postalCode', 16)

  let categories: unknown = body.categories
  if (categories !== undefined) {
    if (!Array.isArray(categories) || categories.length > 20 ||
        categories.some(c => typeof c !== 'string' || c.length > 40)) {
      throw new HttpError(400, 'invalid_categories')
    }
  }
  const category = typeof body.category === 'string' && body.category.length <= 40 ? body.category : undefined
  // spotCategoryIds keeps only ids that exist for this kind.
  const catIds = spotCategoryIds({ categories, category }, kind)

  return { title, description, lat, lng, city, address, postalCode, categories: catIds }
}

// GET /api/benches?kind=bench|fountain — public list (newest first).
export const GET = handle(async (req: NextRequest) => {
  const kindParam = req.nextUrl.searchParams.get('kind')
  let spots
  try {
    spots = await getEverySpot()
  } catch (e) {
    // Clients render the list directly — keep the response an array.
    console.error('[benches] list failed', e)
    return NextResponse.json([])
  }
  if (kindParam === 'bench' || kindParam === 'fountain') {
    spots = spots.filter(s => s.kind === kindParam)
  }
  return NextResponse.json(spots)
})

// POST /api/benches — create a spot (bench or fountain). Admin claim required.
export const POST = handle(async (req: NextRequest) => {
  const admin = await requireAdmin(req)
  const body = await readJson(req)
  const kind: SpotKind = body.kind === undefined ? 'bench' : oneOf(body.kind, 'kind', KINDS)
  const fields = parseSpotFields(body, kind)

  const ref = adminDb().collection('benches').doc()
  const slug = benchSlug(fields.title, ref.id)

  await ref.create({
    slug,
    kind,
    ...fields,
    createdBy: admin.uid,
    createdByEmail: admin.email?.toLowerCase() ?? null,
    createdAt: FieldValue.serverTimestamp(),
  })

  revalidateSpot(kind, slug)
  return NextResponse.json({ ok: true, id: ref.id, slug })
})

// PATCH /api/benches — update an existing spot. Admin claim required. The slug
// + kind stay fixed so existing links/SEO and its section don't change.
export const PATCH = handle(async (req: NextRequest) => {
  const admin = await requireAdmin(req)
  const body = await readJson(req)
  const spotId = id(body.id, 'id')

  const ref = adminDb().collection('benches').doc(spotId)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpError(404, 'not_found')
  const data = snap.data() ?? {}
  const kind = deriveSpotKind(data)
  const fields = parseSpotFields(body, kind)

  await ref.update({
    ...fields,
    updatedBy: admin.uid,
    updatedAt: FieldValue.serverTimestamp(),
  })

  const slug = String(data.slug ?? spotId)
  revalidateSpot(kind, slug)
  return NextResponse.json({ ok: true, id: spotId, slug })
})
