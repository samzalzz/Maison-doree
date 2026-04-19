/**
 * app/api/admin/quality/checkpoints/[id]/route.ts
 *
 * PATCH  /api/admin/quality/checkpoints/[id]  — update a checkpoint
 * DELETE /api/admin/quality/checkpoints/[id]  — delete a checkpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  updateInspectionCheckpoint,
  ValidationError,
  NotFoundError,
} from '@/lib/services/quality-service'
import { prisma } from '@/lib/db/prisma'

// ---------------------------------------------------------------------------
// PATCH /api/admin/quality/checkpoints/[id]
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params, token }) => {
    try {
      const { id } = params as { id: string }

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

      const updated = await updateInspectionCheckpoint(id, body, token.id)

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.message,
              errors: error.errors,
            },
          },
          { status: 400 },
        )
      }

      if (error instanceof NotFoundError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          },
          { status: 404 },
        )
      }

      const { id } = (params as { id?: string } | undefined) ?? {}
      console.error(`[PATCH /api/admin/quality/checkpoints/${id ?? 'unknown'}] Error:`, error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update inspection checkpoint.',
          },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/quality/checkpoints/[id]
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      // Verify the checkpoint exists before attempting deletion
      const existing = await prisma.inspectionCheckpoint.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `InspectionCheckpoint not found: ${id}`,
            },
          },
          { status: 404 },
        )
      }

      await prisma.inspectionCheckpoint.delete({ where: { id } })

      return new NextResponse(null, { status: 204 })
    } catch (error) {
      const { id } = (params as { id?: string } | undefined) ?? {}
      console.error(`[DELETE /api/admin/quality/checkpoints/${id ?? 'unknown'}] Error:`, error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to delete inspection checkpoint.',
          },
        },
        { status: 500 },
      )
    }
  },
)
