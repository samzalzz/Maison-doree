/**
 * PATCH /api/admin/stocks/[productId]
 *   Adjust the stock level of a product by a signed integer delta.
 *
 *   Body: { adjustment: number }
 *     - Positive value → add stock
 *     - Negative value → remove stock
 *     - Result is clamped to >= 0 (stock cannot go below zero)
 *
 *   Response 200: { success: true, data: { id, name, stock, minimumStock } }
 *   Response 400: invalid body / non-numeric adjustment
 *   Response 404: product not found
 *   Response 500: internal error
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { cache } from '@/lib/redis'
import { withAdminAuth } from '@/lib/auth-middleware'
import type { AuthToken } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = {
  params?: Record<string, string | string[]>
  token: AuthToken
}

// ---------------------------------------------------------------------------
// Cache helpers — mirror the keys used by the public product routes so the
// storefront stays consistent after a stock mutation.
// ---------------------------------------------------------------------------

const PUBLIC_LIST_CACHE_KEYS = [
  'products:list:cat=all:featured=false:cursor=null:limit=20',
  'products:list:cat=all:featured=true:cursor=null:limit=20',
]

function publicDetailKey(id: string): string {
  return `products:detail:${id}`
}

function publicCategoryKeys(category: string): string[] {
  return [
    `products:list:cat=${category}:featured=false:cursor=null:limit=20`,
    `products:list:cat=${category}:featured=true:cursor=null:limit=20`,
  ]
}

async function bustProductCache(id: string, category: string): Promise<void> {
  const keys = [
    publicDetailKey(id),
    ...PUBLIC_LIST_CACHE_KEYS,
    ...publicCategoryKeys(category),
  ]
  await Promise.allSettled(keys.map((k) => cache.del(k)))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveId(params?: Record<string, string | string[]>): string | null {
  const raw = params?.productId
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] : raw
}

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

// ---------------------------------------------------------------------------
// PATCH /api/admin/stocks/[productId]
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }: RouteContext) => {
    const id = resolveId(params)
    if (!id) return notFound('')

    // Parse body
    let body: unknown
    try {
      body = await req.json()
    } catch {
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

    // Validate adjustment field
    if (
      typeof body !== 'object' ||
      body === null ||
      !('adjustment' in body)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Body must contain an "adjustment" field.',
          },
        },
        { status: 400 },
      )
    }

    const rawAdjustment = (body as Record<string, unknown>).adjustment

    if (typeof rawAdjustment !== 'number' || !Number.isFinite(rawAdjustment)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '"adjustment" must be a finite number.',
          },
        },
        { status: 400 },
      )
    }

    const adjustment = Math.trunc(rawAdjustment) // integer deltas only

    if (adjustment === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: '"adjustment" must be a non-zero integer.',
          },
        },
        { status: 400 },
      )
    }

    try {
      // Fetch current stock so we can clamp to >= 0
      const existing = await prisma.product.findUnique({
        where: { id },
        select: { id: true, stock: true, category: true },
      })

      if (!existing) return notFound(id)

      const newStock = Math.max(0, existing.stock + adjustment)

      const updated = await prisma.product.update({
        where: { id },
        data: { stock: newStock },
        select: {
          id: true,
          name: true,
          stock: true,
          minimumStock: true,
        },
      })

      // Bust public-facing cache
      await bustProductCache(id, existing.category)

      return NextResponse.json({ success: true, data: updated })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return notFound(id)
      }
      console.error(`[PATCH /api/admin/stocks/${id}] Error:`, err)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update stock.',
          },
        },
        { status: 500 },
      )
    }
  },
)
