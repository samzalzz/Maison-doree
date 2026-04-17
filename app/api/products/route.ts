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
  skip: number,
  take: number,
): string {
  return `products:list:cat=${category ?? 'all'}:featured=${featured}:skip=${skip}:take=${take}`
}

// ---------------------------------------------------------------------------
// GET /api/products  (public)
// ---------------------------------------------------------------------------
// Query params:
//   category  – filter by ProductCategory enum value
//   featured  – "true" to return only featured products
//   skip      – pagination offset (default 0)
//   take      – page size (default 20, max 100)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)

    // Parse and sanitise query parameters
    const rawCategory = searchParams.get('category')
    const featured = searchParams.get('featured') === 'true'
    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20),
    )

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

    // Try cache first
    const cacheKey = buildCacheKey(category, featured, skip, take)
    const cached = await cache.get(cacheKey).catch(() => null)

    if (cached) {
      return NextResponse.json(JSON.parse(cached), {
        headers: { 'X-Cache': 'HIT' },
      })
    }

    // Build Prisma where clause
    const where: {
      category?: ProductCategory
      isFeatured?: boolean
    } = {}

    if (category) where.category = category
    if (featured) where.isFeatured = true

    // Execute count + fetch in parallel
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])

    const payload = {
      data: products,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    }

    // Populate cache asynchronously (fire-and-forget, non-blocking)
    cache
      .set(cacheKey, JSON.stringify(payload), PRODUCTS_CACHE_TTL)
      .catch(() => {
        // Redis unavailable — degrade gracefully, do not throw
      })

    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS' },
    })
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

    // Invalidate all product-list cache keys pattern by a best-effort flush
    // (ioredis does not support keyspace notifications without config, so we
    // flush only the most common first-page keys to keep things simple)
    const commonKeys = [
      buildCacheKey(null, false, 0, 20),
      buildCacheKey(null, true, 0, 20),
      buildCacheKey(product.category, false, 0, 20),
      buildCacheKey(product.category, true, 0, 20),
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
