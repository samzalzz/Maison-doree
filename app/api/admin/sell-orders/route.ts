import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// Validation schemas
const CreateSellOrderSchema = z.object({
  customerId: z.string().cuid(),
  items: z.array(
    z.object({
      materialId: z.string().cuid(),
      labStockId: z.string().cuid(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
    }),
  ),
})

// ---------------------------------------------------------------------------
// GET /api/admin/sell-orders
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const skipRaw = parseInt(searchParams.get('skip') ?? '0', 10)
    const takeRaw = parseInt(searchParams.get('take') ?? '20', 10)

    const skip = Number.isNaN(skipRaw) || skipRaw < 0 ? 0 : skipRaw
    const take = Number.isNaN(takeRaw) || takeRaw < 1 ? 20 : Math.min(takeRaw, 100)

    const where = status ? { status } : {}

    const [total, sellOrders] = await Promise.all([
      prisma.sellOrder.count({ where }),
      prisma.sellOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          items: {
            include: {
              material: { select: { id: true, name: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: sellOrders,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (err) {
    console.error('[sell-orders] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve sell orders.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/sell-orders
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const input = CreateSellOrderSchema.parse(body)

    // Verify customer exists
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } })
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Customer not found.' } },
        { status: 404 },
      )
    }

    // Calculate totals
    const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const taxAmount = subtotal * 0.2 // 20% tax
    const totalPrice = subtotal + taxAmount

    // Generate order number
    const today = new Date()
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '')
    const count = await prisma.sellOrder.count({
      where: {
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
        },
      },
    })
    const orderNumber = `SO-${yyyymmdd}-${String(count + 1).padStart(3, '0')}`

    const { Decimal } = require('@prisma/client/runtime/library')

    // Create sell order with items
    const sellOrder = await prisma.sellOrder.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        subtotal: new Decimal(subtotal.toString()),
        taxAmount: new Decimal(taxAmount.toString()),
        totalPrice: new Decimal(totalPrice.toString()),
        items: {
          create: input.items.map((item) => ({
            materialId: item.materialId,
            labStockId: item.labStockId,
            quantity: new Decimal(item.quantity.toString()),
            unitPrice: new Decimal(item.unitPrice.toString()),
            lineTotal: new Decimal((item.quantity * item.unitPrice).toString()),
          })),
        },
      },
      include: {
        customer: true,
        items: { include: { material: true } },
      },
    })

    return NextResponse.json({ success: true, data: sellOrder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', details: error.errors } },
        { status: 422 },
      )
    }
    console.error('[sell-orders] POST error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create sell order.' } },
      { status: 500 },
    )
  }
})
