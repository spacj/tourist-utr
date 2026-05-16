import fs from 'fs'
import path from 'path'
import { parseFrontmatter, extractCtas, extractPlaces, renderMarkdown, splitByCtaMarkers, type CtaSpec, type Frontmatter, type PlacesSpec, type BlogPostType } from '@/lib/md'

const POSTS_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPostMeta extends Frontmatter {
  slug: string
}

export interface BlogPost extends BlogPostMeta {
  /** HTML segments separated by where CTA cards should be rendered. */
  htmlSegments: string[]
  /** CTA specs in order — htmlSegments.length === ctas.length + 1 */
  ctas: CtaSpec[]
  /** Parsed `places` JSON block from a `type: places-guide` post.
   *  Null for standard posts (or if the block is missing/invalid). */
  places: PlacesSpec | null
}

/**
 * Coerce a frontmatter record into our typed metadata shape, with sensible
 * defaults so a missing field doesn't crash the page render.
 */
function coerceMeta(slug: string, raw: Record<string, any>): BlogPostMeta {
  const type: BlogPostType = raw.type === 'places-guide' ? 'places-guide' : 'standard'
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
    type,
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
  // Strip the ```places``` block first — only places-guide posts use it and
  // it must not be rendered as a fenced JSON code block in the article body.
  const { body: bodyNoPlaces, places } = extractPlaces(body)
  const { body: bodyWithMarkers, ctas } = extractCtas(bodyNoPlaces)
  const html = renderMarkdown(bodyWithMarkers)
  const htmlSegments = splitByCtaMarkers(html)
  return { ...coerceMeta(slug, meta), htmlSegments, ctas, places }
}

export function getAllSlugs(): string[] {
  return getAllPostsMeta().map(p => p.slug)
}
