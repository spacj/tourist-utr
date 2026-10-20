const { execSync } = require('child_process')

/**
 * Build id for cache-busting the service worker: the SW is registered as
 * /sw.js?v=<id> and names its caches after it, so every deploy installs a
 * fresh worker and drops the previous build's caches. Git sha when available
 * (stable across rebuilds of the same commit), plus a timestamp fallback.
 */
function buildId() {
  if (process.env.NEXT_PUBLIC_BUILD_ID) return process.env.NEXT_PUBLIC_BUILD_ID
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA
  if (fromEnv) return fromEnv.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      + '-' + Date.now().toString(36)
  } catch {
    return Date.now().toString(36)
  }
}

const BUILD_ID = buildId()
// Pin it for build worker processes, which re-evaluate this file.
process.env.NEXT_PUBLIC_BUILD_ID = BUILD_ID

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  images: {
    // Hosts that content actually uses (blog heroes, city covers, bench photos).
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  async headers() {
    return [
      {
        // Always revalidate the worker script so updates are picked up promptly.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
