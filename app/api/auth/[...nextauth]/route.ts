import { handlers } from '@/lib/auth'

/**
 * NextAuth.js v5 App Router route handler.
 *
 * All auth-related HTTP traffic (sign-in, sign-out, session, CSRF, callbacks)
 * is forwarded to NextAuth through this single catch-all segment.
 *
 * Both GET and POST must be exported for NextAuth to operate correctly:
 *   GET  – session retrieval, OAuth redirects, CSRF token
 *   POST – sign-in / sign-out form submissions
 */
export const { GET, POST } = handlers
