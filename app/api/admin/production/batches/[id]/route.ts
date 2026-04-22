import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateBatchStatusSchema } from '@/lib/validators-production'
import { triggerWorkflows } from '@/lib/workflow-engine'

// ---------------------------------------------------------------------------
// GET /api/admin/production/batches/[id]  (admin only)
// ---------------------------------------------------------------------------
// Returns a single production batch with all its BatchItem records.
// Response type: BatchWithItems (includes lab, recipe, machine, employee
// summaries for rich display without additional fetches).
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const batch = await prisma.productionBatch.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
          lab: {
            select: { id: true, name: true, type: true, capacity: true },
          },
          recipe: {
            select: { id: true, name: true, description: true, laborMinutes: true },
          },
          machine: {
            select: { id: true, name: true, type: true, batchCapacity: true, cycleTimeMinutes: true },
          },
          employee: {
            select: { id: true, name: true, role: true, availableHours: true },
          },
        },
      })

      if (!batch) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Production batch '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, data: batch })
    } catch (error) {
      console.error('[GET /api/admin/production/batches/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve batch details.',
          },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/production/batches/[id]  (admin only)
// ---------------------------------------------------------------------------
// Updates the lifecycle status of a production batch.
// Optionally records actualStartTime and actualCompletionTime timestamps.
//
// Business rules enforced here:
//   - actualStartTime must be provided when transitioning to IN_PROGRESS
//   - actualCompletionTime must be provided when transitioning to COMPLETED
// These are warnings rather than hard errors (enforced only when the field is
// missing), keeping the API flexible for retroactive corrections.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

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

      const result = UpdateBatchStatusSchema.safeParse(body)

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

      // Confirm the batch exists before updating
      const existing = await prisma.productionBatch.findUnique({ where: { id } })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Production batch '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      // Prevent transitioning a terminal batch back into an active state
      const terminalStatuses = ['COMPLETED', 'CANCELLED']
      if (terminalStatuses.includes(existing.status) && !terminalStatuses.includes(result.data.status)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition a ${existing.status} batch to ${result.data.status}. Terminal statuses are irreversible.`,
            },
          },
          { status: 409 },
        )
      }

      const { status, actualStartTime, actualCompletionTime } = result.data

      const updated = await prisma.productionBatch.update({
        where: { id },
        data: {
          status,
          // Only set actualStartTime if provided (non-destructive: never clear an
          // existing timestamp with undefined).
          ...(actualStartTime && { actualStartTime: new Date(actualStartTime) }),
          ...(actualCompletionTime && { actualCompletionTime: new Date(actualCompletionTime) }),
        },
      })

      // Handle batch completion: create finished product stock
      if (status === 'COMPLETED') {
        // Get recipe to find finished product material
        const recipe = await prisma.recipe.findUnique({
          where: { id: existing.recipeId },
          include: { producedMaterials: true }
        })

        // Create FINISHED_PRODUCT stock for each produced material
        if (recipe?.producedMaterials?.length) {
          try {
            await Promise.all(
              recipe.producedMaterials.map(material =>
                prisma.labStock.upsert({
                  where: {
                    labId_materialId_stockType: {
                      labId: existing.labId,
                      materialId: material.id,
                      stockType: 'FINISHED_PRODUCT'
                    }
                  },
                  create: {
                    labId: existing.labId,
                    materialId: material.id,
                    stockType: 'FINISHED_PRODUCT',
                    quantity: new (require('@prisma/client/runtime/library').Decimal)(existing.quantity),
                    minThreshold: new (require('@prisma/client/runtime/library').Decimal)(0),
                    originBatchId: existing.id
                  },
                  update: {
                    quantity: {
                      increment: new (require('@prisma/client/runtime/library').Decimal)(existing.quantity)
                    },
                    originBatchId: existing.id
                  }
                })
              )
            )
          } catch (stockErr) {
            console.error('[PATCH batch] Stock creation error:', stockErr)
          }
        }

        // Fire-and-forget: trigger BATCH_COMPLETED workflows
        triggerWorkflows('BATCH_COMPLETED', {
          batchId: updated.id,
          batchNumber: updated.batchNumber,
          labId: updated.labId,
          recipeId: updated.recipeId,
          quantity: updated.quantity,
          actualCompletionTime: updated.actualCompletionTime?.toISOString() ?? null,
        }).catch((err) =>
          console.error('[PATCH /api/admin/production/batches/[id]] BATCH_COMPLETED trigger error:', err),
        )
      }

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      console.error('[PATCH /api/admin/production/batches/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update batch status.' },
        },
        { status: 500 },
      )
    }
  },
)
