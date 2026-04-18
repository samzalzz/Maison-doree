import { NextRequest, NextResponse } from 'next/server'
import { getCouponAnalytics } from '@/lib/coupons'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/coupons/analytics?from=ISO&to=ISO
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  // Default: last 30 days
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  let from: Date
  let to: Date

  try {
    from = fromParam ? new Date(fromParam) : defaultFrom
    to = toParam ? new Date(toParam) : now

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new Error('Invalid date')
    }

    if (to <= from) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: "'to' date must be after 'from' date.",
          },
        },
        { status: 422 },
      )
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: "Invalid date format. Use ISO 8601 (e.g. 2026-01-01T00:00:00Z).",
        },
      },
      { status: 422 },
    )
  }

  try {
    const analytics = await getCouponAnalytics(from, to)
    return NextResponse.json({ success: true, data: analytics })
  } catch (err) {
    console.error('[GET /api/admin/coupons/analytics] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve analytics.' },
      },
      { status: 500 },
    )
  }
})
