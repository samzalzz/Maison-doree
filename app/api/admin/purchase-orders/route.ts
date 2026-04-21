/**
 * GET  /api/admin/purchase-orders
 *   List purchase orders, filterable by status, supplierId, materialId.
 *   Query params:
 *     status     – "pending" | "ordered" | "delivered" | "cancelled" | "all" (default: "all")
 *     supplierId – filter by supplier CUID
 *     materialId – filter by material CUID
 *     skip       – pagination offset (default 0)
 *     take       – page size (default 20, max 100)
 *
 * POST /api/admin/purchase-orders
 *   Create a new purchase order.
 *   Also called by the workflow engine when a CREATE_ORDER action fires.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreatePurchaseOrderSchema, CreatePurchaseOrderSingleSchema } from '@/lib/validators-production'
import { ZodError } from 'zod'

const VALID_PO_STATUSES = ['pending', 'ordered', 'delivered', 'cancelled'] as const
type PoStatus = (typeof VALID_PO_STATUSES)[number]

// ---------------------------------------------------------------------------
// PO number generator
// ---------------------------------------------------------------------------

async function generatePoNumber(): Promise<string> {
  const today = new Date()
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '')

  // Count POs created today to derive a sequence number
  const startOfDay = new Date(today)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setUTCHours(23, 59, 59, 999)

  const count = await prisma.purchaseOrder.count({
    where: { createdAt: { gte: startOfDay, lte: endOfDay } },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `PO-${yyyymmdd}-${seq}`
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const statusParam = searchParams.get('status') ?? 'all'
    const supplierId = searchParams.get('supplierId') ?? undefined
    const materialId = searchParams.get('materialId') ?? undefined

    const skipRaw = parseInt(searchParams.get('skip') ?? '0', 10)
    const takeRaw = parseInt(searchParams.get('take') ?? '20', 10)
    const skip = Number.isNaN(skipRaw) || skipRaw < 0 ? 0 : skipRaw
    const take = Number.isNaN(takeRaw) || takeRaw < 1 ? 20 : Math.min(takeRaw, 100)

    const statusFilter: PoStatus[] =
      statusParam === 'all'
        ? [...VALID_PO_STATUSES]
        : VALID_PO_STATUSES.includes(statusParam as PoStatus)
          ? [statusParam as PoStatus]
          : [...VALID_PO_STATUSES]

    const where = {
      status: { in: statusFilter },
      ...(supplierId ? { supplierId } : {}),
      ...(materialId ? { materialId } : {}),
    }

    const [total, purchaseOrders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          material: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: purchaseOrders,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (err) {
    console.error('[purchase-orders] GET error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve purchase orders.' },
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

    // Try parsing with new multi-item schema first, then fallback to single-item for backwards compatibility
    let input: any
    let isMultiItem = false

    try {
      input = CreatePurchaseOrderSchema.parse(body)
      isMultiItem = true
    } catch (newSchemaErr) {
      // Try old single-item schema for backwards compatibility
      try {
        const singleInput = CreatePurchaseOrderSingleSchema.parse(body)
        // Convert old format to new format
        input = {
          supplierId: singleInput.supplierId,
          items: [
            {
              materialId: singleInput.materialId,
              quantity: singleInput.quantity,
              unitPrice: (singleInput.cost ?? 0) / singleInput.quantity,
            },
          ],
          deliveryDate: singleInput.deliveryDate,
        }
      } catch {
        throw newSchemaErr
      }
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } })
    if (!supplier) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Supplier not found.' } },
        { status: 404 },
      )
    }

    // Verify all materials exist
    const materialIds = input.items.map((item: any) => item.materialId)
    const materials = await prisma.rawMaterial.findMany({
      where: { id: { in: materialIds } },
    })

    if (materials.length !== materialIds.length) {
      const notFound = materialIds.filter((id: string) => !materials.find((m: any) => m.id === id))
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Raw materials not found: ${notFound.join(', ')}`,
          },
        },
        { status: 404 },
      )
    }

    const poNumber = await generatePoNumber()

    // Create PO with items in a transaction
    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: input.supplierId,
        deliveryDate: new Date(input.deliveryDate),
        status: 'pending',
        totalCost: input.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0),
        items: {
          create: input.items.map((item: any) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: po }, { status: 201 })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid purchase order data.',
            details: err.errors,
          },
        },
        { status: 422 },
      )
    }
    console.error('[purchase-orders] POST error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create purchase order.' },
      },
      { status: 500 },
    )
  }
})
