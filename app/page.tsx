import type { Metadata } from 'next'
import { HomeClient } from './HomeClient'
import { getAllPostsMeta } from '@/lib/blog'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

// Server component: pulls the 3 most recent blog posts off disk so the
// client homepage can show them without any runtime data fetching. Posts are
// filesystem-backed (content/blog/*.md), read at build time on every deploy.
// The home page's photographs live in public/images/places (credits.json).
export default function Home() {
  const recentPosts = getAllPostsMeta().slice(0, 3)
  return <HomeClient recentPosts={recentPosts} />
}
