import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Query-param schema
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(15),
  // Legacy offset param (still supported when cursor absent)
  offset: z.coerce.number().int().min(0).optional(),
  // Cursor-based param (preferred)
  cursor: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/loyalty/transactions  — authenticated user
// Returns the user's loyalty transaction history (cursor-paginated).
//
// Query params:
//   cursor  – opaque pagination cursor (base64-encoded id); absent = first page
//   limit   – page size (default 15, max 100)
//   offset  – legacy offset (still supported when cursor absent)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req: NextRequest, { token }) => {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
      cursor: searchParams.get('cursor') ?? undefined,
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

    const { limit, offset, cursor: rawCursor } = parsed.data
    const useLegacy = offset !== undefined && rawCursor === undefined

    // Find the user's loyalty card
    const card = await prisma.loyaltyCard.findUnique({
      where: { userId: token.id },
      select: { id: true },
    })

    if (!card) {
      return NextResponse.json({
        success: true,
        data: {
          transactions: [],
          total: 0,
          limit,
          nextCursor: null,
          hasNextPage: false,
        },
      })
    }

    // -----------------------------------------------------------------------
    // Legacy offset path (backwards compat)
    // -----------------------------------------------------------------------
    if (useLegacy) {
      const safeOffset = offset ?? 0

      const [transactions, total] = await Promise.all([
        prisma.loyaltyTransaction.findMany({
          where: { loyaltyCardId: card.id },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: safeOffset,
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
        prisma.loyaltyTransaction.count({ where: { loyaltyCardId: card.id } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          transactions,
          total,
          limit,
          offset: safeOffset,
          hasMore: safeOffset + limit < total,
        },
      })
    }

    // -----------------------------------------------------------------------
    // Cursor-based path
    // -----------------------------------------------------------------------
    let cursorId: string | undefined
    if (rawCursor) {
      try {
        cursorId = Buffer.from(rawCursor, 'base64url').toString('utf8')
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid cursor.' } },
          { status: 400 },
        )
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { loyaltyCardId: card.id },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
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
      prisma.loyaltyTransaction.count({ where: { loyaltyCardId: card.id } }),
    ])

    const hasNextPage = transactions.length > limit
    const page = hasNextPage ? transactions.slice(0, limit) : transactions
    const lastItem = page[page.length - 1]
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(lastItem.id).toString('base64url')
        : null

    return NextResponse.json({
      success: true,
      data: {
        transactions: page,
        total,
        limit,
        nextCursor,
        hasNextPage,
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
