import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyCouponToOrder, removeCouponFromOrder } from '@/lib/coupons'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ApplyCouponSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .max(20)
    .regex(/^[A-Z0-9]+$/i, 'Code must be alphanumeric'),
  discountAmount: z.number().nonnegative('Discount amount must be non-negative'),
})

const RemoveCouponSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
})

// ---------------------------------------------------------------------------
// POST /api/coupons/apply — Apply coupon to an order (requires auth)
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, { token }) => {
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

  const parsed = ApplyCouponSchema.safeParse(body)
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

  const { orderId, code, discountAmount } = parsed.data

  try {
    const result = await applyCouponToOrder(
      orderId,
      token.id,
      code,
      discountAmount,
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'COUPON_APPLY_FAILED', message: result.error },
        },
        { status: 422 },
      )
    }

    return NextResponse.json({ success: true, data: result.appliedCoupon })
  } catch (err) {
    console.error('[POST /api/coupons/apply] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to apply coupon.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/coupons/apply — Remove coupon from an order (requires auth)
// ---------------------------------------------------------------------------

export const DELETE = withAuth(async (req: NextRequest, { token }) => {
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

  const parsed = RemoveCouponSchema.safeParse(body)
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

  const { orderId } = parsed.data

  try {
    const result = await removeCouponFromOrder(orderId, token.id)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'COUPON_REMOVE_FAILED', message: result.error },
        },
        { status: 422 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/coupons/apply] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove coupon.' },
      },
      { status: 500 },
    )
  }
})
