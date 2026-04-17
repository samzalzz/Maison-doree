import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { AddTicketMessageSchema } from '@/lib/validators'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// POST /api/tickets/[id]/messages  (authenticated user)
// ---------------------------------------------------------------------------
// Body: AddTicketMessageSchema
// Adds a message to a ticket. User must be the ticket creator or an admin.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req, { params, token }) => {
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

    const result = AddTicketMessageSchema.safeParse(body)

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

    const { message } = result.data

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { id: true, userId: true },
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

    // Only ticket creator or admin can add messages
    if (token.role !== 'ADMIN' && ticket.userId !== token.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot add messages to tickets from other users.',
          },
        },
        { status: 403 },
      )
    }

    // Create message
    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        userId: token.id,
        message,
        attachments: [],
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    })

    return NextResponse.json(
      { success: true, data: newMessage },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/tickets/[id]/messages] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to add message to ticket.',
        },
      },
      { status: 500 },
    )
  }
})
