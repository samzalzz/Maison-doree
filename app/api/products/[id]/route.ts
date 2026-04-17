import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/redis'
import { ProductUpdateSchema } from '@/lib/validators'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const PRODUCT_DETAIL_TTL = 120 // seconds

function productCacheKey(id: string): string {
  return `products:detail:${id}`
}

// ---------------------------------------------------------------------------
// GET /api/products/[id]  (public)
// ---------------------------------------------------------------------------
// Returns the product together with:
//   – all packaging options
//   – the 5 most recent PRODUCT-type ratings (score + comment + userId)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const { id } = params

    // Try cache first
    const cached = await cache.get(productCacheKey(id)).catch(() => null)
    if (cached) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { 'X-Cache': 'HIT' },
      })
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        packaging: {
          orderBy: { priceModifier: 'asc' },
        },
        ratings: {
          where: { type: 'PRODUCT' },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            score: true,
            comment: true,
            createdAt: true,
            userId: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Product with id '${id}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    const payload = { success: true, data: product }

    // Populate cache (fire-and-forget)
    cache
      .set(productCacheKey(id), JSON.stringify(payload), PRODUCT_DETAIL_TTL)
      .catch(() => {})

    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS' },
    })
  } catch (error) {
    console.error(`[GET /api/products/${params.id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve product.',
        },
      },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/products/[id]  (admin only)
// ---------------------------------------------------------------------------
// Accepts a partial ProductSchema body.  Only the supplied fields are updated.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req, { params }) => {
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

    const result = ProductUpdateSchema.safeParse(body)

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

    // Guard: body must contain at least one field to update
    if (Object.keys(result.data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'At least one field must be provided to update.',
          },
        },
        { status: 400 },
      )
    }

    const product = await prisma.product.update({
      where: { id },
      data: result.data,
    })

    // Bust the detail cache for this product
    await cache.del(productCacheKey(id)).catch(() => {})

    return NextResponse.json({ success: true, data: product })
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
            message: `Product with id '${id}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    console.error(`[PATCH /api/products/${id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update product.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/products/[id]  (admin only)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (_req, { params }) => {
  const id = (params as { id: string }).id

  try {
    await prisma.product.delete({ where: { id } })

    // Bust the detail cache
    await cache.del(productCacheKey(id)).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        data: { message: `Product '${id}' deleted successfully.` },
      },
      { status: 200 },
    )
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
            message: `Product with id '${id}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    console.error(`[DELETE /api/products/${id}] Error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete product.',
        },
      },
      { status: 500 },
    )
  }
})
