import { NextResponse } from 'next/server'
import { getAllPostsMeta } from '@/lib/blog'

/**
 * Static index of post metadata (built from content/blog at deploy time).
 * Used by the edge OG-image route, which can't read the filesystem.
 */
export const dynamic = 'force-static'

export function GET() {
  const posts = getAllPostsMeta().map(p => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category,
    readMinutes: p.readMinutes,
  }))
  return NextResponse.json(posts, { headers: { 'X-Robots-Tag': 'noindex' } })
}
