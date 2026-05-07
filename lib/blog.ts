import fs from 'fs'
import path from 'path'
import { parseFrontmatter, extractCtas, renderMarkdown, splitByCtaMarkers, type CtaSpec, type Frontmatter } from '@/lib/md'

const POSTS_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPostMeta extends Frontmatter {
  slug: string
}

export interface BlogPost extends BlogPostMeta {
  /** HTML segments separated by where CTA cards should be rendered. */
  htmlSegments: string[]
  /** CTA specs in order — htmlSegments.length === ctas.length + 1 */
  ctas: CtaSpec[]
}

/**
 * Coerce a frontmatter record into our typed metadata shape, with sensible
 * defaults so a missing field doesn't crash the page render.
 */
function coerceMeta(slug: string, raw: Record<string, any>): BlogPostMeta {
  return {
    slug,
    title:        String(raw.title ?? slug),
    excerpt:      String(raw.excerpt ?? ''),
    publishedAt:  String(raw.publishedAt ?? new Date().toISOString().slice(0, 10)),
    updatedAt:    raw.updatedAt ? String(raw.updatedAt) : undefined,
    author:       String(raw.author ?? 'TourHunts Editorial'),
    category:     String(raw.category ?? 'guides'),
    tags:         Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    heroImage:    String(raw.heroImage ?? ''),
    heroAlt:      String(raw.heroAlt ?? ''),
    readMinutes:  Number.isFinite(raw.readMinutes) ? Number(raw.readMinutes) : 5,
    relatedCities: Array.isArray(raw.relatedCities) ? raw.relatedCities.map(String) : undefined,
    relatedHunts:  Array.isArray(raw.relatedHunts)  ? raw.relatedHunts.map(String)  : undefined,
  }
}

let _allPostsCache: BlogPostMeta[] | null = null

/** Returns metadata for every post, sorted newest-first. Cached after first call. */
export function getAllPostsMeta(): BlogPostMeta[] {
  if (_allPostsCache) return _allPostsCache
  let entries: string[] = []
  try {
    entries = fs.readdirSync(POSTS_DIR)
  } catch {
    return []
  }
  const posts: BlogPostMeta[] = []
  for (const filename of entries) {
    if (!filename.endsWith('.md')) continue
    const slug = filename.replace(/\.md$/, '')
    try {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8')
      const { meta } = parseFrontmatter(raw)
      posts.push(coerceMeta(slug, meta))
    } catch {
      // Skip unreadable files — don't crash the index.
    }
  }
  posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  _allPostsCache = posts
  return posts
}

/** Returns the full post (metadata + rendered segments + CTAs) or null. */
export function getPost(slug: string): BlogPost | null {
  const filename = `${slug}.md`
  let raw: string
  try {
    raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8')
  } catch {
    return null
  }
  const { meta, body } = parseFrontmatter(raw)
  const { body: bodyWithMarkers, ctas } = extractCtas(body)
  const html = renderMarkdown(bodyWithMarkers)
  const htmlSegments = splitByCtaMarkers(html)
  return { ...coerceMeta(slug, meta), htmlSegments, ctas }
}

export function getAllSlugs(): string[] {
  return getAllPostsMeta().map(p => p.slug)
}
