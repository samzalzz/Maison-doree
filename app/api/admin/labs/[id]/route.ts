import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateLabSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// GET /api/admin/labs/[id]  (admin only)
// ---------------------------------------------------------------------------
// Returns full lab detail including employees, machines, stock entries, and
// all batches that are currently active (PLANNED or IN_PROGRESS).
// Response type: LabWithRelations
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const lab = await prisma.productionLab.findUnique({
        where: { id },
        include: {
          employees: true,
          machines: true,
          stock: {
            include: {
              // Include material name so consumers can display human-readable labels
              material: {
                select: { id: true, name: true, type: true, unit: true },
              },
            },
          },
          // Only surface active batches on the detail view; completed/cancelled
          // batches belong to a separate history endpoint to keep the payload lean.
          batches: {
            where: {
              status: { in: ['PLANNED', 'IN_PROGRESS'] },
            },
            orderBy: { plannedStartTime: 'asc' },
          },
        },
      })

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Lab '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, data: lab })
    } catch (error) {
      console.error('[GET /api/admin/labs/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve lab details.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/labs/[id]  (admin only)
// ---------------------------------------------------------------------------
// Partial update of a lab's mutable fields (name, capacity).
// The lab type is intentionally immutable after creation to avoid data
// inconsistencies with existing batch records.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DELETE /api/admin/labs/[id]  (admin only)
// ---------------------------------------------------------------------------
// Permanently deletes a lab. Refuses deletion if the lab has active batches
// (status PLANNED or IN_PROGRESS) to prevent data inconsistencies.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const lab = await prisma.productionLab.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              batches: {
                where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } },
              },
            },
          },
        },
      })

      if (!lab) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Lab '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      if (lab._count.batches > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Cannot delete lab "${lab.name}" because it has ${lab._count.batches} active batch(es). Complete or reassign all batches first.`,
            },
          },
          { status: 409 },
        )
      }

      await prisma.productionLab.delete({ where: { id } })

      return NextResponse.json({ success: true, data: { id } })
    } catch (error) {
      console.error('[DELETE /api/admin/labs/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete lab.' },
        },
        { status: 500 },
      )
    }
  },
)

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

      const result = UpdateLabSchema.safeParse(body)

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

      // Ensure there is at least one field to update
      if (Object.keys(result.data).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'At least one field must be provided for update.',
            },
          },
          { status: 400 },
        )
      }

      // Check the lab exists before attempting the update
      const existing = await prisma.productionLab.findUnique({ where: { id } })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Lab '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      const updated = await prisma.productionLab.update({
        where: { id },
        data: result.data,
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      console.error('[PATCH /api/admin/labs/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update lab.' },
        },
        { status: 500 },
      )
    }
  },
)
