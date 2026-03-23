const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
]

/**
 * FastAPI backend URL.
 * Local dev:  http://localhost:8000
 * Production: set FASTAPI_URL env var to your Railway deployment URL
 */
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: false,
  experimental: { serverComponentsExternalPackages: ['firebase-admin'] },

  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },

  async rewrites() {
    return {
      /**
       * beforeFiles: checked BEFORE any file or page route.
       * This means ALL /api/* calls are proxied to FastAPI,
       * even though the old TypeScript route files still exist.
       * The existing TypeScript routes become unreachable (dead code).
       */
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${FASTAPI_URL}/api/:path*`,
        },
      ],
    }
  },
}

module.exports = nextConfig
