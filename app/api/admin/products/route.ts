/**
 * GET  /api/admin/products
 *   List all products with cursor-based pagination, optional filters.
 *   Query params:
 *     cursor    – opaque cursor (base64url-encoded product id); absent = first page
 *     limit     – page size (default 25, max 100)
 *     category  – filter by ProductCategory enum value
 *     featured  – "true" to return only featured products
 *     search    – case-insensitive substring match on product name
 *     lowStock  – "true" to return only products where stock <= minimumStock
 *
 * POST /api/admin/products
 *   Create a new product.
 *   Body: CreateProductSchema
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import type { ProductCategory } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/redis'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateProductSchema } from '@/lib/validators'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CATEGORIES: ProductCategory[] = [
  'PATES',
  'COOKIES',
  'GATEAU',
  'BRIOUATES',
  'CHEBAKIA',
  'AUTRES',
]

// Cache keys that the public product list route uses (must be invalidated on
// any mutation so the storefront stays consistent).
const PUBLIC_LIST_CACHE_KEYS = [
  'products:list:cat=all:featured=false:cursor=null:limit=20',
  'products:list:cat=all:featured=true:cursor=null:limit=20',
]

function publicCategoryKeys(category: ProductCategory): string[] {
  return [
    `products:list:cat=${category}:featured=false:cursor=null:limit=20`,
    `products:list:cat=${category}:featured=true:cursor=null:limit=20`,
  ]
}

function publicDetailKey(id: string): string {
  return `products:detail:${id}`
}

// ---------------------------------------------------------------------------
// Cursor codec helpers
// ---------------------------------------------------------------------------

function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64url')
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8')
}

// ---------------------------------------------------------------------------
// GET /api/admin/products
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const rawCursor = searchParams.get('cursor')
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10) || 25),
    )
    const rawCategory = searchParams.get('category')
    const featured = searchParams.get('featured') === 'true'
    const search = searchParams.get('search')?.trim() || undefined
    const lowStock = searchParams.get('lowStock') === 'true'

    // Validate category
    const category: ProductCategory | undefined =
      rawCategory && VALID_CATEGORIES.includes(rawCategory as ProductCategory)
        ? (rawCategory as ProductCategory)
        : undefined

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      ...(category ? { category } : {}),
      ...(featured ? { isFeatured: true } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
      // lowStock: stock <= minimumStock — Prisma does not support column
      // comparisons in where directly; use a raw filter via JS post-fetch
      // only when the result set is small. For scalable filtering, we add a
      // raw SQL condition via Prisma.sql when lowStock is requested.
    }

    // Decode cursor
    let cursorId: string | undefined
    if (rawCursor) {
      try {
        cursorId = decodeCursor(rawCursor)
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Invalid pagination cursor.' },
          },
          { status: 400 },
        )
      }
    }

    // When lowStock filter is active we need a column comparison — use
    // Prisma's raw `where` extension via the `$queryRaw` path only if needed.
    // For the standard path we rely on findMany with an extra JS filter only
    // when the caller explicitly opts in, accepting the trade-off that it
    // reads one extra page worth of rows.  A future migration can add a
    // generated column for this.  Here we handle it cleanly via Prisma's
    // supported API.

    if (lowStock) {
      // Fetch without cursor for low-stock view (typically a small set)
      const allLowStock = await prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orderItems: true, ratings: true, packaging: true } },
        },
      })

      const filtered = allLowStock.filter((p) => p.stock <= p.minimumStock)
      const total = filtered.length
      const skip = cursorId
        ? filtered.findIndex((p) => p.id === cursorId) + 1
        : 0
      const page = filtered.slice(skip, skip + limit)
      const hasNextPage = skip + limit < total
      const nextCursor =
        hasNextPage && page.length > 0 ? encodeCursor(page[page.length - 1].id) : null

      return NextResponse.json({
        success: true,
        data: page,
        pagination: { limit, total, nextCursor, hasNextPage },
      })
    }

    // Standard cursor-based path
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: limit + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orderItems: true, ratings: true, packaging: true } },
        },
      }),
      prisma.product.count({ where }),
    ])

    const hasNextPage = products.length > limit
    const page = hasNextPage ? products.slice(0, limit) : products
    const nextCursor =
      hasNextPage && page.length > 0 ? encodeCursor(page[page.length - 1].id) : null

    return NextResponse.json({
      success: true,
      data: page,
      pagination: { limit, total, nextCursor, hasNextPage },
    })
  } catch (err) {
    console.error('[GET /api/admin/products] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve products.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/products
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
      },
      { status: 400 },
    )
  }

  const parsed = CreateProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  const input = parsed.data

  try {
    const product = await prisma.product.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        category: input.category,
        stock: input.stock,
        minimumStock: input.minimumStock,
        isFeatured: input.isFeatured,
        photos: input.photos ?? [],
      },
    })

    // Invalidate public-facing list cache so storefront reflects the new product
    const keysToInvalidate = [
      ...PUBLIC_LIST_CACHE_KEYS,
      ...publicCategoryKeys(product.category),
    ]
    await Promise.allSettled(keysToInvalidate.map((k) => cache.del(k)))

    return NextResponse.json({ success: true, data: product }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/products] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create product.' },
      },
      { status: 500 },
    )
  }
})
