import { renderOg } from '@/lib/og'

/**
 * Generated social card for posts without a hero image (/blog/<slug>/og);
 * posts with a hero use the photo. Edge runtime: @vercel/og's Node build
 * can't load its assets on Windows, and the edge build works everywhere.
 * Post data comes from the static /blog/posts.json (same deployment).
 */
export const runtime = 'edge'

type PostMeta = { slug: string; title: string; excerpt: string; category: string; readMinutes: number }

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  let post: PostMeta | undefined
  try {
    const res = await fetch(new URL('/blog/posts.json', req.url), { next: { revalidate: 3600 } })
    if (res.ok) post = ((await res.json()) as PostMeta[]).find(p => p.slug === params.slug)
  } catch {}
  if (!post) {
    return renderOg({ eyebrow: 'Blog', title: 'City guides and walking-tour stories' })
  }
  return renderOg({
    eyebrow: post.category || 'Blog',
    title: post.title,
    note: post.excerpt.length > 140 ? `${post.excerpt.slice(0, 137).trimEnd()}…` : post.excerpt,
    footer: `TourHunts blog · ${post.readMinutes} min read`,
  })
}
