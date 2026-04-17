/**
 * GET    /api/admin/suppliers/[id]   — Fetch a single supplier with its purchase orders
 * PATCH  /api/admin/suppliers/[id]   — Update supplier fields
 * DELETE /api/admin/suppliers/[id]   — Delete supplier (only when no POs reference it)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateSupplierSchema } from '@/lib/validators-production'
import { ZodError } from 'zod'
import type { AuthToken } from '@/lib/auth-middleware'

type RouteContext = { params?: Record<string, string | string[]>; token: AuthToken }

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } },
    { status: 404 },
  )
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          include: { material: { select: { id: true, name: true, unit: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!supplier) return notFound()
    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    console.error('[suppliers/[id]] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve supplier.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

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

    const input = UpdateSupplierSchema.parse(body)

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.leadTimeDays !== undefined && { leadTimeDays: input.leadTimeDays }),
        ...(input.categories !== undefined && { categories: input.categories }),
      },
    })

    return NextResponse.json({ success: true, data: supplier })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid supplier data.', details: err.errors },
        },
        { status: 422 },
      )
    }
    // Prisma P2025: record not found
    if ((err as { code?: string }).code === 'P2025') return notFound()
    console.error('[suppliers/[id]] PATCH error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update supplier.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    // Check for existing purchase orders first (onDelete: Restrict in schema)
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } })
    if (poCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Cannot delete supplier with ${poCount} existing purchase order(s). Cancel or reassign them first.`,
          },
        },
        { status: 409 },
      )
    }

    await prisma.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true, data: null })
  } catch (err) {
    if ((err as { code?: string }).code === 'P2025') return notFound()
    console.error('[suppliers/[id]] DELETE error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete supplier.' } },
      { status: 500 },
    )
  }
})
