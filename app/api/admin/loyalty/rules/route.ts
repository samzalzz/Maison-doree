import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['BASE_PURCHASE', 'CATEGORY_BONUS', 'TIER_BONUS', 'REFERRAL']),
  pointsPerUnit: z.number().positive('Points per unit must be positive'),
  applicableCategory: z.string().optional().nullable(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  tierRequired: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional().nullable(),
  isActive: z.boolean().default(true),
})

const ListQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

// ---------------------------------------------------------------------------
// GET /api/admin/loyalty/rules  — admin only
// Returns all points rules (optionally filtered by active status).
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = ListQuerySchema.safeParse({
      isActive: searchParams.get('isActive') ?? undefined,
    })

    const where =
      parsed.success && parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}

    const rules = await prisma.pointsRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: rules })
  } catch (error) {
    console.error('[GET /api/admin/loyalty/rules] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve rules.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/loyalty/rules  — admin only
// Creates a new points rule.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const parsed = CreateRuleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      )
    }

    const rule = await prisma.pointsRule.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        pointsPerUnit: parsed.data.pointsPerUnit,
        applicableCategory: parsed.data.applicableCategory ?? null,
        minOrderAmount: parsed.data.minOrderAmount ?? null,
        tierRequired: parsed.data.tierRequired ?? null,
        isActive: parsed.data.isActive,
      },
    })

    return NextResponse.json({ success: true, data: rule }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/loyalty/rules] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create rule.' },
      },
      { status: 500 },
    )
  }
})
