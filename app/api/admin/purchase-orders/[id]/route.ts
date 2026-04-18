/**
 * GET   /api/admin/purchase-orders/[id]  — Fetch a single purchase order
 * PATCH /api/admin/purchase-orders/[id]  — Update PO status (and optionally deliveredAt)
 *   When status transitions to "delivered", automatically increments the
 *   relevant LabStock entries at all labs that had a matching stock row,
 *   or prompts the caller to specify a labId via the request body.
 *
 * Body (PATCH):
 *   { status: "pending"|"ordered"|"delivered"|"cancelled", deliveredAt?: ISO string, labId?: CUID }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdatePurchaseOrderStatusSchema } from '@/lib/validators-production'
import { ZodError } from 'zod'
import { z } from 'zod'
import type { AuthToken } from '@/lib/auth-middleware'

type RouteContext = { params?: Record<string, string | string[]>; token: AuthToken }

function notFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found.' } },
    { status: 404 },
  )
}

// Extend the base schema to accept an optional labId for delivery targeting
const PatchPoSchema = UpdatePurchaseOrderStatusSchema.extend({
  labId: z.string().cuid('labId must be a valid CUID').optional(),
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) return notFound()

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, leadTimeDays: true } },
        material: { select: { id: true, name: true, unit: true } },
      },
    })

    if (!po) return notFound()
    return NextResponse.json({ success: true, data: po })
  } catch (err) {
    console.error('[purchase-orders/[id]] GET error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve purchase order.' } },
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

    const input = PatchPoSchema.parse(body)

    const po = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!po) return notFound()

    // Guard: cannot un-cancel or un-deliver
    if (po.status === 'cancelled' && input.status !== 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A cancelled purchase order cannot be re-activated.' } },
        { status: 409 },
      )
    }

    const now = new Date()
    const updateData: Record<string, unknown> = { status: input.status }

    if (input.status === 'delivered') {
      updateData.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : now

      // Increment stock for the targeted lab (if provided) or all labs that
      // already track this material
      if (input.labId) {
        await prisma.labStock.upsert({
          where: { labId_materialId: { labId: input.labId, materialId: po.materialId } },
          create: {
            labId: input.labId,
            materialId: po.materialId,
            quantity: po.quantity,
            minThreshold: 0,
          },
          update: { quantity: { increment: po.quantity } },
        })
      } else {
        // Distribute to all labs that have an existing stock row for this material
        const existingStocks = await prisma.labStock.findMany({
          where: { materialId: po.materialId },
          select: { labId: true, materialId: true },
        })
        if (existingStocks.length > 0) {
          await Promise.all(
            existingStocks.map((s) =>
              prisma.labStock.update({
                where: { labId_materialId: { labId: s.labId, materialId: s.materialId } },
                data: { quantity: { increment: po.quantity } },
              }),
            ),
          )
        }
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.purchaseOrder.update>[0]['data'],
      include: {
        supplier: { select: { id: true, name: true } },
        material: { select: { id: true, name: true, unit: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid update data.', details: err.errors },
        },
        { status: 422 },
      )
    }
    if ((err as { code?: string }).code === 'P2025') return notFound()
    console.error('[purchase-orders/[id]] PATCH error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update purchase order.' } },
      { status: 500 },
    )
  }
})
