/**
 * app/api/admin/quality/summary/route.ts
 *
 * GET /api/admin/quality/summary
 *   Returns aggregate statistics across all quality inspections.
 *
 * Optional query parameters:
 *   fromDate – ISO date string, lower bound on scheduledDate
 *   toDate   – ISO date string, upper bound on scheduledDate
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { getInspectionSummary } from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// GET /api/admin/quality/summary
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const fromParam = searchParams.get('fromDate')
    const toParam = searchParams.get('toDate')

    const fromDate =
      fromParam && !isNaN(Date.parse(fromParam)) ? new Date(fromParam) : undefined
    const toDate =
      toParam && !isNaN(Date.parse(toParam)) ? new Date(toParam) : undefined

    if (fromParam && fromDate === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid fromDate value.',
            errors: ['fromDate: must be a valid ISO date string'],
          },
        },
        { status: 400 },
      )
    }

    if (toParam && toDate === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid toDate value.',
            errors: ['toDate: must be a valid ISO date string'],
          },
        },
        { status: 400 },
      )
    }

    const summary = await getInspectionSummary(fromDate, toDate)

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('[GET /api/admin/quality/summary] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve quality inspection summary.',
        },
      },
      { status: 500 },
    )
  }
})
