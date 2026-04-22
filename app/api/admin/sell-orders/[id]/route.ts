/**
 * GET   /api/admin/sell-orders/[id]  — Fetch a single sell order
 * PATCH /api/admin/sell-orders/[id]  — Update SO status
 *   When status transitions to "picking", automatically decrements FINISHED_PRODUCT
 *   stock from the associated LabStock entries.
 *
 * Body (PATCH):
 *   { status: "draft"|"confirmed"|"picking"|"shipped"|"delivered"|"cancelled" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import type { AuthToken } from '@/lib/auth-middleware'

type RouteContext = { params?: Record<string, string | string[]>; token: AuthToken }

const UpdateSellOrderStatusSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'picking', 'shipped', 'delivered', 'cancelled']),
})

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Sell order not found.' } },
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
    const so = await prisma.sellOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })

    if (!so) return notFound()
    return NextResponse.json({ success: true, data: so })
  } catch (err) {
    console.error('[sell-orders/[id]] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve sell order.' } },
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

    const input = UpdateSellOrderStatusSchema.parse(body)

    const so = await prisma.sellOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!so) return notFound()

    // Guard: cannot un-cancel
    if (so.status === 'cancelled' && input.status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A cancelled sell order cannot be re-activated.' } },
        { status: 409 },
      )
    }

    // When transitioning to "picking", decrement FINISHED_PRODUCT stock for each item
    if (input.status === 'picking' && so.status !== 'picking') {
      const { Decimal } = require('@prisma/client/runtime/library')

      // Decrement stock for each SellOrderItem
      await Promise.all(
        so.items.map(async (item) => {
          const stock = await prisma.labStock.findUnique({
            where: {
              labId_materialId_stockType: {
                labId: item.labId || '', // Will fail gracefully if labId missing
                materialId: item.materialId,
                stockType: 'FINISHED_PRODUCT',
              },
            },
          })

          if (stock) {
            const newQty = stock.quantity.minus(new Decimal(item.quantity.toString()))
            if (newQty.isNegative()) {
              throw new Error(
                `Insufficient FINISHED_PRODUCT stock for material ${item.materialId}: have ${stock.quantity}, need ${item.quantity}`,
              )
            }

            await prisma.labStock.update({
              where: {
                labId_materialId_stockType: {
                  labId: item.labId,
                  materialId: item.materialId,
                  stockType: 'FINISHED_PRODUCT',
                },
              },
              data: { quantity: newQty },
            })
          }
        }),
      )
    }

    const now = new Date()
    const updateData: Record<string, unknown> = { status: input.status }

    if (input.status === 'shipped') {
      updateData.shippedAt = now
    }
    if (input.status === 'delivered') {
      updateData.deliveredAt = now
    }

    const updated = await prisma.sellOrder.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.sellOrder.update>[0]['data'],
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid update data.', details: err.errors },
        },
        { status: 422 },
      )
    }
    if (err instanceof Error && err.message.includes('Insufficient')) {
      return NextResponse.json(
        { success: false, error: { code: 'INSUFFICIENT_STOCK', message: err.message } },
        { status: 409 },
      )
    }
    console.error('[sell-orders/[id]] PATCH error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update sell order.' } },
      { status: 500 },
    )
  }
})
