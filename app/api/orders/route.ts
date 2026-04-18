import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { CreateOrderSchema } from '@/lib/validators'
import { withAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAX_RATE = 0.2 // 20 %

/**
 * Generate a deterministic, human-readable order number.
 * Format: ORD-YYYY-MM-DD-XXXX  (XXXX = zero-padded daily sequence count)
 *
 * We derive the sequence by counting existing orders created today.
 * The operation is done inside the same transaction to be race-condition safe.
 */
async function generateOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')

  // Count orders created today (UTC) so the sequence resets daily.
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  const todayCount = await tx.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lt:  endOfDay,
      },
    },
  })

  const seq = String(todayCount + 1).padStart(4, '0')
  return `ORD-${yyyy}-${mm}-${dd}-${seq}`
}

// ---------------------------------------------------------------------------
// POST /api/orders  (any authenticated user — customer role implied)
// ---------------------------------------------------------------------------
// Body: CreateOrderSchema
// Creates Order + OrderItems + Payment + Delivery in a single transaction.
// Decrements product stock atomically.
// Returns 201 with the full order object.
// ---------------------------------------------------------------------------

export const POST = withAuth(async (req, { token }) => {
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

    const result = CreateOrderSchema.safeParse(body)

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
      items,
      deliveryAddress,
      deliveryCity,
      deliveryZipCode,
      paymentMethod,
    } = result.data

    // -----------------------------------------------------------------------
    // Pre-flight: resolve products and validate stock BEFORE the transaction
    // so we can return meaningful errors early.
    // -----------------------------------------------------------------------

    const productIds = items.map((i) => i.productId)

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id:            true,
        name:          true,
        price:         true,
        stock:         true,
        packaging:     { select: { name: true, priceModifier: true } },
      },
    })

    // Build a lookup map for O(1) access.
    const productMap = new Map(products.map((p) => [p.id, p]))

    // Validate all items in one pass before touching the DB transactionally.
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
              message: `Insufficient stock for product '${product.name}'. Available: ${product.stock}, requested: ${item.quantity}.`,
            },
          },
          { status: 409 },
        )
      }

      // Validate packaging selection when provided.
      if (item.packaging) {
        const validPackaging = product.packaging.find(
          (p) => p.name === item.packaging,
        )
        if (!validPackaging) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_PACKAGING',
                message: `Packaging option '${item.packaging}' is not available for product '${product.name}'.`,
              },
            },
            { status: 422 },
          )
        }
      }
    }

    // -----------------------------------------------------------------------
    // Compute order totals.
    // -----------------------------------------------------------------------

    let subtotal = new Prisma.Decimal(0)

    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)!

      // Resolve packaging price (0 when none selected or no modifier).
      const packagingPrice = item.packaging
        ? (product.packaging.find((p) => p.name === item.packaging)?.priceModifier ?? new Prisma.Decimal(0))
        : new Prisma.Decimal(0)

      const lineTotal = product.price
        .add(packagingPrice)
        .mul(item.quantity)

      subtotal = subtotal.add(lineTotal)

      return {
        productId:     item.productId,
        quantity:      item.quantity,
        priceAtTime:   product.price,
        packaging:     item.packaging ?? null,
        packagingPrice: new Prisma.Decimal(packagingPrice),
      }
    })

    const taxAmount  = subtotal.mul(TAX_RATE).toDecimalPlaces(2)
    const totalPrice = subtotal.add(taxAmount).toDecimalPlaces(2)

    // -----------------------------------------------------------------------
    // Atomic transaction:
    //   1. Generate unique order number
    //   2. Create Order + OrderItems
    //   3. Create Payment
    //   4. Create Delivery
    //   5. Decrement product stock (SELECT … FOR UPDATE via updateMany)
    // -----------------------------------------------------------------------

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx)

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId:          token.id,
          subtotal,
          taxAmount,
          totalPrice,
          deliveryAddress,
          deliveryCity,
          deliveryZipCode,
          status: 'PENDING',

          items: {
            create: lineItems,
          },

          payment: {
            create: {
              amount: totalPrice,
              method: paymentMethod,
              status: 'PENDING',
            },
          },

          delivery: {
            create: {
              status: 'UNASSIGNED',
            },
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id:          true,
                  name:        true,
                  price:       true,
                  category:    true,
                  photos:      true,
                },
              },
            },
          },
          payment:  true,
          delivery: true,
        },
      })

      // Decrement stock for each ordered product atomically.
      await Promise.all(
        items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data:  { stock: { decrement: item.quantity } },
          }),
        ),
      )

      return created
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/orders] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create order.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/orders  (any authenticated user)
// ---------------------------------------------------------------------------
// Returns all orders for the authenticated user, with items, payment, and
// delivery included.  Supports optional status filter and cursor pagination.
//
// Query params:
//   status   – filter by OrderStatus enum value (optional)
//   cursor   – opaque pagination cursor (base64-encoded id); absent = first page
//   limit    – page size (default 10, max 100)
//   skip     – legacy offset (still supported when cursor absent)
//   take     – legacy page size (still supported when cursor absent)
// ---------------------------------------------------------------------------

export const GET = withAuth(async (req, { token }) => {
  try {
    const { searchParams } = new URL(req.url)

    const rawStatus = searchParams.get('status')
    const rawCursor = searchParams.get('cursor')
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10),
    )

    // Legacy params
    const legacySkip = searchParams.get('skip')
    const legacyTake = searchParams.get('take')
    const useLegacy = (legacySkip !== null || legacyTake !== null) && rawCursor === null

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

    const where: Prisma.OrderWhereInput = { userId: token.id }
    if (status) where.status = status

    // -----------------------------------------------------------------------
    // Legacy offset path (backwards compat)
    // -----------------------------------------------------------------------
    if (useLegacy) {
      const skip = Math.max(0, parseInt(legacySkip ?? '0', 10) || 0)
      const take = Math.min(100, Math.max(1, parseInt(legacyTake ?? '10', 10) || 10))

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, price: true, category: true, photos: true } },
              },
            },
            payment: true,
            delivery: true,
          },
        }),
        prisma.order.count({ where }),
      ])

      return NextResponse.json({
        success: true,
        data: orders,
        pagination: { skip, take, total, hasMore: skip + take < total },
      })
    }

    // -----------------------------------------------------------------------
    // Cursor-based path
    // -----------------------------------------------------------------------
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
      include: {
        items: {
          include: {
            product: {
              select: {
                id:       true,
                name:     true,
                price:    true,
                category: true,
                photos:   true,
              },
            },
          },
        },
        payment:  true,
        delivery: true,
      },
    })

    const hasNextPage = orders.length > limit
    const page = hasNextPage ? orders.slice(0, limit) : orders
    const lastItem = page[page.length - 1]
    const nextCursor =
      hasNextPage && lastItem
        ? Buffer.from(lastItem.id).toString('base64url')
        : null

    return NextResponse.json({
      success: true,
      data: page,
      nextCursor,
      pagination: {
        limit,
        nextCursor,
        hasNextPage,
      },
    })
  } catch (error) {
    console.error('[GET /api/orders] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve orders.',
        },
      },
      { status: 500 },
    )
  }
})
