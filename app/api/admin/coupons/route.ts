import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CreateCouponSchema = z.object({
  code: z
    .string()
    .min(8, 'Code must be at least 8 characters')
    .max(12, 'Code must be at most 12 characters')
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric (A-Z, 0-9)'),
  name: z.string().min(1, 'Name is required').max(100),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  discountValue: z
    .number()
    .positive('Discount value must be positive')
    .max(100, 'Percentage cannot exceed 100')
    .or(z.number().positive()),
  maxUses: z.number().int().positive().nullable().default(null),
  maxUsesPerCustomer: z.number().int().positive().default(1),
  minOrderAmount: z.number().nonnegative().nullable().default(null),
  applicableCategories: z
    .array(z.enum(['PATES', 'COOKIES', 'GATEAU', 'BRIOUATES', 'CHEBAKIA', 'AUTRES']))
    .default([]),
  validFrom: z.string().datetime({ message: 'validFrom must be ISO 8601' }),
  validUntil: z.string().datetime({ message: 'validUntil must be ISO 8601' }),
  isActive: z.boolean().default(true),
})

// Refine: percentage discount must be ≤ 100
const CreateCouponRefined = CreateCouponSchema.refine(
  (data) =>
    data.discountType !== 'PERCENTAGE' || data.discountValue <= 100,
  {
    message: 'Percentage discount cannot exceed 100%',
    path: ['discountValue'],
  },
).refine(
  (data) => new Date(data.validUntil) > new Date(data.validFrom),
  {
    message: 'validUntil must be after validFrom',
    path: ['validUntil'],
  },
)

// ---------------------------------------------------------------------------
// GET /api/admin/coupons  — List all coupons (paginated, cursor-based)
// Query params: cursor=<id>, limit=25, search=<code>
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') ?? undefined
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10) || 25),
    )
    const search = searchParams.get('search')?.trim().toUpperCase() ?? undefined

    const where = search
      ? { code: { contains: search, mode: 'insensitive' as const } }
      : {}

    const [coupons, total] = await Promise.all([
      prisma.promoCoupon.findMany({
        where,
        take: limit + 1, // Fetch one extra to determine hasNextPage
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { usages: true } },
        },
      }),
      prisma.promoCoupon.count({ where }),
    ])

    const hasNextPage = coupons.length > limit
    const page = hasNextPage ? coupons.slice(0, limit) : coupons
    const nextCursor = hasNextPage ? page[page.length - 1]?.id : null

    return NextResponse.json({
      success: true,
      data: page,
      pagination: {
        total,
        limit,
        nextCursor,
        hasNextPage,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/coupons] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve coupons.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/coupons  — Create new coupon
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { token }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
      },
      { status: 400 },
    )
  }

  const parsed = CreateCouponRefined.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  const data = parsed.data

  try {
    const coupon = await prisma.promoCoupon.create({
      data: {
        code: data.code,
        name: data.name,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses,
        maxUsesPerCustomer: data.maxUsesPerCustomer,
        minOrderAmount: data.minOrderAmount,
        applicableCategories: data.applicableCategories,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        isActive: data.isActive,
        createdBy: token.id,
      },
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (err: unknown) {
    // Unique constraint violation on code
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_CODE',
            message: `Coupon code '${data.code}' already exists.`,
          },
        },
        { status: 409 },
      )
    }
    console.error('[POST /api/admin/coupons] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create coupon.' },
      },
      { status: 500 },
    )
  }
})
