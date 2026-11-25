import { NextRequest } from 'next/server'
import { handle, requireAdmin, HttpError } from '@/lib/apiAuth'
import { creatorYearCsv } from '@/lib/adminData'

export const dynamic = 'force-dynamic'

/** GET /api/admin/export?year=2026 → CSV of creator earnings for that year (DAC7 base). */
export const GET = handle(async (req: NextRequest) => {
  await requireAdmin(req)
  const year = Number(req.nextUrl.searchParams.get('year'))
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw new HttpError(400, 'invalid_year')
  return new Response(await creatorYearCsv(year), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tourhunts-creator-earnings-${year}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
