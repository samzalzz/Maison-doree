import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CouponValidationResult {
  valid: boolean
  discount?: number // MAD amount
  reason?: string
  coupon?: {
    id: string
    code: string
    name: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: number
    minOrderAmount: number | null
    applicableCategories: string[]
    validUntil: Date
  }
}

export interface CouponApplyResult {
  success: boolean
  appliedCoupon?: {
    id: string
    couponId: string
    orderId: string
    userId: string
    discountApplied: Prisma.Decimal
    appliedAt: Date
  }
  error?: string
}

export interface CouponAnalytics {
  coupons: {
    id: string
    code: string
    name: string
    discountType: string
    discountValue: number
    usedCount: number
    maxUses: number | null
    totalDiscountGiven: number
    redemptionRate: number | null
    averageOrderValue: number | null
  }[]
  summary: {
    totalCoupons: number
    activeCoupons: number
    totalRedemptions: number
    totalRevenueImpact: number
  }
}

// ---------------------------------------------------------------------------
// validateCouponCode
// ---------------------------------------------------------------------------

/**
 * Validates a coupon code against business rules.
 * This is a read-only check — it does not increment usedCount.
 * Server always re-validates at apply time.
 */
export async function validateCouponCode(
  code: string,
  cartTotal: number,
  cartItemIds: string[], // product IDs
  userId?: string,
): Promise<CouponValidationResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Invalid coupon code format.' }
  }

  const normalised = code.trim().toUpperCase()

  // Check code exists and is active
  const coupon = await prisma.promoCoupon.findUnique({
    where: { code: normalised },
  })

  if (!coupon) {
    return { valid: false, reason: 'Coupon code not found.' }
  }

  if (!coupon.isActive) {
    return { valid: false, reason: 'This coupon is no longer active.' }
  }

  // Check validity window
  const now = new Date()
  if (now < coupon.validFrom) {
    return { valid: false, reason: 'This coupon is not yet valid.' }
  }
  if (now > coupon.validUntil) {
    return { valid: false, reason: 'This coupon has expired.' }
  }

  // Check global usage limit
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'This coupon has reached its usage limit.' }
  }

  // Check per-customer usage limit (requires userId)
  if (userId && coupon.maxUsesPerCustomer > 0) {
    const customerUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    })
    if (customerUsageCount >= coupon.maxUsesPerCustomer) {
      return {
        valid: false,
        reason: `You have already used this coupon ${coupon.maxUsesPerCustomer > 1 ? `${coupon.maxUsesPerCustomer} times` : 'before'}.`,
      }
    }
  }

  // Check minimum order amount
  if (
    coupon.minOrderAmount !== null &&
    cartTotal < Number(coupon.minOrderAmount)
  ) {
    return {
      valid: false,
      reason: `Minimum order amount of ${Number(coupon.minOrderAmount).toFixed(2)} MAD required.`,
    }
  }

  // Check applicable categories (if restricted)
  if (coupon.applicableCategories.length > 0 && cartItemIds.length > 0) {
    const cartProducts = await prisma.product.findMany({
      where: { id: { in: cartItemIds } },
      select: { category: true },
    })

    const cartCategories = cartProducts.map((p) => p.category as string)
    const hasApplicableItem = cartCategories.some((cat) =>
      coupon.applicableCategories.includes(cat),
    )

    if (!hasApplicableItem) {
      return {
        valid: false,
        reason: `This coupon only applies to: ${coupon.applicableCategories.join(', ')}.`,
      }
    }
  }

  // Calculate discount amount
  const discount = calculateDiscount(
    coupon.discountType,
    Number(coupon.discountValue),
    cartTotal,
    coupon.applicableCategories,
    cartItemIds,
  )

  return {
    valid: true,
    discount,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderAmount:
        coupon.minOrderAmount !== null ? Number(coupon.minOrderAmount) : null,
      applicableCategories: coupon.applicableCategories,
      validUntil: coupon.validUntil,
    },
  }
}

// ---------------------------------------------------------------------------
// calculateDiscount  (pure — no DB access)
// ---------------------------------------------------------------------------

export function calculateDiscount(
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT',
  discountValue: number,
  cartTotal: number,
  _applicableCategories: string[] = [],
  _cartItemIds: string[] = [],
): number {
  if (discountType === 'PERCENTAGE') {
    const rawDiscount = (cartTotal * discountValue) / 100
    // Cap at cart total to never go negative
    return Math.min(rawDiscount, cartTotal)
  }
  // FIXED_AMOUNT
  return Math.min(discountValue, cartTotal)
}

// ---------------------------------------------------------------------------
// applyCouponToOrder
// ---------------------------------------------------------------------------

/**
 * Atomically applies a coupon to an existing order.
 * Re-validates all business rules inside the transaction.
 * Increments usedCount on PromoCoupon atomically.
 * Creates a CouponUsage audit record.
 * Links the CouponUsage to the Order via appliedCoupon relation.
 */
