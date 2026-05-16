import { Fragment } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { getAllSlugs, getPost } from '@/lib/blog'
import type { CtaSpec } from '@/lib/md'
import { PlacesGuide } from '@/components/PlacesGuide'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const dynamic = 'force-static'
export const revalidate = 3600

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPost(params.slug)
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

async function resolveCta(spec: CtaSpec): Promise<CtaTarget | null> {
  const make = (href: string, badge: string, title: string, description: string): CtaTarget => ({
    href, badge, title, description,
  })

  if (spec.kind === 'multiplayer') {
    return make(
      '/multiplayer',
      'Multiplayer',
      spec.title ?? 'Race friends through a hunt',
      spec.description ?? 'Real-time multiplayer races. First to all stops wins. First hunt in every city is free.'
    )
  }

  if (spec.kind === 'tour' && spec.targetId) {
    return make(
      '/multiplayer',
      'Self-guided tour',
      spec.title ?? 'Try this self-guided tour',
      spec.description ?? 'Walk it at your own pace. GPS-guided, in-app maps, fun facts at every stop.'
    )
  }

  if (spec.kind === 'hunt' && spec.targetId) {
    try {
      const huntSnap = await getDoc(doc(db, 'hunts', spec.targetId))
      if (huntSnap.exists()) {
        const hunt = huntSnap.data() as { title?: string; description?: string; cityId?: string }
        return make(
          hunt.cityId ? `/city/${hunt.cityId}#hunts` : '/',
          'Hunt',
          spec.title ?? hunt.title ?? 'Try this hunt',
          spec.description ?? hunt.description ?? 'GPS-guided self-guided scavenger hunt — first hunt in every city is free.'
        )
      }
    } catch {}
    return make('/', 'Hunt', spec.title ?? 'Try a hunt', spec.description ?? 'Pick a city and dive in.')
  }

  if (spec.kind === 'city' && spec.targetId) {
    try {
      const citySnap = await getDoc(doc(db, 'cities', spec.targetId))
      if (citySnap.exists()) {
        const city = citySnap.data() as { name?: string }
        return make(
          `/city/${spec.targetId}`,
          'City',
          spec.title ?? `Explore ${city.name ?? 'this city'}`,
          spec.description ?? 'First hunt is free. Lifetime access for €5.'
        )
      }
    } catch {}
    return make(`/city/${spec.targetId}`, 'City', spec.title ?? 'Explore the city', spec.description ?? 'First hunt is free.')
  }

  return null
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const resolvedCtas = await Promise.all(post.ctas.map(c => resolveCta(c)))
  const url = `${SITE_URL}/blog/${post.slug}`

  // Places-guide posts use the full-screen map layout instead of the
  // standard prose layout. We still build the CTA cards so they can be
  // inlined inside the article body that lives in the bottom sheet.
  if (post.type === 'places-guide' && post.places) {
    const ctaCards = resolvedCtas.map((cta, i) => cta && (
      <a key={i} href={cta.href} className="blog-cta">
        <div className="blog-cta-content">
          <span className="blog-cta-badge">{cta.badge}</span>
          <div className="blog-cta-title">{cta.title}</div>
          <div className="blog-cta-desc">{cta.description}</div>
        </div>
        <div className="blog-cta-arrow" aria-hidden>→</div>
      </a>
    ))
    return (
      <>
        <PlacesGuide
          title={post.title}
          excerpt={post.excerpt}
          category={post.category}
          publishedAt={post.publishedAt}
          readMinutes={post.readMinutes}
          spec={post.places}
          htmlSegments={post.htmlSegments}
          ctaCards={ctaCards}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          image: [post.heroImage].filter(Boolean),
          datePublished: post.publishedAt,
          dateModified: post.updatedAt ?? post.publishedAt,
          author: { '@type': 'Organization', name: post.author },
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          keywords: post.tags.join(', '),
        }) }} />
      </>
    )
  }

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
          {post.htmlSegments.map((html, i) => (
            <Fragment key={i}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
              {i < post.ctas.length && resolvedCtas[i] && (
                <a href={resolvedCtas[i]!.href} className="blog-cta">
                  <div className="blog-cta-content">
                    <span className="blog-cta-badge">{resolvedCtas[i]!.badge}</span>
                    <div className="blog-cta-title">{resolvedCtas[i]!.title}</div>
                    <div className="blog-cta-desc">{resolvedCtas[i]!.description}</div>
                  </div>
                  <div className="blog-cta-arrow" aria-hidden>→</div>
                </a>
              )}
            </Fragment>
          ))}
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
