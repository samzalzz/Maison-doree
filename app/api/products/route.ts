import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/redis'
import { ProductSchema } from '@/lib/validators'
import { withAdminAuth } from '@/lib/auth-middleware'
import type { ProductCategory } from '@prisma/client'

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const PRODUCTS_CACHE_TTL = 60 // seconds

function buildCacheKey(
  category: string | null,
  featured: boolean,
  cursor: string | null,
  limit: number,
): string {
  return `products:list:cat=${category ?? 'all'}:featured=${featured}:cursor=${cursor ?? 'null'}:limit=${limit}`
}

// ---------------------------------------------------------------------------
// Cursor codec helpers
// ---------------------------------------------------------------------------
// The cursor is the base64-encoded product id — opaque to the client.

function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url')
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8')
}

// ---------------------------------------------------------------------------
// GET /api/products  (public)
// ---------------------------------------------------------------------------
// Query params:
//   category  – filter by ProductCategory enum value
//   featured  – "true" to return only featured products
//   cursor    – opaque pagination cursor (base64-encoded id); absent = first page
//   limit     – page size (default 20, max 100)
//   skip      – legacy offset param (still supported for backwards compat)
//   take      – legacy page-size param (still supported for backwards compat)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)

    // Parse and sanitise query parameters
    const rawCategory = searchParams.get('category')
    const featured = searchParams.get('featured') === 'true'

    // Cursor-based pagination params (preferred)
    const rawCursor = searchParams.get('cursor')
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20),
    )

    // Legacy offset params (backwards compat)
    const legacySkip = searchParams.get('skip')
    const legacyTake = searchParams.get('take')
    const useLegacy = (legacySkip !== null || legacyTake !== null) && rawCursor === null

    // Validate category against the enum when provided
    const validCategories: ProductCategory[] = [
      'PATES',
      'COOKIES',
      'GATEAU',
      'BRIOUATES',
      'CHEBAKIA',
      'AUTRES',
    ]
    const category: ProductCategory | null =
      rawCategory && validCategories.includes(rawCategory as ProductCategory)
        ? (rawCategory as ProductCategory)
        : null

    // Build Prisma where clause
    const where: {
      category?: ProductCategory
      isFeatured?: boolean
    } = {}

    if (category) where.category = category
    if (featured) where.isFeatured = true

    // -----------------------------------------------------------------------
    // Legacy offset-based path (skip/take params present and no cursor)
    // -----------------------------------------------------------------------
    if (useLegacy) {
      const skip = Math.max(0, parseInt(legacySkip ?? '0', 10) || 0)
      const take = Math.min(100, Math.max(1, parseInt(legacyTake ?? '20', 10) || 20))

      const cacheKey = buildCacheKey(category, featured, `skip-${skip}`, take)
      const cached = await cache.get(cacheKey).catch(() => null)

      if (cached) {
        return NextResponse.json(JSON.parse(cached), { headers: { 'X-Cache': 'HIT' } })
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
        prisma.product.count({ where }),
      ])

      const payload = {
        data: products,
        pagination: { skip, take, total, hasMore: skip + take < total },
      }

      cache.set(cacheKey, JSON.stringify(payload), PRODUCTS_CACHE_TTL).catch(() => {})

      return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } })
    }

    // -----------------------------------------------------------------------
    // Cursor-based path
    // -----------------------------------------------------------------------

    // Decode the opaque cursor to a product id
    let cursorId: string | undefined
    if (rawCursor) {
      try {
        cursorId = decodeCursor(rawCursor)
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid cursor.' } },
          { status: 400 },
        )
      }
    }

    // Try cache first
    const cacheKey = buildCacheKey(category, featured, rawCursor, limit)
    const cached = await cache.get(cacheKey).catch(() => null)

    if (cached) {
      return NextResponse.json(JSON.parse(cached), { headers: { 'X-Cache': 'HIT' } })
    }

    // Fetch limit + 1 to determine if there is a next page
    const products = await prisma.product.findMany({
      where,
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    })

    const hasNextPage = products.length > limit
    const page = hasNextPage ? products.slice(0, limit) : products
    const lastItem = page[page.length - 1]
    const nextCursor = hasNextPage && lastItem ? encodeCursor(lastItem.id) : null

    const payload = {
      data: page,
      nextCursor,
      pagination: {
        limit,
        nextCursor,
        hasNextPage,
      },
    }

    // Populate cache asynchronously (fire-and-forget, non-blocking)
    cache
      .set(cacheKey, JSON.stringify(payload), PRODUCTS_CACHE_TTL)
      .catch(() => {
        // Redis unavailable — degrade gracefully, do not throw
      })

    return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('[GET /api/products] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve products.',
        },
      },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/products  (admin only)
// ---------------------------------------------------------------------------
// Body: ProductSchema
// Creates a new product. Redis cache for the list is invalidated on success.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req) => {
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

    const result = ProductSchema.safeParse(body)

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

    const {
      name,
      description,
      price,
      category,
      stock,
      minimumStock,
      photos,
      isFeatured,
    } = result.data

    // Create product + initial stock tracking record in a transaction
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          description: description ?? null,
          price,
          category,
          stock,
          minimumStock,
          photos: photos ?? [],
          isFeatured,
        },
      })

      return created
    })

    // Invalidate first-page cache keys (cursor=null means first page)
    const commonKeys = [
      buildCacheKey(null, false, null, 20),
      buildCacheKey(null, true, null, 20),
      buildCacheKey(product.category, false, null, 20),
      buildCacheKey(product.category, true, null, 20),
    ]
    await Promise.allSettled(commonKeys.map((k) => cache.del(k)))

    return NextResponse.json(
      {
        success: true,
        data: product,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/products] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create product.',
        },
      },
      { status: 500 },
    )
  }
})
