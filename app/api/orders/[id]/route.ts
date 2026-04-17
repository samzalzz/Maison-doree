import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/orders/[id]  (authenticated)
// ---------------------------------------------------------------------------
// Returns the full order details including items (with product snapshot),
// payment, delivery, ratings, and linked tickets.
//
// Access rules:
//   • The order owner (token.id === order.userId)  → allowed
//   • ADMIN role                                    → allowed
//   • Anyone else                                   → 403 Forbidden
//   • Order does not exist                          → 404 Not Found
// ---------------------------------------------------------------------------

export const GET = withAuth(async (
  _req: NextRequest,
  { params, token },
) => {
  try {
    const id = (params as { id: string }).id

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id:          true,
                name:        true,
                description: true,
                price:       true,
                category:    true,
                photos:      true,
              },
            },
          },
        },
        payment: true,
        delivery: {
          include: {
            driver: {
              select: {
                id:      true,
                email:   true,
                profile: {
                  select: {
                    firstName: true,
                    lastName:  true,
                    phone:     true,
                  },
                },
              },
            },
          },
        },
        ratings: {
          select: {
            id:        true,
            type:      true,
            score:     true,
            comment:   true,
            productId: true,
            createdAt: true,
          },
        },
        tickets: {
          select: {
            id:           true,
            ticketNumber: true,
            title:        true,
            status:       true,
            priority:     true,
            createdAt:    true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Order with id '${id}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    // Authorization: owner or admin only.
    if (order.userId !== token.id && token.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to view this order.',
          },
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    const id = (params as { id: string } | undefined)?.id ?? 'unknown'
    console.error(`[GET /api/orders/${id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve order.',
        },
      },
      { status: 500 },
    )
  }
})
