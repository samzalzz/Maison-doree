import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// Schema — all fields optional for PATCH
// ---------------------------------------------------------------------------

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['BASE_PURCHASE', 'CATEGORY_BONUS', 'TIER_BONUS', 'REFERRAL']).optional(),
  pointsPerUnit: z.number().positive().optional(),
  applicableCategory: z.string().optional().nullable(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  tierRequired: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional().nullable(),
  isActive: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/loyalty/rules/[id]  — admin only
// Partially updates an existing points rule.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    const id = params?.id as string | undefined

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Rule ID is required.' } },
        { status: 400 },
      )
    }

    try {
      const body = await req.json()
      const parsed = UpdateRuleSchema.safeParse(body)

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

      // Verify the rule exists
      const existing = await prisma.pointsRule.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found.' } },
          { status: 404 },
        )
      }

      const rule = await prisma.pointsRule.update({
        where: { id },
        data: parsed.data,
      })

      return NextResponse.json({ success: true, data: rule })
    } catch (error) {
      console.error('[PATCH /api/admin/loyalty/rules/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update rule.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/loyalty/rules/[id]  — admin only
// Permanently deletes a points rule.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    const id = params?.id as string | undefined

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Rule ID is required.' } },
        { status: 400 },
      )
    }

    try {
      const existing = await prisma.pointsRule.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Rule not found.' } },
          { status: 404 },
        )
      }

      await prisma.pointsRule.delete({ where: { id } })

      return NextResponse.json({ success: true, data: { id } })
    } catch (error) {
      console.error('[DELETE /api/admin/loyalty/rules/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rule.' },
        },
        { status: 500 },
      )
    }
  },
)
