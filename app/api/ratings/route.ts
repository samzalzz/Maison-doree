import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { RatingSchema } from '@/lib/validators'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// POST /api/ratings  (authenticated user)
// ---------------------------------------------------------------------------
// Body: RatingSchema
// Creates a new rating for a product or delivery.
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

    const result = RatingSchema.safeParse(body)

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

    const { orderId, productId, type, score, comment } = result.data

    // Verify order exists and belongs to user
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
            message: 'Cannot rate orders from other users.',
          },
        },
        { status: 403 },
      )
    }

    // If product rating, verify product exists
    if (type === 'PRODUCT' && productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      })

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Product not found.',
            },
          },
          { status: 404 },
        )
      }
    }

    // Create rating
    const rating = await prisma.rating.create({
      data: {
        userId: token.id,
        orderId,
        productId: productId || null,
        type,
        score,
        comment: comment || null,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ success: true, data: rating }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/ratings] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create rating.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/ratings  (authenticated user)
// ---------------------------------------------------------------------------
// Query params:
//   type    – filter by 'PRODUCT' or 'DELIVERY' (optional)
//   skip    – pagination offset (default 0)
//   take    – page size (default 20, max 100)
// Returns all ratings for the authenticated user.
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { token }) => {
  try {
    const { searchParams } = new URL(req.url)

    const type = searchParams.get('type') as 'PRODUCT' | 'DELIVERY' | null
    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20),
    )

    const where: { userId: string; type?: 'PRODUCT' | 'DELIVERY' } = {
      userId: token.id,
    }

    if (type && ['PRODUCT', 'DELIVERY'].includes(type)) {
      where.type = type
    }

    const [ratings, total] = await Promise.all([
      prisma.rating.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: { id: true, name: true },
          },
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      }),
      prisma.rating.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: ratings,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/ratings] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve ratings.',
        },
      },
      { status: 500 },
    )
  }
})
