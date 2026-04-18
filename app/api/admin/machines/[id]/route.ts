import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateMachineSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// DELETE /api/admin/machines/[id]  (admin only)
// ---------------------------------------------------------------------------
// Permanently deletes a machine. Machines with active batch assignments will
// return 409 to prevent data inconsistency.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const existing = await prisma.machine.findUnique({
        where: { id },
        include: { _count: { select: { batches: true } } },
      })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Machine '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      if (existing._count.batches > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Cannot delete machine "${existing.name}" — it has ${existing._count.batches} batch record(s). Unassign it from all batches first.`,
            },
          },
          { status: 409 },
        )
      }

      await prisma.machine.delete({ where: { id } })

      return NextResponse.json({ success: true, data: { id } })
    } catch (error) {
      console.error('[DELETE /api/admin/machines/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete machine.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/machines/[id]  (admin only)
// ---------------------------------------------------------------------------
// Partial update of a machine's mutable fields (name, available).
// Hardware specs (batchCapacity, cycleTimeMinutes, type) are intentionally
// excluded from the update schema since changing them after batches have been
// scheduled would produce inconsistent historical records.
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

      const result = UpdateMachineSchema.safeParse(body)

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

      // Guard: require at least one updatable field
      if (Object.keys(result.data).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'At least one field (name or available) must be provided.',
            },
          },
          { status: 400 },
        )
      }

      // Check the machine exists before attempting the update
      const existing = await prisma.machine.findUnique({ where: { id } })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Machine '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      const updated = await prisma.machine.update({
        where: { id },
        data: result.data,
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      console.error('[PATCH /api/admin/machines/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update machine.' },
        },
        { status: 500 },
      )
    }
  },
)
