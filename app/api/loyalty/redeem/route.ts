import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { redeemPoints, REDEMPTION_POINTS_NEEDED, REDEMPTION_DISCOUNT_MAD } from '@/lib/loyalty'

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const RedeemSchema = z.object({
  points: z
    .number()
    .int()
    .positive()
    .refine((v) => v % REDEMPTION_POINTS_NEEDED === 0, {
      message: `Points must be a multiple of ${REDEMPTION_POINTS_NEEDED}`,
    }),
  orderId: z.string().min(1, 'orderId is required'),
})

// ---------------------------------------------------------------------------
// POST /api/loyalty/redeem  — authenticated user
// Redeems loyalty points for a MAD discount on a specified order.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req: NextRequest, { token }) => {
  try {
    const body = await req.json()
    const parsed = RedeemSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      )
    }

    const { points, orderId } = parsed.data

    // Ensure order belongs to the authenticated user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, status: true },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } },
        { status: 404 },
      )
    }

    if (order.userId !== token.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Order does not belong to you.' } },
        { status: 403 },
      )
    }

    // Find loyalty card
    const card = await prisma.loyaltyCard.findUnique({
      where: { userId: token.id },
      select: { id: true },
    })

    if (!card) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Loyalty card not found.' } },
        { status: 404 },
      )
    }

    const result = await redeemPoints(card.id, points, orderId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'REDEMPTION_FAILED', message: result.error } },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        pointsRedeemed: points,
        discountAmount: result.discountAmount,
        redemptionRate: `${REDEMPTION_POINTS_NEEDED} points = ${REDEMPTION_DISCOUNT_MAD} MAD`,
      },
    })
  } catch (error) {
    console.error('[POST /api/loyalty/redeem] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to redeem points.' },
      },
      { status: 500 },
    )
  }
})
