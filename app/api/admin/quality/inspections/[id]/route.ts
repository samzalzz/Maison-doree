/**
 * app/api/admin/quality/inspections/[id]/route.ts
 *
 * GET   /api/admin/quality/inspections/[id]  — get a single inspection
 * PATCH /api/admin/quality/inspections/[id]  — update an inspection
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  getQualityInspection,
  updateQualityInspection,
  ValidationError,
  NotFoundError,
} from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// GET /api/admin/quality/inspections/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const inspection = await getQualityInspection(id)

      if (!inspection) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Quality Inspection not found: ${id}`,
            },
          },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, data: inspection })
    } catch (error) {
      const { id } = (params as { id?: string } | undefined) ?? {}
      console.error(`[GET /api/admin/quality/inspections/${id ?? 'unknown'}] Error:`, error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve quality inspection.',
          },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/quality/inspections/[id]
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

      const updated = await updateQualityInspection(id, body, token.id)

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
      console.error(`[PATCH /api/admin/quality/inspections/${id ?? 'unknown'}] Error:`, error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to update quality inspection.',
          },
        },
        { status: 500 },
      )
    }
  },
)
