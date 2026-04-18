/**
 * Analytics helper functions for the Admin Analytics Dashboard (Phase 2F).
 *
 * All functions use Prisma aggregations and JavaScript grouping.
 * No raw SQL. All dates are handled as ISO strings externally.
 */

import { prisma } from '@/lib/db/prisma'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Format a Date to "YYYY-MM-DD" string in UTC to keep grouping stable. */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// 1. getDailyRevenue
// ---------------------------------------------------------------------------

export interface DailyRevenue {
  date: string   // "YYYY-MM-DD"
  revenue: number
}

/**
 * Sums totalPrice of DELIVERED/CONFIRMED orders, grouped by calendar day.
 */
export async function getDailyRevenue(
  from: Date,
  to: Date,
): Promise<DailyRevenue[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { in: ['DELIVERED', 'CONFIRMED'] },
    },
    select: { totalPrice: true, createdAt: true },
  })

  const grouped = orders.reduce<Record<string, number>>((acc, order) => {
    const key = toDateKey(order.createdAt)
    acc[key] = (acc[key] ?? 0) + Number(order.totalPrice)
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// 2. getOrderTrends
// ---------------------------------------------------------------------------

export interface OrderTrend {
  date: string   // "YYYY-MM-DD"
  count: number
}

/**
 * Counts all orders (regardless of status), grouped by calendar day.
 */
export async function getOrderTrends(
  from: Date,
  to: Date,
): Promise<OrderTrend[]> {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: { createdAt: true },
  })

  const grouped = orders.reduce<Record<string, number>>((acc, order) => {
    const key = toDateKey(order.createdAt)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// 3. getTopProducts
// ---------------------------------------------------------------------------

export interface TopProduct {
  productId: string
  name: string
  quantity: number
  revenue: number
}

/**
 * Aggregates OrderItems over the date range to find top-selling products.
 * Revenue is computed as quantity × priceAtTime.
 */
export async function getTopProducts(
  limit: number,
  from: Date,
  to: Date,
): Promise<TopProduct[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: from, lte: to },
        status: { in: ['DELIVERED', 'CONFIRMED'] },
      },
    },
    select: {
      productId: true,
      quantity: true,
      priceAtTime: true,
      product: { select: { name: true } },
    },
  })

  const grouped = items.reduce<
    Record<string, { name: string; quantity: number; revenue: number }>
  >((acc, item) => {
    const id = item.productId
    const existing = acc[id] ?? { name: item.product.name, quantity: 0, revenue: 0 }
    existing.quantity += item.quantity
    existing.revenue += item.quantity * Number(item.priceAtTime)
    acc[id] = existing
    return acc
  }, {})

  return Object.entries(grouped)
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// 4. getCustomerMetrics
// ---------------------------------------------------------------------------

export interface CustomerMetrics {
  /** All customers ever registered */
  total: number
  /** Registered in the last 30 days */
  newThisMonth: number
  /** Have placed more than one order */
  repeat: number
  /** Had orders before but none in the last 30 days */
  churn: number
}

/**
 * Computes high-level customer metrics.
 * "Churned" = placed at least one order more than 30 days ago, but zero in
 * the last 30 days.
 */
export async function getCustomerMetrics(): Promise<CustomerMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [total, newThisMonth, usersWithMultipleOrders, churned] =
    await Promise.all([
      // All CUSTOMER accounts
      prisma.user.count({ where: { role: 'CUSTOMER' } }),

      // Registered in the last 30 days
      prisma.user.count({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // Users who appear in the order table more than once
      prisma.order
        .groupBy({
          by: ['userId'],
          _count: { id: true },
          having: { id: { _count: { gt: 1 } } },
        })
        .then((rows) => rows.length),

      // Users with at least one order, but none in the past 30 days
      prisma.user
        .findMany({
          where: {
            role: 'CUSTOMER',
            orders: { some: {} },
          },
          select: {
            id: true,
            orders: {
              select: { createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
        .then(
          (users) =>
            users.filter(
              (u) =>
                u.orders.length > 0 &&
                u.orders[0].createdAt < thirtyDaysAgo,
            ).length,
        ),
    ])

  return {
    total,
    newThisMonth,
    repeat: usersWithMultipleOrders,
    churn: churned,
  }
}

// ---------------------------------------------------------------------------
// 5. getDeliveryMetrics
// ---------------------------------------------------------------------------

export interface DeliveryMetrics {
  /** Percentage of deliveries completed on or before estimatedDelivery */
  onTimePercent: number
  /** Mean delivery time in minutes from Delivery creation to actualDelivery */
  avgTimeMinutes: number
}

/**
 * Computes on-time rate and average delivery duration for DELIVERED deliveries
 * in the given date range.
 */
export async function getDeliveryMetrics(
  from: Date,
  to: Date,
): Promise<DeliveryMetrics> {
  const deliveries = await prisma.delivery.findMany({
    where: {
      status: 'DELIVERED',
      actualDelivery: { gte: from, lte: to },
    },
    select: {
      createdAt: true,
      estimatedDelivery: true,
      actualDelivery: true,
    },
  })

  if (deliveries.length === 0) {
    return { onTimePercent: 0, avgTimeMinutes: 0 }
  }

  let onTimeCount = 0
  let totalMinutes = 0

  for (const d of deliveries) {
    // On-time: actual is before or equal to estimated (when estimate exists)
    if (d.estimatedDelivery && d.actualDelivery) {
      if (d.actualDelivery <= d.estimatedDelivery) {
        onTimeCount++
      }
    }

    // Average time: from delivery record creation to actual delivery
    if (d.actualDelivery) {
      const diffMs = d.actualDelivery.getTime() - d.createdAt.getTime()
      totalMinutes += diffMs / 60_000
    }
  }

  const deliveriesWithEstimate = deliveries.filter(
    (d) => d.estimatedDelivery !== null,
  ).length

  const onTimePercent =
    deliveriesWithEstimate > 0
      ? Math.round((onTimeCount / deliveriesWithEstimate) * 100)
      : 0

  const avgTimeMinutes = Math.round(totalMinutes / deliveries.length)

  return { onTimePercent, avgTimeMinutes }
}
