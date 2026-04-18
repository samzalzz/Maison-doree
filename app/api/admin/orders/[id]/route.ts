import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateOrderStatusSchema } from '@/lib/validators'

// ---------------------------------------------------------------------------
// Full order include — mirrors the collection route for consistency
// ---------------------------------------------------------------------------

const ORDER_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      profile: {
        select: { firstName: true, lastName: true, phone: true },
      },
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          price: true,
          category: true,
          photos: true,
          stock: true,
        },
      },
    },
  },
  payment: true,
  delivery: {
    include: {
      driver: {
        select: {
          id: true,
          email: true,
          profile: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  },
  ratings: {
    select: {
      id: true,
      type: true,
      score: true,
      comment: true,
      productId: true,
      createdAt: true,
    },
  },
  tickets: {
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
    },
  },
} as const

// ---------------------------------------------------------------------------
// Helper: fetch order and return 404 when missing
// ---------------------------------------------------------------------------

async function getOrderOrNotFound(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  return order
}

// ---------------------------------------------------------------------------
// GET /api/admin/orders/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const id = (params as { id: string }).id
      const order = await getOrderOrNotFound(id)

      if (!order) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Order '${id}' was not found.` } },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, data: order })
    } catch (error) {
      const id = (params as { id: string } | undefined)?.id ?? 'unknown'
      console.error(`[GET /api/admin/orders/${id}] Error:`, error)
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve order.' } },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/orders/[id]  — update order status only
// ---------------------------------------------------------------------------
// Allowed transitions (forward-only):
//   PENDING → CONFIRMED → ASSIGNED → IN_PROGRESS → DELIVERED
// CANCELLED is a terminal state reachable only via DELETE.
// Admins can also manually set status to any non-CANCELLED value for
// corrections (e.g. move back from ASSIGNED to CONFIRMED).
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const id = (params as { id: string }).id

      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
          { status: 400 },
        )
      }

      const result = UpdateOrderStatusSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid status value.',
              details: result.error.flatten(),
            },
          },
          { status: 422 },
        )
      }

      const { status } = result.data

      // Disallow using PATCH to cancel — use DELETE for that (stock refund)
      if (status === 'CANCELLED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: 'Use DELETE to cancel an order. Cancellation refunds stock automatically.',
            },
          },
          { status: 422 },
        )
      }

      const existing = await prisma.order.findUnique({
        where: { id },
        select: { id: true, status: true },
      })

      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Order '${id}' was not found.` } },
          { status: 404 },
        )
      }

      if (existing.status === 'CANCELLED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: 'A cancelled order cannot be updated.',
            },
          },
          { status: 409 },
        )
      }

      if (existing.status === 'DELIVERED' && status !== 'DELIVERED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: 'A delivered order status cannot be changed.',
            },
          },
          { status: 409 },
        )
      }

      const updated = await prisma.order.update({
        where: { id },
        data: { status },
        include: ORDER_INCLUDE,
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      const id = (params as { id: string } | undefined)?.id ?? 'unknown'
      console.error(`[PATCH /api/admin/orders/${id}] Error:`, error)
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order.' } },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/orders/[id]  — cancel order and refund stock
// ---------------------------------------------------------------------------
// The order record is kept for audit purposes.
// Stock is restored for every item in the order.
// Payment and delivery records are left intact.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const id = (params as { id: string }).id

      const existing = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          items: { select: { productId: true, quantity: true } },
        },
      })

      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: `Order '${id}' was not found.` } },
          { status: 404 },
        )
      }

      if (existing.status === 'CANCELLED') {
        return NextResponse.json(
          { success: false, error: { code: 'ALREADY_CANCELLED', message: 'Order is already cancelled.' } },
          { status: 409 },
        )
      }

      if (existing.status === 'DELIVERED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CANNOT_CANCEL_DELIVERED',
              message: 'A delivered order cannot be cancelled.',
            },
          },
          { status: 409 },
        )
      }

      // Atomic: mark cancelled + restore stock
      const cancelled = await prisma.$transaction(async (tx) => {
        // Restore stock for every item
        await Promise.all(
          existing.items.map((item) =>
            tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            }),
          ),
        )

        // Mark order as cancelled
        return tx.order.update({
          where: { id },
          data: { status: 'CANCELLED' },
          include: ORDER_INCLUDE,
        })
      })

      return NextResponse.json({ success: true, data: cancelled })
    } catch (error) {
      const id = (params as { id: string } | undefined)?.id ?? 'unknown'
      console.error(`[DELETE /api/admin/orders/${id}] Error:`, error)
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel order.' } },
        { status: 500 },
      )
    }
  },
)