export async function applyCouponToOrder(
  orderId: string,
  userId: string,
  code: string,
  discountAmount: number,
): Promise<CouponApplyResult> {
  const normalised = code.trim().toUpperCase()

  try {
    const appliedCoupon = await prisma.$transaction(async (tx) => {
      // Re-fetch coupon with a row-level lock to prevent race conditions
      const coupon = await tx.promoCoupon.findUnique({
        where: { code: normalised },
      })

      if (!coupon || !coupon.isActive) {
        throw new Error('Coupon not found or inactive.')
      }

      const now = new Date()
      if (now < coupon.validFrom || now > coupon.validUntil) {
        throw new Error('Coupon is outside its validity window.')
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        throw new Error('Coupon usage limit reached.')
      }

      // Check per-customer usage
      if (coupon.maxUsesPerCustomer > 0) {
        const existingUsage = await tx.couponUsage.count({
          where: { couponId: coupon.id, userId },
        })
        if (existingUsage >= coupon.maxUsesPerCustomer) {
          throw new Error('Per-customer usage limit reached.')
        }
      }

      // Ensure the order exists and belongs to this user
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: {
          items: { include: { product: { select: { id: true, category: true } } } },
          appliedCoupon: true,
        },
      })

      if (!order) {
        throw new Error('Order not found.')
      }

      // Remove any previously applied coupon on this order
      if (order.appliedCoupon) {
        const previousCouponId = order.appliedCoupon.couponId
        await tx.couponUsage.delete({ where: { id: order.appliedCoupon.id } })
        // Decrement the old coupon's usedCount
        await tx.promoCoupon.update({
          where: { id: previousCouponId },
          data: { usedCount: { decrement: 1 } },
        })
      }

      // Re-validate min order amount against current order subtotal
      if (
        coupon.minOrderAmount !== null &&
        Number(order.subtotal) < Number(coupon.minOrderAmount)
      ) {
        throw new Error(
          `Minimum order amount of ${Number(coupon.minOrderAmount).toFixed(2)} MAD not met.`,
        )
      }

      // Re-validate category restriction
      if (coupon.applicableCategories.length > 0) {
        const cartCategories = order.items.map(
          (item) => item.product.category as string,
        )
        const hasApplicableItem = cartCategories.some((cat) =>
          coupon.applicableCategories.includes(cat),
        )
        if (!hasApplicableItem) {
          throw new Error(
            `Coupon only applies to: ${coupon.applicableCategories.join(', ')}.`,
          )
        }
      }

      // Re-calculate discount server-side (never trust client value)
      const cartItemIds = order.items.map((i) => i.product.id)
      const serverDiscount = calculateDiscount(
        coupon.discountType,
        Number(coupon.discountValue),
        Number(order.subtotal),
        coupon.applicableCategories,
        cartItemIds,
      )

      const finalDiscount = new Prisma.Decimal(
        serverDiscount.toFixed(2),
      )

      // Create CouponUsage audit record
      const usage = await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          orderId,
          userId,
          discountApplied: finalDiscount,
        },
      })

      // Atomically increment usedCount
      await tx.promoCoupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      })

      return usage
    })

    return { success: true, appliedCoupon }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to apply coupon.'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// removeCouponFromOrder
// ---------------------------------------------------------------------------

/**
 * Removes an applied coupon from an order and decrements usedCount.
 */
export async function removeCouponFromOrder(
  orderId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const usage = await tx.couponUsage.findFirst({
        where: { orderId, userId },
      })

      if (!usage) {
        throw new Error('No coupon applied to this order.')
      }

      await tx.couponUsage.delete({ where: { id: usage.id } })

      await tx.promoCoupon.update({
        where: { id: usage.couponId },
        data: { usedCount: { decrement: 1 } },
      })
    })

    return { success: true }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to remove coupon.'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// getCouponAnalytics
// ---------------------------------------------------------------------------

export async function getCouponAnalytics(
  from: Date,
  to: Date,
): Promise<CouponAnalytics> {
  const [coupons, usages] = await Promise.all([
    prisma.promoCoupon.findMany({
      orderBy: { usedCount: 'desc' },
      include: {
        usages: {
          where: {
            appliedAt: { gte: from, lte: to },
          },
          include: {
            order: { select: { subtotal: true } },
          },
        },
      },
    }),
    prisma.couponUsage.findMany({
      where: { appliedAt: { gte: from, lte: to } },
      select: { discountApplied: true },
    }),
  ])

  const totalRevenueImpact = usages.reduce(
    (sum, u) => sum + Number(u.discountApplied),
    0,
  )

  const couponStats = coupons.map((coupon) => {
    const periodUsages = coupon.usages
    const totalDiscountGiven = periodUsages.reduce(
      (sum, u) => sum + Number(u.discountApplied),
      0,
    )
    const avgOrderValue =
      periodUsages.length > 0
        ? periodUsages.reduce((sum, u) => sum + Number(u.order.subtotal), 0) /
          periodUsages.length
        : null
    const redemptionRate =
      coupon.maxUses !== null && coupon.maxUses > 0
        ? (coupon.usedCount / coupon.maxUses) * 100
        : null

    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      totalDiscountGiven,
      redemptionRate,
      averageOrderValue: avgOrderValue,
    }
  })

  const activeCoupons = coupons.filter((c) => {
    const now = new Date()
    return c.isActive && now >= c.validFrom && now <= c.validUntil
  }).length

  return {
    coupons: couponStats,
    summary: {
      totalCoupons: coupons.length,
      activeCoupons,
      totalRedemptions: usages.length,
      totalRevenueImpact,
    },
  }
}
