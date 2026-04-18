/**
 * GET /api/admin/analytics/[metric]
 *
 * Supported metrics:
 *   revenue   — daily revenue totals
 *   orders    — daily order counts
 *   products  — top products by revenue
 *   customers — aggregate customer metrics
 *   delivery  — on-time rate + average delivery time
 *
 * Query params:
 *   from   ISO datetime string  (required for all except customers)
 *   to     ISO datetime string  (required for all except customers)
 *   limit  integer              (optional, products only, default 10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  getDailyRevenue,
  getOrderTrends,
  getTopProducts,
  getCustomerMetrics,
  getDeliveryMetrics,
} from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const dateRangeSchema = z.object({
  from: z
    .string()
    .min(1, 'from is required')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'from must be a valid ISO date' }),
  to: z
    .string()
    .min(1, 'to is required')
    .refine((v) => !isNaN(Date.parse(v)), { message: 'to must be a valid ISO date' }),
})

const productsSchema = dateRangeSchema.extend({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(50)),
})

// ---------------------------------------------------------------------------
// Supported metrics
// ---------------------------------------------------------------------------

type Metric = 'revenue' | 'orders' | 'products' | 'customers' | 'delivery'

const SUPPORTED_METRICS: Metric[] = [
  'revenue',
  'orders',
  'products',
  'customers',
  'delivery',
]

function isMetric(value: string): value is Metric {
  return SUPPORTED_METRICS.includes(value as Metric)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (
    req: NextRequest,
    context: { params?: Record<string, string | string[]> },
  ) => {
    const metric = context.params?.metric

    if (typeof metric !== 'string' || !isMetric(metric)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Unknown metric "${metric}". Supported: ${SUPPORTED_METRICS.join(', ')}.`,
          },
        },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(req.url)
    const rawParams = Object.fromEntries(searchParams.entries())

    try {
      // ------------------------------------------------------------------
      // customers — no date range required
      // ------------------------------------------------------------------
      if (metric === 'customers') {
        const data = await getCustomerMetrics()
        return NextResponse.json({ success: true, data })
      }

      // ------------------------------------------------------------------
      // All other metrics require from/to
      // ------------------------------------------------------------------
      if (metric === 'products') {
        const parsed = productsSchema.safeParse(rawParams)
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid query parameters.',
                details: parsed.error.flatten().fieldErrors,
              },
            },
            { status: 400 },
          )
        }
        const { from, to, limit } = parsed.data
        const data = await getTopProducts(limit, new Date(from), new Date(to))
        return NextResponse.json({ success: true, data })
      }

      // revenue | orders | delivery
      const parsed = dateRangeSchema.safeParse(rawParams)
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters.',
              details: parsed.error.flatten().fieldErrors,
            },
          },
          { status: 400 },
        )
      }

      const { from, to } = parsed.data
      const fromDate = new Date(from)
      const toDate = new Date(to)

      let data: unknown

      switch (metric) {
        case 'revenue':
          data = await getDailyRevenue(fromDate, toDate)
          break
        case 'orders':
          data = await getOrderTrends(fromDate, toDate)
          break
        case 'delivery':
          data = await getDeliveryMetrics(fromDate, toDate)
          break
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      console.error(`[GET /api/admin/analytics/${metric}] Error:`, error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve analytics data.',
          },
        },
        { status: 500 },
      )
    }
  },
)
