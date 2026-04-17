import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/loyalty  (authenticated user)
// ---------------------------------------------------------------------------
// Returns the loyalty card info for the authenticated user.
// If no loyalty card exists, it is created automatically on first access.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { token }) => {
  try {
    // Try to find existing loyalty card
    let loyaltyCard = await prisma.loyaltyCard.findUnique({
      where: { userId: token.id },
    })

    // If not found, create one
    if (!loyaltyCard) {
      loyaltyCard = await prisma.loyaltyCard.create({
        data: {
          userId: token.id,
          points: 0,
          totalSpent: 0,
          tier: 'BRONZE',
        },
      })
    }

    // Calculate stats from orders
    const orders = await prisma.order.findMany({
      where: {
        userId: token.id,
        status: 'DELIVERED',
      },
      select: {
        totalPrice: true,
      },
    })

    const totalSpentFromOrders = orders.reduce(
      (sum, order) => sum + Number(order.totalPrice),
      0,
    )

    // Determine tier based on total spent
    let tier: 'BRONZE' | 'SILVER' | 'GOLD' = 'BRONZE'
    if (totalSpentFromOrders >= 500) {
      tier = 'GOLD'
    } else if (totalSpentFromOrders >= 100) {
      tier = 'SILVER'
    }

    // Calculate points (1 point per MAD spent, rounded)
    const points = Math.floor(totalSpentFromOrders)

    // Update card with current stats if changed
    if (
      loyaltyCard.tier !== tier ||
      Number(loyaltyCard.totalSpent) !== totalSpentFromOrders ||
      loyaltyCard.points !== points
    ) {
      loyaltyCard = await prisma.loyaltyCard.update({
        where: { id: loyaltyCard.id },
        data: {
          tier,
          totalSpent: totalSpentFromOrders,
          points,
        },
      })
    }

    return NextResponse.json({ success: true, data: loyaltyCard })
  } catch (error) {
    console.error('[GET /api/loyalty] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve loyalty card information.',
        },
      },
      { status: 500 },
    )
  }
})
