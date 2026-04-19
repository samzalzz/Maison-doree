/**
 * app/api/admin/quality/inspections/[id]/checkpoints/route.ts
 *
 * POST /api/admin/quality/inspections/[id]/checkpoints  — add a checkpoint
 * GET  /api/admin/quality/inspections/[id]/checkpoints  — list checkpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  createInspectionCheckpoint,
  getInspectionCheckpoints,
  ValidationError,
  NotFoundError,
} from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// POST /api/admin/quality/inspections/[id]/checkpoints
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(
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

      const checkpoint = await createInspectionCheckpoint(id, body, token.id)

      return NextResponse.json({ success: true, data: checkpoint }, { status: 201 })
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
      console.error(
        `[POST /api/admin/quality/inspections/${id ?? 'unknown'}/checkpoints] Error:`,
        error,
      )
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create inspection checkpoint.',
          },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// GET /api/admin/quality/inspections/[id]/checkpoints
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const checkpoints = await getInspectionCheckpoints(id)

      return NextResponse.json({ success: true, data: checkpoints })
    } catch (error) {
      const { id } = (params as { id?: string } | undefined) ?? {}
      console.error(
        `[GET /api/admin/quality/inspections/${id ?? 'unknown'}/checkpoints] Error:`,
        error,
      )
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve inspection checkpoints.',
          },
        },
        { status: 500 },
      )
    }
  },
)
