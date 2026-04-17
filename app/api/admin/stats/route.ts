import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/stats  (admin only)
// ---------------------------------------------------------------------------
// Returns dashboard statistics for admin dashboard:
// - Total orders, revenue, customers
// - Order status breakdown
// - Top products
// - Recent orders
// - Low stock alerts
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req) => {
  try {
    // Parallel execution of multiple stats queries
    const [
      totalOrders,
      totalCustomers,
      totalRevenue,
      ordersByStatus,
      lowStockProducts,
      topProducts,
      recentOrders,
      openTickets,
    ] = await Promise.all([
      // Total orders count
      prisma.order.count(),

      // Total unique customers
      prisma.user.count({
        where: { role: 'CUSTOMER' },
      }),

      // Total revenue (sum of all delivered orders)
      prisma.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { totalPrice: true },
      }),

      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Low stock products (below minimum stock)
      prisma.product.findMany({
        where: {
          stock: {
            lt: prisma.product.fields.minimumStock,
          },
        },
        select: {
          id: true,
          name: true,
          stock: true,
          minimumStock: true,
          category: true,
        },
        take: 10,
      }),

      // Top 5 products by order frequency
      prisma.orderItem.groupBy({
        by: ['productId'],
        _count: true,
        orderBy: {
          _count: {
            productId: 'desc',
          },
        },
        take: 5,
      }),

      // Recent 10 orders with details
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { email: true },
          },
          payment: {
            select: { status: true, method: true },
          },
          delivery: {
            select: { status: true, driverId: true },
          },
        },
      }),

      // Open support tickets
      prisma.ticket.count({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ])

    // Fetch product details for top products
    const topProductIds = topProducts.map((tp) => tp.productId)
    const topProductDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
      },
    })

    // Build a map for easy lookup
    const productMap = new Map(topProductDetails.map((p) => [p.id, p]))

    const topProductsWithDetails = topProducts
      .map((tp) => ({
        ...productMap.get(tp.productId),
        orderCount: tp._count,
      }))
      .filter(Boolean)

    // Build status breakdown
    const statusBreakdown = ordersByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count
        return acc
      },
      {} as Record<string, number>,
    )

    const stats = {
      overview: {
        totalOrders,
        totalCustomers,
        totalRevenue: Number(totalRevenue._sum?.totalPrice ?? 0),
      },
      ordersByStatus: statusBreakdown,
      lowStockProducts,
      topProducts: topProductsWithDetails,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.user?.email,
        totalPrice: Number(order.totalPrice),
        status: order.status,
        paymentStatus: order.payment?.status,
        paymentMethod: order.payment?.method,
        deliveryStatus: order.delivery?.status,
        createdAt: order.createdAt,
      })),
      supportMetrics: {
        openTickets,
      },
    }

    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('[GET /api/admin/stats] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve admin statistics.',
        },
      },
      { status: 500 },
    )
  }
})
