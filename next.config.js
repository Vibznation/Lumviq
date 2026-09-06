/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { appDir: true },
  async headers() {
    // Security headers applied to every response. Auth in this app is
    // Bearer-token based (Authorization header, no auth cookies), so
    // classic CSRF tokens are not applicable — see docs/security-notes.md.
    //
    // Next.js dev mode's hot-reload/react-refresh runtime relies on
    // `eval()`, which a strict `script-src 'self'` CSP blocks (causing a
    // blank screen with an EvalError in the console). Allow 'unsafe-eval'
    // only in development; production stays locked down.
    const isDev = process.env.NODE_ENV !== 'production'
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}
module.exports = nextConfig
