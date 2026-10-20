import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Game screens (session-bound, would spoil clues), personal pages,
        // multiplayer rooms, admin forms and the API. `/multiplayer` itself
        // (the public entry page) stays crawlable.
        disallow: [
          '/api/',
          '/hunt',
          '/tour',
          '/profile',
          '/multiplayer/',
          '/benches/add',
          '/benches/edit',
          '/fountains/add',
          '/fountains/edit',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
