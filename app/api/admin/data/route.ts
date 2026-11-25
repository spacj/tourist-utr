import { NextRequest, NextResponse } from 'next/server'
import { handle, requireAdmin, HttpError } from '@/lib/apiAuth'
import { listCreators, listDrafts, listPaymentIssues, listSales, loadOverview } from '@/lib/adminData'
import type { HuntDraftStatus } from '@/types'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store' }
const STATUSES: Array<HuntDraftStatus | 'all'> = ['all', 'draft', 'pending_review', 'approved', 'rejected', 'unpublished']

/**
 * GET /api/admin/data?view=overview|reviews|creators|sales|issues — owner
 * dashboard data. Admin claim required.
 *   overview: &days=7|30|90|365
 *   reviews:  &status=pending_review (default) | all | …
 */
export const GET = handle(async (req: NextRequest) => {
  await requireAdmin(req)
  const q = req.nextUrl.searchParams
  switch (q.get('view')) {
    case 'overview': {
      const days = [7, 30, 90, 365].includes(Number(q.get('days'))) ? Number(q.get('days')) : 30
      return NextResponse.json(await loadOverview(days), { headers })
    }
    case 'reviews': {
      const status = (STATUSES as string[]).includes(String(q.get('status'))) ? q.get('status') as HuntDraftStatus | 'all' : 'pending_review'
      return NextResponse.json({ drafts: await listDrafts(status) }, { headers })
    }
    case 'creators':
      return NextResponse.json({ creators: await listCreators() }, { headers })
    case 'sales':
      return NextResponse.json({ sales: await listSales() }, { headers })
    case 'issues':
      return NextResponse.json({ issues: await listPaymentIssues() }, { headers })
    default:
      throw new HttpError(400, 'invalid_view')
  }
})
