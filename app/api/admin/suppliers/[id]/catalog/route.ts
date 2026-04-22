/**
 * GET    /api/admin/suppliers/[id]/catalog   — List materials in supplier's catalog
 * POST   /api/admin/suppliers/[id]/catalog   — Add material to supplier's catalog
 * DELETE /api/admin/suppliers/[id]/catalog?materialId=... — Remove material from catalog
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { ZodError, z } from 'zod'

type RouteContext = { params?: Record<string, string | string[]> }

const CreateCatalogItemSchema = z.object({
  materialId: z.string().min(1, 'Material ID required'),
  unitPrice: z.number().positive('Price must be positive'),
  minOrderQty: z.number().int().positive('Minimum order qty must be positive').default(1),
  leadTimeDays: z.number().int().nonnegative('Lead time days must be non-negative').optional(),
})

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } },
    { status: 404 },
  )
}

// GET - List supplier's catalog items with material details
export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!supplier) return notFound()

    const catalogs = await prisma.supplierCatalog.findMany({
      where: { supplierId: id },
      include: {
        material: { select: { id: true, name: true, unit: true, type: true } },
      },
      orderBy: { material: { name: 'asc' } },
    })

    return NextResponse.json({
      success: true,
      data: {
        supplier,
        items: catalogs,
        count: catalogs.length,
      },
    })
  } catch (err) {
    console.error('[suppliers/[id]/catalog] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve catalog.' } },
      { status: 500 },
    )
  }
})

// POST - Add material to supplier's catalog
export const POST = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
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

    const input = CreateCatalogItemSchema.parse(body)

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) return notFound()

    // Verify material exists
    const material = await prisma.rawMaterial.findUnique({
      where: { id: input.materialId },
    })
    if (!material) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Material not found.' } },
        { status: 404 },
      )
    }

    // Check if already in catalog
    const existing = await prisma.supplierCatalog.findUnique({
      where: {
        supplierId_materialId: { supplierId: id, materialId: input.materialId },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Material already in this supplier\'s catalog.' } },
        { status: 409 },
      )
    }

    // Create catalog entry
    const catalogItem = await prisma.supplierCatalog.create({
      data: {
        supplierId: id,
        materialId: input.materialId,
        unitPrice: input.unitPrice,
        minOrderQty: input.minOrderQty,
        leadTimeDays: input.leadTimeDays ?? supplier.leadTimeDays,
      },
      include: {
        material: { select: { id: true, name: true, unit: true } },
      },
    })

    return NextResponse.json({ success: true, data: catalogItem }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid catalog item data.', details: err.errors },
        },
        { status: 422 },
      )
    }
    console.error('[suppliers/[id]/catalog] POST error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add material to catalog.' } },
      { status: 500 },
    )
  }
})

// DELETE - Remove material from supplier's catalog
export const DELETE = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const { searchParams } = new URL(req.url)
    const materialId = searchParams.get('materialId')

    if (!materialId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'materialId query parameter required.' } },
        { status: 400 },
      )
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) return notFound()

    // Delete catalog entry
    const deleted = await prisma.supplierCatalog.deleteMany({
      where: { supplierId: id, materialId },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Material not in this supplier\'s catalog.' } },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: { deleted: deleted.count } })
  } catch (err) {
    console.error('[suppliers/[id]/catalog] DELETE error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove material from catalog.' } },
      { status: 500 },
    )
  }
})
