import type { Metadata } from 'next'
import { BLOG_POSTS } from '@/content/blog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tourhunts.com'

export const metadata: Metadata = {
  title: 'Blog — TourHunts',
  description: 'Travel guides, city deep-dives, and walking-tour stories from the TourHunts editorial team. New posts weekly.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    title: 'TourHunts Blog — travel guides and self-guided tour stories',
    description: 'Travel guides, city deep-dives, and walking-tour stories.',
    url: `${SITE_URL}/blog`,
  },
  twitter: { card: 'summary_large_image' },
}

const CATEGORY_LABEL: Record<string, string> = {
  guides: 'Guide',
  'how-to': 'How-to',
  inspiration: 'Inspiration',
  food: 'Food',
  product: 'Product',
}

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )

  // Schema.org Blog + BlogPosting list — surfaces post titles, dates, and URLs
  // in Google rich results without exposing post bodies (full bodies live on
  // the individual post pages where they get their own Article schema).
  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'TourHunts Blog',
    url: `${SITE_URL}/blog`,
    blogPost: posts.map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      dateModified: p.updatedAt ?? p.publishedAt,
      author: { '@type': 'Organization', name: p.author },
      image: p.heroImage,
      description: p.excerpt,
    })),
  }

  return (
    <main className="page-center">
      <div className="container blog-container">
        <a href="/" className="back-link" style={{ display: 'inline-block', marginTop: 16 }}>
          ← Home
        </a>
        <header className="blog-header">
          <span className="blog-eyebrow">TourHunts Editorial</span>
          <h1 className="blog-title">Blog</h1>
          <p className="blog-subtitle">
            Travel guides, hidden city gems, and stories from the road. Each post is a starting point —
            tap any of the inline cards to jump straight into a self-guided GPS hunt.
          </p>
        </header>

        <ul className="blog-list">
          {posts.map(p => (
            <li key={p.slug} className="blog-card">
              <a href={`/blog/${p.slug}`} className="blog-card-link">
                <div className="blog-card-cover">
                  {p.heroImage && (
                    <img src={p.heroImage} alt={p.heroAlt} loading="lazy" />
                  )}
                  <span className="blog-card-cat">{CATEGORY_LABEL[p.category] ?? p.category}</span>
                </div>
                <div className="blog-card-body">
                  <h2 className="blog-card-title">{p.title}</h2>
                  <p className="blog-card-excerpt">{p.excerpt}</p>
                  <div className="blog-card-meta">
                    <time dateTime={p.publishedAt}>
                      {new Date(p.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </time>
                    <span aria-hidden> · </span>
                    <span>{p.readMinutes} min read</span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
    </main>
  )
}
