/**
 * GET    /api/admin/products/[id]  — Fetch a single product with full relations
 * PATCH  /api/admin/products/[id]  — Partially update a product
 * DELETE /api/admin/products/[id]  — Delete a product (blocked when active order items exist)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/redis'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateProductSchema } from '@/lib/validators'
import type { AuthToken } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = { params?: Record<string, string | string[]>; token: AuthToken }

// ---------------------------------------------------------------------------
// Cache helpers (must mirror the keys used by the public routes so both
// surfaces stay consistent after a mutation).
// ---------------------------------------------------------------------------

function publicDetailKey(id: string): string {
  return `products:detail:${id}`
}

const PUBLIC_LIST_CACHE_KEYS = [
  'products:list:cat=all:featured=false:cursor=null:limit=20',
  'products:list:cat=all:featured=true:cursor=null:limit=20',
]

function publicCategoryKeys(category: string): string[] {
  return [
    `products:list:cat=${category}:featured=false:cursor=null:limit=20`,
    `products:list:cat=${category}:featured=true:cursor=null:limit=20`,
  ]
}

async function bustProductCache(id: string, category?: string): Promise<void> {
  const keys = [
    publicDetailKey(id),
    ...PUBLIC_LIST_CACHE_KEYS,
    ...(category ? publicCategoryKeys(category) : []),
  ]
  await Promise.allSettled(keys.map((k) => cache.del(k)))
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function notFound(id: string): NextResponse {
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

function resolveId(params?: Record<string, string | string[]>): string | null {
  const raw = params?.id
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] : raw
}

// ---------------------------------------------------------------------------
// GET /api/admin/products/[id]
// ---------------------------------------------------------------------------
// Returns the product with all packaging options, rating summary, and an
// active order count so the admin UI can decide whether deletion is safe.
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = resolveId(params)
  if (!id) return notFound('')

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        packaging: { orderBy: { priceModifier: 'asc' } },
        ratings: {
          where: { type: 'PRODUCT' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            score: true,
            comment: true,
            createdAt: true,
            userId: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
            ratings: true,
            packaging: true,
          },
        },
      },
    })

    if (!product) return notFound(id)

    // Compute how many order items belong to non-terminal orders so the UI
    // can warn the admin before attempting a delete.
    const activeOrderItemCount = await prisma.orderItem.count({
      where: {
        productId: id,
        order: {
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: { ...product, activeOrderItemCount },
    })
  } catch (err) {
    console.error(`[GET /api/admin/products/${id}] Error:`, err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve product.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/products/[id]
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = resolveId(params)
  if (!id) return notFound('')

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

  const parsed = UpdateProductSchema.safeParse(body)
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

  // Require at least one field
  if (Object.keys(parsed.data).length === 0) {
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

  const input = parsed.data

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.minimumStock !== undefined && { minimumStock: input.minimumStock }),
        ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
        ...(input.photos !== undefined && { photos: input.photos }),
      },
    })

    // Bust all affected cache keys (use updated category for list invalidation)
    await bustProductCache(id, product.category)

    return NextResponse.json({ success: true, data: product })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFound(id)
    }
    console.error(`[PATCH /api/admin/products/${id}] Error:`, err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update product.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/products/[id]
// ---------------------------------------------------------------------------
// Cascade behaviour in the Prisma schema:
//   - OrderItem  → no onDelete directive (defaults to Restrict in PostgreSQL)
//   - Rating     → onDelete: SetNull  (ratings are kept, productId nulled)
//   - Packaging  → onDelete: Cascade  (packaging rows are removed)
//
// Strategy: block deletion when any OrderItem still references this product
// (regardless of order status) to maintain historical order integrity.
// Ratings are not a blocker — Prisma/Postgres will null them automatically.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = resolveId(params)
  if (!id) return notFound('')

  try {
    // Pre-flight: check for referencing order items
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } })
    if (orderItemCount > 0) {
      // Provide a breakdown to help the admin decide next steps
      const activeCount = await prisma.orderItem.count({
        where: {
          productId: id,
          order: { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        },
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message:
              `Cannot delete product — it is referenced by ${orderItemCount} order item(s)` +
              (activeCount > 0
                ? ` (${activeCount} in active orders).`
                : '. All orders are completed or cancelled, but historical records must be preserved.'),
            details: {
              totalOrderItems: orderItemCount,
              activeOrderItems: activeCount,
            },
          },
        },
        { status: 409 },
      )
    }

    // Fetch the category before deletion so we can bust the right cache keys
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { category: true },
    })
    if (!existing) return notFound(id)

    await prisma.product.delete({ where: { id } })

    await bustProductCache(id, existing.category)

    return NextResponse.json({
      success: true,
      data: { id, message: `Product '${id}' deleted successfully.` },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFound(id)
    }
    // P2003 = foreign key constraint failure (safety net even after our pre-flight check)
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Product is still referenced by other records and cannot be deleted.',
          },
        },
        { status: 409 },
      )
    }
    console.error(`[DELETE /api/admin/products/${id}] Error:`, err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete product.' },
      },
      { status: 500 },
    )
  }
})
