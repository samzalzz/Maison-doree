import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Query-param schema
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

// ---------------------------------------------------------------------------
// GET /api/loyalty/transactions?limit=20&offset=0  — authenticated user
// Returns the user's loyalty transaction history (paginated).
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, { token }) => {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      )
    }

    const { limit, offset } = parsed.data

    // Find the user's loyalty card
    const card = await prisma.loyaltyCard.findUnique({
      where: { userId: token.id },
      select: { id: true },
    })

    if (!card) {
      return NextResponse.json({
        success: true,
        data: { transactions: [], total: 0, limit, offset },
      })
    }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { loyaltyCardId: card.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          points: true,
          reason: true,
          orderId: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.loyaltyTransaction.count({
        where: { loyaltyCardId: card.id },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/loyalty/transactions] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve transactions.' },
      },
      { status: 500 },
    )
  }
})
