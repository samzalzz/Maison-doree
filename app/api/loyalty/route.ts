import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { determineTier } from '@/lib/loyalty'

// ---------------------------------------------------------------------------
// GET /api/loyalty  — authenticated user
// Returns loyalty card + tier info + points balance.
// Auto-creates the card if the user doesn't have one yet.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (_req: NextRequest, { token }) => {
  try {
    // Upsert loyalty card
    let card = await prisma.loyaltyCard.findUnique({
      where: { userId: token.id },
    })

    if (!card) {
      card = await prisma.loyaltyCard.create({
        data: { userId: token.id, points: 0, totalSpent: 0, tier: 'BRONZE' },
      })
    }

    // Recalculate totalSpent from delivered orders (source of truth)
    const deliveredOrders = await prisma.order.findMany({
      where: { userId: token.id, status: 'DELIVERED' },
      select: { totalPrice: true },
    })

    const totalSpent = deliveredOrders.reduce(
      (sum, o) => sum + Number(o.totalPrice),
      0,
    )
    const tier = determineTier(totalSpent)

    // Update card if values diverged
    if (
      Number(card.totalSpent) !== totalSpent ||
      card.tier !== tier
    ) {
      card = await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: { totalSpent, tier },
      })
    }

    // Next-tier progress info
    let nextTier: string | null = null
    let spendToNextTier: number | null = null
    let progressPercent = 100

    if (tier === 'BRONZE') {
      nextTier = 'SILVER'
      spendToNextTier = Math.max(0, 100 - totalSpent)
      progressPercent = Math.min(100, (totalSpent / 100) * 100)
    } else if (tier === 'SILVER') {
      nextTier = 'GOLD'
      spendToNextTier = Math.max(0, 500 - totalSpent)
      progressPercent = Math.min(100, ((totalSpent - 100) / 400) * 100)
    }

    // Earliest expiring non-zero balance (for expiration info)
    const soonestExpiry = await prisma.loyaltyTransaction.findFirst({
      where: {
        loyaltyCardId: card.id,
        expiresAt: { not: null, gt: new Date() },
        points: { gt: 0 },
      },
      orderBy: { expiresAt: 'asc' },
      select: { expiresAt: true, points: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        card: {
          id: card.id,
          userId: card.userId,
          points: card.points,
          totalSpent: Number(card.totalSpent),
          tier: card.tier,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
        },
        progress: {
          currentTier: tier,
          nextTier,
          spendToNextTier,
          progressPercent: Math.round(progressPercent),
        },
        expiry: soonestExpiry
          ? {
              expiresAt: soonestExpiry.expiresAt,
              points: soonestExpiry.points,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('[GET /api/loyalty] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve loyalty card.' },
      },
      { status: 500 },
    )
  }
})
