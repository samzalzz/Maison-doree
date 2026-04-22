import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateLabStockSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// PATCH /api/admin/lab-stock/[labId]/[materialId]  (admin only)
// ---------------------------------------------------------------------------
// Performs an absolute stock adjustment for a specific (lab, material, stockType) tuple.
// The quantity field in the request body represents the NEW absolute level
// (not a delta), making this idempotent and safe to retry.
//
// Query params:
//   stockType - optional; defaults to RAW_MATERIAL for backward compatibility
//
// If the LabStock record does not exist yet (first stock entry for this
// material in this lab with this stock type), we create it with a default minThreshold of 0.
//
// Body: { quantity: number }  — must be >= 0
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { labId, materialId } = params as { labId: string; materialId: string }
      const { searchParams } = new URL(req.url)
      const stockType = searchParams.get('stockType') ?? 'RAW_MATERIAL'

      const body = await req.json().catch(() => null)

      if (!body || typeof body !== 'object') {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
          },
          { status: 400 },
        )
      }

      const result = UpdateLabStockSchema.safeParse(body)

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

      // Verify both the lab and material exist before touching stock rows
      const [lab, material] = await Promise.all([
        prisma.productionLab.findUnique({ where: { id: labId }, select: { id: true } }),
        prisma.rawMaterial.findUnique({ where: { id: materialId }, select: { id: true } }),
      ])

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'LAB_NOT_FOUND',
              message: `Lab '${labId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      if (!material) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MATERIAL_NOT_FOUND',
              message: `Raw material '${materialId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      // Upsert: update existing record or create a new one if this is the
      // first time this material is being stocked in this lab with this stock type.
      const stock = await prisma.labStock.upsert({
        where: {
          labId_materialId_stockType: { labId, materialId, stockType },
        },
        update: {
          quantity: new Prisma.Decimal(result.data.quantity),
        },
        create: {
          labId,
          materialId,
          stockType,
          quantity: new Prisma.Decimal(result.data.quantity),
          minThreshold: new Prisma.Decimal(0),
        },
        include: {
          material: {
            select: { id: true, name: true, type: true, unit: true },
          },
        },
      })

      return NextResponse.json({ success: true, data: stock })
    } catch (error) {
      console.error('[PATCH /api/admin/lab-stock/[labId]/[materialId]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update lab stock.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/lab-stock/[labId]/[materialId]  (admin only)
// ---------------------------------------------------------------------------
// Removes a stock entry for a specific (lab, material, stockType) tuple.
// This deletes the LabStock record entirely.
//
// Query params:
//   stockType - optional; defaults to RAW_MATERIAL for backward compatibility
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { labId, materialId } = params as { labId: string; materialId: string }
      const { searchParams } = new URL(req.url)
      const stockType = searchParams.get('stockType') ?? 'RAW_MATERIAL'

      // Verify both the lab and material exist
      const [lab, material] = await Promise.all([
        prisma.productionLab.findUnique({ where: { id: labId }, select: { id: true } }),
        prisma.rawMaterial.findUnique({ where: { id: materialId }, select: { id: true } }),
      ])

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'LAB_NOT_FOUND',
              message: `Lab '${labId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      if (!material) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MATERIAL_NOT_FOUND',
              message: `Raw material '${materialId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      // Delete the stock record
      const stock = await prisma.labStock.delete({
        where: {
          labId_materialId_stockType: { labId, materialId, stockType },
        },
        include: {
          material: {
            select: { id: true, name: true, type: true, unit: true },
          },
        },
      })

      return NextResponse.json({ success: true, data: stock })
    } catch (error) {
      console.error('[DELETE /api/admin/lab-stock/[labId]/[materialId]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete lab stock.' },
        },
        { status: 500 },
      )
    }
  },
)
