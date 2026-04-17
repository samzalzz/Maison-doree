/**
 * GET  /api/admin/suppliers
 *   List all suppliers, optionally filtered by category.
 *   Query params:
 *     category – filter by category string (case-insensitive contains)
 *     skip     – pagination offset (default 0)
 *     take     – page size (default 20, max 100)
 *
 * POST /api/admin/suppliers
 *   Create a new supplier.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateSupplierSchema } from '@/lib/validators-production'
import { ZodError } from 'zod'

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const category = searchParams.get('category') ?? undefined
    const skipRaw = parseInt(searchParams.get('skip') ?? '0', 10)
    const takeRaw = parseInt(searchParams.get('take') ?? '20', 10)

    const skip = Number.isNaN(skipRaw) || skipRaw < 0 ? 0 : skipRaw
    const take = Number.isNaN(takeRaw) || takeRaw < 1 ? 20 : Math.min(takeRaw, 100)

    // Prisma does not support case-insensitive array contains natively for
    // PostgreSQL string arrays; we fetch all and filter in JS for simplicity.
    const allSuppliers = await prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    })

    const filtered = category
      ? allSuppliers.filter((s) =>
          s.categories.some((c) => c.toLowerCase().includes(category.toLowerCase())),
        )
      : allSuppliers

    const total = filtered.length
    const paged = filtered.slice(skip, skip + take)

    return NextResponse.json({
      success: true,
      data: paged,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (err) {
    console.error('[suppliers] GET error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve suppliers.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const input = CreateSupplierSchema.parse(body)

    const supplier = await prisma.supplier.create({
      data: {
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        leadTimeDays: input.leadTimeDays,
        categories: input.categories,
      },
    })

    return NextResponse.json({ success: true, data: supplier }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid supplier data.',
            details: err.errors,
          },
        },
        { status: 422 },
      )
    }
    console.error('[suppliers] POST error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create supplier.' },
      },
      { status: 500 },
    )
  }
})
