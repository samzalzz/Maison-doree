import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Zod schema — all fields optional for PATCH
// ---------------------------------------------------------------------------

const UpdateCouponSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).optional(),
    discountValue: z.number().positive().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    maxUsesPerCustomer: z.number().int().positive().optional(),
    minOrderAmount: z.number().nonnegative().nullable().optional(),
    applicableCategories: z
      .array(
        z.enum(['PATES', 'COOKIES', 'GATEAU', 'BRIOUATES', 'CHEBAKIA', 'AUTRES']),
      )
      .optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.discountType === 'PERCENTAGE' && data.discountValue !== undefined) {
        return data.discountValue <= 100
      }
      return true
    },
    { message: 'Percentage discount cannot exceed 100%', path: ['discountValue'] },
  )

// ---------------------------------------------------------------------------
// PATCH /api/admin/coupons/[id]  — Update coupon fields
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    const id = params?.id as string | undefined
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Coupon ID is required.' },
        },
        { status: 400 },
      )
    }

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

    const parsed = UpdateCouponSchema.safeParse(body)
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

    // Verify coupon exists
    const existing = await prisma.promoCoupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Coupon not found.' },
        },
        { status: 404 },
      )
    }

    const data = parsed.data

    // Build update payload — convert datetime strings to Date objects
    const updateData: Record<string, unknown> = { ...data }
    if (data.validFrom) updateData.validFrom = new Date(data.validFrom)
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil)

    try {
      const updated = await prisma.promoCoupon.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (err) {
      console.error('[PATCH /api/admin/coupons/[id]] Error:', err)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update coupon.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/coupons/[id]  — Soft delete (set isActive = false)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    const id = params?.id as string | undefined
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Coupon ID is required.' },
        },
        { status: 400 },
      )
    }

    const existing = await prisma.promoCoupon.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Coupon not found.' },
        },
        { status: 404 },
      )
    }

    try {
      // Soft delete: deactivate rather than hard delete to preserve audit trail
      const softDeleted = await prisma.promoCoupon.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json({ success: true, data: softDeleted })
    } catch (err) {
      console.error('[DELETE /api/admin/coupons/[id]] Error:', err)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete coupon.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// GET /api/admin/coupons/[id]  — Get single coupon with usage history
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    const id = params?.id as string | undefined
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Coupon ID is required.' },
        },
        { status: 400 },
      )
    }

    try {
      const coupon = await prisma.promoCoupon.findUnique({
        where: { id },
        include: {
          usages: {
            orderBy: { appliedAt: 'desc' },
            take: 50,
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { firstName: true, lastName: true } },
                },
              },
              order: {
                select: { id: true, orderNumber: true, totalPrice: true, createdAt: true },
              },
            },
          },
          _count: { select: { usages: true } },
        },
      })

      if (!coupon) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Coupon not found.' },
          },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, data: coupon })
    } catch (err) {
      console.error('[GET /api/admin/coupons/[id]] Error:', err)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve coupon.' },
        },
        { status: 500 },
      )
    }
  },
)
