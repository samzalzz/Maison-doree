import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { UpdateTicketStatusSchema } from '@/lib/validators'
import { withAuth, withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/tickets/[id]  (authenticated user or admin)
// ---------------------------------------------------------------------------
// Returns a single ticket with all messages.
// User can only see their own tickets, admins can see all.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { params, token }) => {
  try {
    const id = params?.id as string

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Ticket ID is required.',
          },
        },
        { status: 400 },
      )
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
        user: {
          select: { id: true, email: true },
        },
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ticket not found.',
          },
        },
        { status: 404 },
      )
    }

    // Only admin or ticket creator can view
    if (token.role !== 'ADMIN' && ticket.userId !== token.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot view tickets from other users.',
          },
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ success: true, data: ticket })
  } catch (error) {
    console.error('[GET /api/tickets/[id]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve ticket.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/tickets/[id]  (admin only)
// ---------------------------------------------------------------------------
// Body: UpdateTicketStatusSchema
// Updates ticket status and priority.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req, { params }) => {
  try {
    const id = params?.id as string

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Ticket ID is required.',
          },
        },
        { status: 400 },
      )
    }

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

    const result = UpdateTicketStatusSchema.safeParse(body)

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

    const { status, priority } = result.data

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Ticket not found.',
          },
        },
        { status: 404 },
      )
    }

    // Update ticket
    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        status,
        priority: priority || undefined,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, email: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PATCH /api/tickets/[id]] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update ticket.',
        },
      },
      { status: 500 },
    )
  }
})
