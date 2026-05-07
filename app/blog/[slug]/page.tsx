import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { BLOG_POSTS, getPostBySlug, type Block, type BlogPost } from '@/content/blog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const dynamic = 'force-static'
export const revalidate = 3600

export async function generateStaticParams() {
  return BLOG_POSTS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPostBySlug(params.slug)
  if (!post) return { title: 'Not found' }
  const url = `${SITE_URL}/blog/${post.slug}`
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      images: [{ url: post.heroImage, alt: post.heroAlt }],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.heroImage],
    },
  }
}

interface CtaTarget {
  href: string
  title: string
  description: string
  badge: string
}

async function resolveCta(block: Extract<Block, { type: 'cta' }>): Promise<CtaTarget | null> {
  const fallback = (href: string, badge: string, title: string, description: string): CtaTarget => ({
    href, badge, title, description,
  })

  if (block.kind === 'multiplayer') {
    return fallback(
      '/multiplayer',
      'Multiplayer',
      block.title ?? 'Race friends through a hunt',
      block.description ?? 'Real-time multiplayer races. First to all stops wins. First hunt in every city is free.'
    )
  }

  if (block.kind === 'tour' && block.targetId) {
    return fallback(
      `/multiplayer`,                       // tours can't deep-link to a session — entry point is the city/multiplayer page
      'Self-guided tour',
      block.title ?? 'Try this self-guided tour',
      block.description ?? 'Walk it at your own pace. GPS-guided, in-app maps, fun facts at every stop.'
    )
  }

  if (block.kind === 'hunt' && block.targetId) {
    try {
      const huntSnap = await getDoc(doc(db, 'hunts', block.targetId))
      if (huntSnap.exists()) {
        const hunt = huntSnap.data() as { title?: string; description?: string; cityId?: string }
        return fallback(
          hunt.cityId ? `/city/${hunt.cityId}#hunts` : '/',
          'Hunt',
          block.title ?? hunt.title ?? 'Try this hunt',
          block.description ?? hunt.description ?? 'GPS-guided self-guided scavenger hunt — first hunt in every city is free.'
        )
      }
    } catch {}
    return fallback('/', 'Hunt', block.title ?? 'Try a hunt', block.description ?? 'Pick a city and dive in.')
  }

  if (block.kind === 'city' && block.targetId) {
    try {
      const citySnap = await getDoc(doc(db, 'cities', block.targetId))
      if (citySnap.exists()) {
        const city = citySnap.data() as { name?: string }
        return fallback(
          `/city/${block.targetId}`,
          'City',
          block.title ?? `Explore ${city.name ?? 'this city'}`,
          block.description ?? 'First hunt is free. Lifetime access for €5.'
        )
      }
    } catch {}
    return fallback(`/city/${block.targetId}`, 'City', block.title ?? 'Explore the city', block.description ?? 'First hunt is free.')
  }

  return null
}

function renderInlineBlock(block: Block, key: number): JSX.Element | null {
  switch (block.type) {
    case 'p':
      return <p key={key} className="blog-p">{block.text}</p>
    case 'h2':
      return <h2 key={key} id={block.id} className="blog-h2">{block.text}</h2>
    case 'h3':
      return <h3 key={key} id={block.id} className="blog-h3">{block.text}</h3>
    case 'ul':
      return (
        <ul key={key} className="blog-ul">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )
    case 'ol':
      return (
        <ol key={key} className="blog-ol">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      )
    case 'quote':
      return (
        <blockquote key={key} className="blog-quote">
          <p>{block.text}</p>
          {block.cite && <cite>— {block.cite}</cite>}
        </blockquote>
      )
    case 'image':
      return (
        <figure key={key} className="blog-figure">
          <img src={block.src} alt={block.alt} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      )
    case 'divider':
      return <hr key={key} className="blog-divider" />
    case 'cta':
      // Resolved separately (async) — placeholder here.
      return null
  }
  return null
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug)
  if (!post) notFound()

  // Pre-resolve all CTA blocks server-side (one Firestore round-trip per
  // unique target) so the rendered HTML has the city/hunt name baked in
  // and search engines see the linked anchor in plain text.
  const resolvedCtas = await Promise.all(
    post.blocks.map(b => (b.type === 'cta' ? resolveCta(b) : Promise.resolve(null)))
  )

  const url = `${SITE_URL}/blog/${post.slug}`

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: [post.heroImage],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { '@type': 'Organization', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'TourHunts',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: post.tags.join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  }

  return (
    <main className="page-center">
      <article className="container blog-article">
        <a href="/blog" className="back-link" style={{ display: 'inline-block', marginTop: 16 }}>
          ← Blog
        </a>

        <header className="blog-post-header">
          <div className="blog-post-meta">
            <span className="blog-post-cat">{post.category}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
            <span aria-hidden>·</span>
            <span>{post.readMinutes} min read</span>
          </div>
          <h1 className="blog-post-title">{post.title}</h1>
          <p className="blog-post-excerpt">{post.excerpt}</p>
        </header>

        {post.heroImage && (
          <div className="blog-post-hero">
            <img src={post.heroImage} alt={post.heroAlt} />
          </div>
        )}

        <div className="blog-post-body">
          {post.blocks.map((block, i) => {
            if (block.type === 'cta') {
              const cta = resolvedCtas[i]
              if (!cta) return null
              return (
                <a key={i} href={cta.href} className="blog-cta">
                  <div className="blog-cta-content">
                    <span className="blog-cta-badge">{cta.badge}</span>
                    <div className="blog-cta-title">{cta.title}</div>
                    <div className="blog-cta-desc">{cta.description}</div>
                  </div>
                  <div className="blog-cta-arrow" aria-hidden>→</div>
                </a>
              )
            }
            return renderInlineBlock(block, i)
          })}
        </div>

        {post.tags.length > 0 && (
          <footer className="blog-post-footer">
            <div className="blog-post-tags">
              {post.tags.map(tag => (
                <span key={tag} className="blog-post-tag">#{tag}</span>
              ))}
            </div>
          </footer>
        )}
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
    </main>
  )
}
