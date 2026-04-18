import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateCouponCode } from '@/lib/coupons'
import { getToken } from 'next-auth/jwt'

// ---------------------------------------------------------------------------
// Rate limiting: simple in-memory store (IP → timestamps[])
// For production use Redis via lib/redis.ts
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const window = RATE_LIMIT_WINDOW_MS
  const existing = (rateLimitStore.get(ip) ?? []).filter(
    (ts) => now - ts < window,
  )
  existing.push(now)
  rateLimitStore.set(ip, existing)
  return existing.length <= RATE_LIMIT_MAX_REQUESTS
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ValidateCouponSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9]+$/i, 'Code must be alphanumeric'),
  cartTotal: z.number().positive('Cart total must be positive'),
  cartItemIds: z.array(z.string()).default([]),
})

// ---------------------------------------------------------------------------
// POST /api/coupons/validate
// No authentication required (UX-first). Rate limited per IP.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait before trying again.',
        },
      },
      { status: 429 },
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
      },
      { status: 400 },
    )
  }

  const parsed = ValidateCouponSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  const { code, cartTotal, cartItemIds } = parsed.data

  // Optionally extract userId from JWT for per-customer usage checking
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userId = token?.id as string | undefined

  try {
    const result = await validateCouponCode(code, cartTotal, cartItemIds, userId)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[POST /api/coupons/validate] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to validate coupon.' },
      },
      { status: 500 },
    )
  }
}
