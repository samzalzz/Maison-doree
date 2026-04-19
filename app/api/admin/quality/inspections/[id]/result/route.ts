/**
 * app/api/admin/quality/inspections/[id]/result/route.ts
 *
 * GET /api/admin/quality/inspections/[id]/result
 *   Returns the aggregate pass/fail result for all checkpoints on the
 *   given inspection: { allPassed, passedCount, totalCount }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  getQualityInspection,
  calculateInspectionResult,
} from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// GET /api/admin/quality/inspections/[id]/result
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      // Verify the parent inspection exists before computing the result
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

      const result = await calculateInspectionResult(id)

      return NextResponse.json({ success: true, data: result })
    } catch (error) {
      const { id } = (params as { id?: string } | undefined) ?? {}
      console.error(
        `[GET /api/admin/quality/inspections/${id ?? 'unknown'}/result] Error:`,
        error,
      )
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to calculate inspection result.',
          },
        },
        { status: 500 },
      )
    }
  },
)
