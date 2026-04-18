/**
 * lib/loyalty.ts
 * Core loyalty program business logic.
 *
 * Rules:
 *  - Base earn rate: 1 point per 10 MAD spent  (10% ratio)
 *  - SILVER tier bonus: +10%  → 1.1 pts / 10 MAD
 *  - GOLD   tier bonus: +25%  → 1.25 pts / 10 MAD
 *  - Tier thresholds (total MAD spent): BRONZE 0-99 | SILVER 100-499 | GOLD 500+
 *  - Redemption rate: 100 points = 20 MAD discount
 *  - Points expire after 1 year (PURCHASE transactions only)
 */

import { prisma } from '@/lib/db/prisma'
import type { LoyaltyTransaction } from '@prisma/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const POINTS_PER_10_MAD = 1 // 1 point per 10 MAD (base)
export const SILVER_BONUS_MULTIPLIER = 1.1
export const GOLD_BONUS_MULTIPLIER = 1.25
export const POINTS_EXPIRY_DAYS = 365
export const REDEMPTION_POINTS_NEEDED = 100 // points to redeem
export const REDEMPTION_DISCOUNT_MAD = 20 // MAD value of 100 points

// ---------------------------------------------------------------------------
// determineTier
// ---------------------------------------------------------------------------

export function determineTier(
  totalSpent: number,
): 'BRONZE' | 'SILVER' | 'GOLD' {
  if (totalSpent >= 500) return 'GOLD'
  if (totalSpent >= 100) return 'SILVER'
  return 'BRONZE'
}

// ---------------------------------------------------------------------------
// calculatePointsForOrder
// ---------------------------------------------------------------------------

/**
 * Calculate how many points a customer earns for a given order.
 * Applies tier bonus if the card already holds SILVER or GOLD tier.
 *
 * @param loyaltyCardId  - the card whose current tier is used for the bonus
 * @param orderTotal     - gross order total in MAD
 */
export async function calculatePointsForOrder(
  loyaltyCardId: string,
  orderTotal: number,
): Promise<number> {
  const card = await prisma.loyaltyCard.findUnique({
    where: { id: loyaltyCardId },
    select: { tier: true },
  })

  const tier = card?.tier ?? 'BRONZE'

  let multiplier = 1.0
  if (tier === 'SILVER') multiplier = SILVER_BONUS_MULTIPLIER
  else if (tier === 'GOLD') multiplier = GOLD_BONUS_MULTIPLIER

  // Base: 1 point per 10 MAD, then apply tier multiplier
  const basePoints = orderTotal / 10
  const totalPoints = Math.floor(basePoints * multiplier)

  return Math.max(0, totalPoints)
}

// ---------------------------------------------------------------------------
// recordPointsTransaction
// ---------------------------------------------------------------------------

export async function recordPointsTransaction(
  loyaltyCardId: string,
  type: 'PURCHASE' | 'REDEMPTION' | 'BONUS' | 'EXPIRY',
  points: number,
  reason: string,
  orderId?: string,
): Promise<LoyaltyTransaction> {
  // For PURCHASE transactions, set expiry 1 year from now
  const expiresAt =
    type === 'PURCHASE'
      ? new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      : null

  const transaction = await prisma.loyaltyTransaction.create({
    data: {
      loyaltyCardId,
      type,
      points,
      reason,
      orderId: orderId ?? null,
      expiresAt,
    },
  })

  return transaction
}

// ---------------------------------------------------------------------------
// awardPointsForOrder  (high-level: calculate + record + update card)
// ---------------------------------------------------------------------------

/**
 * Full purchase flow:
 *  1. Calculate points earned for the order (with tier bonus)
 *  2. Update LoyaltyCard balance + totalSpent + tier (in a transaction)
 *  3. Record a PURCHASE LoyaltyTransaction
 *
 * Idempotent: if a LoyaltyTransaction already exists for this orderId, it
 * returns the existing transaction without double-awarding points.
 */
