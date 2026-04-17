import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { CreateTicketSchema } from '@/lib/validators'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Helper function to generate ticket number
// ---------------------------------------------------------------------------

async function generateTicketNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const todayCount = await tx.ticket.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  })

  const seq = String(todayCount + 1).padStart(4, '0')
  return `TKT-${yyyy}-${mm}-${dd}-${seq}`
}

// ---------------------------------------------------------------------------
// POST /api/tickets  (authenticated user)
// ---------------------------------------------------------------------------
// Body: CreateTicketSchema
// Creates a new support ticket.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req, { token }) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Request body must be valid JSON.',
          },
        },
        { status: 400 },
      )
    }

    const result = CreateTicketSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: result.error.flatten(),
          },
        },
        { status: 422 },
      )
    }

    const { orderId, title, description, priority } = result.data

    // If orderId provided, verify it belongs to user
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, userId: true },
      })

      if (!order) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Order not found.',
            },
          },
          { status: 404 },
        )
      }

      if (order.userId !== token.id) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Cannot create tickets for orders from other users.',
            },
          },
          { status: 403 },
        )
      }
    }

    // Create ticket in transaction
    const ticket = await prisma.$transaction(async (tx) => {
      const ticketNumber = await generateTicketNumber(tx)

      const created = await tx.ticket.create({
        data: {
          ticketNumber,
          userId: token.id,
          orderId: orderId || null,
          title,
          description,
          priority,
          status: 'OPEN',
        },
        include: {
          messages: true,
          user: {
            select: { id: true, email: true },
          },
        },
      })

      return created
    })

    return NextResponse.json({ success: true, data: ticket }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/tickets] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create ticket.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/tickets  (authenticated user)
// ---------------------------------------------------------------------------
// Query params:
//   status  – filter by TicketStatus (optional)
//   skip    – pagination offset (default 0)
//   take    – page size (default 20, max 100)
// Returns all tickets for the authenticated user.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { token }) => {
  try {
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status')
    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20),
    )

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
    type TicketStatusValue = (typeof validStatuses)[number]

    const where: Prisma.TicketWhereInput = { userId: token.id }

    if (status && validStatuses.includes(status as TicketStatusValue)) {
      where.status = status as TicketStatusValue
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 5, // include last 5 messages
          },
          user: {
            select: { id: true, email: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: tickets,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/tickets] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve tickets.',
        },
      },
      { status: 500 },
    )
  }
})
