import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateAdminOrderSchema } from '@/lib/validators'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAX_RATE = 0.2 // 20 %

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const todayCount = await tx.order.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  })

  const seq = String(todayCount + 1).padStart(4, '0')
  return `ORD-${yyyy}-${mm}-${dd}-${seq}`
}

// Full order include shape — reused across GET and POST
const ORDER_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      profile: {
        select: { firstName: true, lastName: true, phone: true },
      },
    },
  },
  items: {
    include: {
      product: {
        select: { id: true, name: true, price: true, category: true, photos: true },
      },
    },
  },
  payment: true,
  delivery: {
    include: {
      driver: {
        select: {
          id: true,
          email: true,
          profile: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  },
} as const

// ---------------------------------------------------------------------------
// GET /api/admin/orders
// ---------------------------------------------------------------------------
// Query params:
//   status      – OrderStatus enum value
//   search      – matches customer email OR order number (case-insensitive)
//   dateFrom    – ISO date string (inclusive lower bound on createdAt)
//   dateTo      – ISO date string (inclusive upper bound on createdAt)
//   cursor      – base64url-encoded order id for cursor pagination
//   limit       – page size (default 20, max 100)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const rawStatus = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const rawCursor = searchParams.get('cursor')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))

    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'IN_PROGRESS',
      'DELIVERED',
      'CANCELLED',
    ] as const
    type OrderStatusValue = (typeof validStatuses)[number]

    const status: OrderStatusValue | undefined =
      rawStatus && validStatuses.includes(rawStatus as OrderStatusValue)
        ? (rawStatus as OrderStatusValue)
        : undefined

    // Build where clause
    const where: Prisma.OrderWhereInput = {}

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) {
        // Make dateTo inclusive through end of day
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Decode cursor
    let cursorId: string | undefined
    if (rawCursor) {
      try {
        cursorId = Buffer.from(rawCursor, 'base64url').toString('utf8')
      } catch {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid cursor.' } },
          { status: 400 },
        )
      }
    }

    const orders = await prisma.order.findMany({
      where,
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    })

    const hasNextPage = orders.length > limit
    const page = hasNextPage ? orders.slice(0, limit) : orders
    const lastItem = page[page.length - 1]
    const nextCursor =
      hasNextPage && lastItem ? Buffer.from(lastItem.id).toString('base64url') : null

    return NextResponse.json({
      success: true,
      data: page,
      pagination: { limit, nextCursor, hasNextPage },
    })
  } catch (error) {
    console.error('[GET /api/admin/orders] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list orders.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/orders  — create an order manually from the admin panel
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

    const result = CreateAdminOrderSchema.safeParse(body)
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

    const { userId, items, paymentMethod, deliveryAddress, deliveryCity, deliveryZipCode } =
      result.data

    // Verify customer exists
    const customer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: 'USER_NOT_FOUND', message: `User '${userId}' was not found.` } },
        { status: 404 },
      )
    }

    // Pre-flight: resolve products + validate stock
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        packaging: { select: { name: true, priceModifier: true } },
      },
    })

    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productMap.get(item.productId)

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Product '${item.productId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_STOCK',
              message: `Insufficient stock for '${product.name}'. Available: ${product.stock}, requested: ${item.quantity}.`,
              details: { productId: item.productId, available: product.stock, requested: item.quantity },
            },
          },
          { status: 409 },
        )
      }

      if (item.packaging) {
        const validPackaging = product.packaging.find((p) => p.name === item.packaging)
        if (!validPackaging) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_PACKAGING',
                message: `Packaging '${item.packaging}' is not available for '${product.name}'.`,
              },
            },
            { status: 422 },
          )
        }
      }
    }

    // Compute totals
    let subtotal = new Prisma.Decimal(0)

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)!
      const packagingPrice = item.packaging
        ? (product.packaging.find((p) => p.name === item.packaging)?.priceModifier ??
          new Prisma.Decimal(0))
        : new Prisma.Decimal(0)

      const lineTotal = product.price.add(packagingPrice).mul(item.quantity)
      subtotal = subtotal.add(lineTotal)

      return {
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: product.price,
        packaging: item.packaging ?? null,
        packagingPrice: new Prisma.Decimal(packagingPrice),
      }
    })

    const taxAmount = subtotal.mul(TAX_RATE).toDecimalPlaces(2)
    const totalPrice = subtotal.add(taxAmount).toDecimalPlaces(2)

    // Atomic transaction
    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx)

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          subtotal,
          taxAmount,
          totalPrice,
          deliveryAddress: deliveryAddress ?? 'Admin order',
          deliveryCity: deliveryCity ?? 'N/A',
          deliveryZipCode: deliveryZipCode ?? '00000',
          status: 'PENDING',
          items: { create: lineItems },
          payment: {
            create: { amount: totalPrice, method: paymentMethod, status: 'PENDING' },
          },
          delivery: {
            create: { status: 'UNASSIGNED' },
          },
        },
        include: ORDER_INCLUDE,
      })

      // Decrement stock atomically
      await Promise.all(
        items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          }),
        ),
      )

      return created
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/orders] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order.' } },
      { status: 500 },
    )
  }
})