export async function awardPointsForOrder(
  userId: string,
  orderId: string,
  orderTotal: number,
): Promise<{ pointsEarned: number; newBalance: number; newTier: string }> {
  // Upsert loyalty card
  const existingCard = await prisma.loyaltyCard.findUnique({ where: { userId } })
  const card = existingCard ?? (await prisma.loyaltyCard.create({
    data: { userId, points: 0, totalSpent: 0, tier: 'BRONZE' },
  }))

  // Idempotency: check if transaction already recorded for this order
  const existing = await prisma.loyaltyTransaction.findUnique({
    where: { orderId },
  })
  if (existing) {
    return {
      pointsEarned: existing.points,
      newBalance: card.points,
      newTier: card.tier,
    }
  }

  const pointsEarned = await calculatePointsForOrder(card.id, orderTotal)
  const cardId = card.id
  const cardTotalSpent = card.totalSpent
  const cardPoints = card.points

  // Use a Prisma interactive transaction to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    const newTotalSpent = Number(cardTotalSpent) + orderTotal
    const newTier = determineTier(newTotalSpent)
    const newPoints = cardPoints + pointsEarned

    const updatedCard = await tx.loyaltyCard.update({
      where: { id: cardId },
      data: {
        points: newPoints,
        totalSpent: newTotalSpent,
        tier: newTier,
      },
    })

    const expiresAt = new Date(
      Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    )

    await tx.loyaltyTransaction.create({
      data: {
        loyaltyCardId: cardId,
        type: 'PURCHASE',
        points: pointsEarned,
        reason: `Points earned for order`,
        orderId,
        expiresAt,
      },
    })

    return { updatedCard, pointsEarned }
  })

  return {
    pointsEarned: result.pointsEarned,
    newBalance: result.updatedCard.points,
    newTier: result.updatedCard.tier,
  }
}

// ---------------------------------------------------------------------------
// redeemPoints
// ---------------------------------------------------------------------------

/**
 * Redeem points for a discount.
 * Rate: 100 points = 20 MAD discount.
 *
 * Validates:
 *  - points is a positive multiple of 100
 *  - card has sufficient balance
 */
export async function redeemPoints(
  loyaltyCardId: string,
  points: number,
  orderId: string,
): Promise<{ success: boolean; discountAmount: number; error?: string }> {
  if (points <= 0 || points % REDEMPTION_POINTS_NEEDED !== 0) {
    return {
      success: false,
      discountAmount: 0,
      error: `Points must be a positive multiple of ${REDEMPTION_POINTS_NEEDED}`,
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const card = await tx.loyaltyCard.findUnique({
      where: { id: loyaltyCardId },
      select: { id: true, points: true },
    })

    if (!card) {
      return { success: false, discountAmount: 0, error: 'Loyalty card not found' }
    }

    if (card.points < points) {
      return {
        success: false,
        discountAmount: 0,
        error: `Insufficient points. Available: ${card.points}, Requested: ${points}`,
      }
    }

    const discountAmount =
      (points / REDEMPTION_POINTS_NEEDED) * REDEMPTION_DISCOUNT_MAD

    await tx.loyaltyCard.update({
      where: { id: loyaltyCardId },
      data: { points: { decrement: points } },
    })

    await tx.loyaltyTransaction.create({
      data: {
        loyaltyCardId,
        type: 'REDEMPTION',
        points: -points, // negative = deduction
        reason: `Redeemed ${points} points for ${discountAmount} MAD discount`,
        orderId,
        expiresAt: null,
      },
    })

    return { success: true, discountAmount }
  })

  return result
}

// ---------------------------------------------------------------------------
// getTierBenefits  (pure data — no DB needed)
// ---------------------------------------------------------------------------

export interface TierBenefit {
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  earnRate: string
  bonus: string
  minSpend: number
  maxSpend: number | null
  perks: string[]
}

export const TIER_BENEFITS: TierBenefit[] = [
  {
    tier: 'BRONZE',
    earnRate: '1 point per 10 MAD',
    bonus: 'Base rate',
    minSpend: 0,
    maxSpend: 99,
    perks: [
      '1 point per 10 MAD spent',
      'Access to exclusive deals',
      'Birthday discount (coming soon)',
    ],
  },
  {
    tier: 'SILVER',
    earnRate: '1.1 points per 10 MAD',
    bonus: '+10% bonus',
    minSpend: 100,
    maxSpend: 499,
    perks: [
      '1.1 points per 10 MAD spent (+10% bonus)',
      'Priority customer support',
      '10% birthday discount',
      'Early access to new products',
    ],
  },
  {
    tier: 'GOLD',
    earnRate: '1.25 points per 10 MAD',
    bonus: '+25% bonus',
    minSpend: 500,
    maxSpend: null,
    perks: [
      '1.25 points per 10 MAD spent (+25% bonus)',
      '24/7 VIP support',
      '15% birthday discount',
      'Exclusive invitation-only events',
      'Free delivery on all orders',
    ],
  },
]

export function getTierBenefits(): TierBenefit[] {
  return TIER_BENEFITS
}
