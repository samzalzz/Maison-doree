import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { AssignDriverSchema } from '@/lib/validators'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// PATCH /api/orders/[id]/assign-driver  (admin only)
// ---------------------------------------------------------------------------
// Assigns a driver to the order's Delivery record and transitions the delivery
// status to ASSIGNED.  Also transitions the Order status from CONFIRMED to
// ASSIGNED when applicable.
//
// Body: AssignDriverSchema  { driverId: string }
//
// Error cases:
//   400 – invalid / missing body
//   404 – order not found or has no delivery record
//   422 – driverId fails schema validation
//   409 – driver does not exist or is not of role DRIVER
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (
  req: NextRequest,
  { params },
) => {
  const id = (params as { id: string }).id

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

    const result = AssignDriverSchema.safeParse(body)

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

    const { driverId } = result.data

    // -----------------------------------------------------------------------
    // Verify the order and its delivery record exist before mutating.
    // -----------------------------------------------------------------------

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id:       true,
        status:   true,
        delivery: { select: { id: true, status: true } },
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

    if (!order.delivery) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Order '${id}' does not have a delivery record.`,
          },
        },
        { status: 404 },
      )
    }

    // -----------------------------------------------------------------------
    // Verify the target user exists and holds the DRIVER role.
    // -----------------------------------------------------------------------

    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, role: true },
    })

    if (!driver) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DRIVER_NOT_FOUND',
            message: `User with id '${driverId}' was not found.`,
          },
        },
        { status: 409 },
      )
    }

    if (driver.role !== 'DRIVER') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DRIVER',
            message: `User '${driverId}' does not have the DRIVER role.`,
          },
        },
        { status: 409 },
      )
    }

    // -----------------------------------------------------------------------
    // Atomic update: assign driver on Delivery + promote Order status.
    // We only advance the order status when it is currently CONFIRMED to avoid
    // overwriting a status that has already moved further in the lifecycle.
    // -----------------------------------------------------------------------

    const [delivery] = await prisma.$transaction([
      prisma.delivery.update({
        where: { id: order.delivery.id },
        data:  {
          driverId,
          status: 'ASSIGNED',
        },
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
      }),

      // Advance the order to ASSIGNED only when it is CONFIRMED.
      // (PENDING orders must be confirmed by the business first.)
      ...(order.status === 'CONFIRMED'
        ? [
            prisma.order.update({
              where: { id },
              data:  { status: 'ASSIGNED' },
            }),
          ]
        : []),
    ])

    return NextResponse.json({
      success: true,
      data: {
        delivery,
        message: `Driver '${driverId}' assigned to order '${id}'.`,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Order or delivery record for id '${id}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    console.error(`[PATCH /api/orders/${id}/assign-driver] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to assign driver.',
        },
      },
      { status: 500 },
    )
  }
})
