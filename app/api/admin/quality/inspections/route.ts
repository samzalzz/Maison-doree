/**
 * app/api/admin/quality/inspections/route.ts
 *
 * POST /api/admin/quality/inspections  — create a new quality inspection
 * GET  /api/admin/quality/inspections  — list inspections with optional filters
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  createQualityInspection,
  listQualityInspections,
  ValidationError,
  NotFoundError,
} from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// POST /api/admin/quality/inspections
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { token }) => {
  try {
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

    const inspection = await createQualityInspection(body, token.id)

    return NextResponse.json({ success: true, data: inspection }, { status: 201 })
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

    console.error('[POST /api/admin/quality/inspections] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create quality inspection.',
        },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/quality/inspections
// ---------------------------------------------------------------------------
// Supported query parameters (all optional):
//   inspectionType   – INCOMING | IN_PROCESS | FINAL
//   inspectionStatus – PLANNED | IN_PROGRESS | PASSED | FAILED | CONDITIONAL
//   materialId       – CUID
//   batchId          – CUID
//   supplierId       – CUID
//   fromDate         – ISO date string (lower bound on scheduledDate)
//   toDate           – ISO date string (upper bound on scheduledDate)
//   limit            – integer 1-100 (default 50)
//   offset           – non-negative integer (default 0)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    // Extract raw string values and coerce numerics
    const rawLimit = searchParams.get('limit')
    const rawOffset = searchParams.get('offset')

    const filters = {
      ...(searchParams.get('inspectionType') && {
        inspectionType: searchParams.get('inspectionType') as string,
      }),
      ...(searchParams.get('inspectionStatus') && {
        inspectionStatus: searchParams.get('inspectionStatus') as string,
      }),
      ...(searchParams.get('materialId') && { materialId: searchParams.get('materialId')! }),
      ...(searchParams.get('batchId') && { batchId: searchParams.get('batchId')! }),
      ...(searchParams.get('supplierId') && { supplierId: searchParams.get('supplierId')! }),
      ...(searchParams.get('fromDate') && { fromDate: new Date(searchParams.get('fromDate')!) }),
      ...(searchParams.get('toDate') && { toDate: new Date(searchParams.get('toDate')!) }),
      ...(rawLimit !== null && !isNaN(parseInt(rawLimit, 10)) && {
        limit: parseInt(rawLimit, 10),
      }),
      ...(rawOffset !== null && !isNaN(parseInt(rawOffset, 10)) && {
        offset: parseInt(rawOffset, 10),
      }),
    }

    const { inspections, total } = await listQualityInspections(filters)

    return NextResponse.json({
      success: true,
      data: { inspections, total },
      pagination: {
        limit: (filters as { limit?: number }).limit ?? 50,
        offset: (filters as { offset?: number }).offset ?? 0,
        total,
      },
    })
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

    console.error('[GET /api/admin/quality/inspections] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list quality inspections.',
        },
      },
      { status: 500 },
    )
  }
})
