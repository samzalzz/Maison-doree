import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { CreateBatchItemSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// POST /api/worker/batches/[id]/report-progress  (any authenticated user)
// ---------------------------------------------------------------------------
// Allows a worker to report production progress by creating a BatchItem record
// linked to the given batch.  Multiple progress reports can be submitted
// against the same batch as production advances (e.g., "Mixing done",
// "Baking done", "Packaging done").
//
// The endpoint intentionally uses withAuth (not withAdminAuth) because
// production workers are not admins — they need write access to their
// own batch items without broader admin privileges.
//
// Business rules:
//   - The referenced batch must exist.
//   - Workers can only report on batches that are IN_PROGRESS.
//     Reporting on PLANNED, COMPLETED, PAUSED, or CANCELLED batches is
//     rejected to prevent accidental data pollution.
//
// Body: CreateBatchItemInput
//   description, quantity, status ("pending" | "in_progress" | "completed")
// Returns 201 with the created BatchItem.
// ---------------------------------------------------------------------------

export const POST = withAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { id: batchId } = params as { id: string }

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

      const result = CreateBatchItemSchema.safeParse(body)

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

      // Confirm the batch exists and is in a state that accepts progress reports
      const batch = await prisma.productionBatch.findUnique({
        where: { id: batchId },
        select: { id: true, batchNumber: true, status: true },
      })

      if (!batch) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BATCH_NOT_FOUND',
              message: `Production batch '${batchId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      // Only IN_PROGRESS batches accept worker progress reports.
      // PLANNED batches haven't started yet; COMPLETED/CANCELLED are terminal.
      if (batch.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BATCH_NOT_IN_PROGRESS',
              message: `Progress can only be reported for batches with status IN_PROGRESS. Current status of batch '${batch.batchNumber}' is '${batch.status}'.`,
              details: {
                batchId,
                batchNumber: batch.batchNumber,
                currentStatus: batch.status,
              },
            },
          },
          { status: 409 },
        )
      }

      const batchItem = await prisma.batchItem.create({
        data: {
          batchId,
          description: result.data.description,
          quantity: result.data.quantity,
          status: result.data.status,
        },
      })

      return NextResponse.json({ success: true, data: batchItem }, { status: 201 })
    } catch (error) {
      console.error('[POST /api/worker/batches/[id]/report-progress] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to record batch progress.',
          },
        },
        { status: 500 },
      )
    }
  },
)
