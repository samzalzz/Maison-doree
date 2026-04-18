import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateMachineSchema } from '@/lib/validators-production'

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
