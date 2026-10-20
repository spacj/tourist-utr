import { Fragment } from 'react'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminDb } from '@/lib/firebaseAdmin'
import { getAllSlugs, getPost } from '@/lib/blog'
import type { CtaSpec } from '@/lib/md'
import { SITE_URL } from '@/lib/site'
import { PlacesGuide } from '@/components/PlacesGuide'

function absUrl(u: string) {
  return /^https?:\/\//.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

/** Social image: the hero photo, or a generated card when there is none. */
function ogImageFor(post: { slug: string; heroImage: string; heroAlt: string; title: string }) {
  return post.heroImage
    ? { url: post.heroImage, alt: post.heroAlt || post.title }
    : { url: `/blog/${post.slug}/og`, width: 1200, height: 630, alt: post.title }
}

export const dynamic = 'force-static'
export const revalidate = 3600

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return { title: 'Not found', robots: { index: false } }
  const url = `${SITE_URL}/blog/${post.slug}`
  const image = ogImageFor(post)
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
      images: [image],
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [image.url],
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
      spec.description ?? 'Real-time multiplayer races. First to all stops wins. Your first hunt is free, any city.'
    )
  }

  // Hunts and tours link to their public landing page (/city/<city>/<hunt>).
  if ((spec.kind === 'tour' || spec.kind === 'hunt') && spec.targetId) {
    const isTourCta = spec.kind === 'tour'
    const badge = isTourCta ? 'Self-guided tour' : 'Hunt'
    const fallbackDesc = isTourCta
      ? 'Walk it at your own pace. GPS-guided, in-app maps, fun facts at every stop.'
      : 'GPS-guided self-guided scavenger hunt. Your first hunt is free, any hunt you like.'
    try {
      const huntSnap = await adminDb().collection('hunts').doc(spec.targetId).get()
      if (huntSnap.exists) {
        const hunt = huntSnap.data() as { title?: string; description?: string; cityId?: string }
        return make(
          hunt.cityId ? `/city/${hunt.cityId}/${spec.targetId}` : '/',
          badge,
          spec.title ?? hunt.title ?? (isTourCta ? 'Try this self-guided tour' : 'Try this hunt'),
          spec.description ?? hunt.description ?? fallbackDesc,
        )
      }
    } catch {}
    // Firestore unavailable at build: guess the city from the id convention
    // (tour_<city>_<name> / hunt_<...>_<city>) only if it's unambiguous.
    const cityGuess = spec.targetId.match(/^tour_([a-z]+)_/)?.[1]
    return make(
      cityGuess ? `/city/city_${cityGuess}/${spec.targetId}` : '/#countries',
      badge,
      spec.title ?? (isTourCta ? 'Try this self-guided tour' : 'Try a hunt'),
      spec.description ?? fallbackDesc,
    )
  }

  if (spec.kind === 'city' && spec.targetId) {
    try {
      const citySnap = await adminDb().collection('cities').doc(spec.targetId).get()
      if (citySnap.exists) {
        const city = citySnap.data() as { name?: string }
        return make(
          `/city/${spec.targetId}`,
          'City',
          spec.title ?? `Explore ${city.name ?? 'this city'}`,
          spec.description ?? 'Your first hunt is free, any hunt, any city. After that, €5 per hunt.'
        )
      }
    } catch {}
    return make(`/city/${spec.targetId}`, 'City', spec.title ?? 'Explore the city', spec.description ?? 'Your first hunt is free.')
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
          image: [absUrl(ogImageFor(post).url)],
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
    image: [absUrl(ogImageFor(post).url)],
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
          // The wrapper reserves a 16:9 box (CSS aspect-ratio), so the
          // image can't shift the layout; next/image serves sized variants.
          <div className="blog-post-hero">
            <Image
              src={post.heroImage}
              alt={post.heroAlt}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 720px"
            />
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
