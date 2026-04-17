import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The decoded JWT payload that withAuth injects into the handler context.
 * It mirrors the fields written in the `jwt` callback inside `lib/auth.ts`.
 */
export interface AuthToken {
  id: string
  email: string
  name?: string | null
  role: Role
}

/**
 * Options accepted by `withAuth`.
 */
export interface WithAuthOptions {
  /**
   * When provided, only users whose `role` matches one of the listed values
   * will be allowed through. Everyone else receives a 403 Forbidden response.
   *
   * @example requiredRoles: ['ADMIN']
   */
  requiredRoles?: Role[]
}

/**
 * A Next.js App Router route handler that also receives the decoded token.
 */
export type AuthenticatedHandler = (
  req: NextRequest,
  context: { params?: Record<string, string | string[]>; token: AuthToken },
) => Promise<NextResponse | Response>

// ---------------------------------------------------------------------------
// Helper – build a standardised JSON error response
// ---------------------------------------------------------------------------

function jsonError(status: 401 | 403, message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
        message,
      },
    },
    { status },
  )
}

// ---------------------------------------------------------------------------
// withAuth – HOF that wraps an App Router handler with auth enforcement
// ---------------------------------------------------------------------------

/**
 * Higher-order function that wraps a Next.js App Router route handler with
 * JWT authentication and optional role-based access control (RBAC).
 *
 * Usage:
 * ```ts
 * // Any authenticated user
 * export const GET = withAuth(async (req, { token }) => { ... })
 *
 * // ADMIN only
 * export const POST = withAuth(
 *   async (req, { token }) => { ... },
 *   { requiredRoles: ['ADMIN'] }
 * )
 * ```
 *
 * Responses:
 *   401 – No valid JWT present (user is not authenticated)
 *   403 – Valid JWT but role is not in `requiredRoles`
 */
export function withAuth(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {},
): (
  req: NextRequest,
  context?: { params?: Record<string, string | string[]> },
) => Promise<NextResponse | Response> {
  return async (req, context = {}) => {
    // -----------------------------------------------------------------------
    // 1. Extract and decode the JWT
    // -----------------------------------------------------------------------
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token || !token.id || !token.role) {
      return jsonError(401, 'Authentication required. Please sign in.')
    }

    const authToken: AuthToken = {
      id: token.id as string,
      email: token.email as string,
      name: (token.name as string | null | undefined) ?? null,
      role: token.role as Role,
    }

    // -----------------------------------------------------------------------
    // 2. Role-based access control (optional)
    // -----------------------------------------------------------------------
    if (
      options.requiredRoles &&
      options.requiredRoles.length > 0 &&
      !options.requiredRoles.includes(authToken.role)
    ) {
      return jsonError(
        403,
        `Access denied. Required role(s): ${options.requiredRoles.join(', ')}.`,
      )
    }

    // -----------------------------------------------------------------------
    // 3. Invoke the protected handler
    // -----------------------------------------------------------------------
    return handler(req, { params: context.params, token: authToken })
  }
}

// ---------------------------------------------------------------------------
// Convenience role-guard factories
// ---------------------------------------------------------------------------

/**
 * Shorthand: protect a route to ADMIN users only.
 *
 * @example
 * export const DELETE = withAdminAuth(async (req, { token }) => { ... })
 */
export const withAdminAuth = (handler: AuthenticatedHandler) =>
  withAuth(handler, { requiredRoles: ['ADMIN'] })

/**
 * Shorthand: protect a route to DRIVER users only.
 *
 * @example
 * export const PATCH = withDriverAuth(async (req, { token }) => { ... })
 */
export const withDriverAuth = (handler: AuthenticatedHandler) =>
  withAuth(handler, { requiredRoles: ['DRIVER'] })

/**
 * Shorthand: protect a route to both ADMIN and DRIVER users.
 */
export const withAdminOrDriverAuth = (handler: AuthenticatedHandler) =>
  withAuth(handler, { requiredRoles: ['ADMIN', 'DRIVER'] })
