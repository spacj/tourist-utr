import { HomeClient } from './HomeClient'
import { getAllPostsMeta } from '@/lib/blog'

// Server component: pulls the 3 most recent blog posts off disk so the
// client homepage can show them in a "From the blog" strip without doing
// any runtime data fetching. Posts are filesystem-backed (content/blog/*.md)
// and Next.js statically generates this page, so the read happens at build
// time on every deploy.
export default function Home() {
  const recentPosts = getAllPostsMeta().slice(0, 3)
  return <HomeClient recentPosts={recentPosts} />
}
