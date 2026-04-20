import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { ZodError } from 'zod'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type RouteContext = { params?: Record<string, string | string[]> }

function notFound(id: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'NOT_FOUND', message: `Recipe '${id}' was not found.` },
    },
    { status: 404 },
  )
}

// ---------------------------------------------------------------------------
// GET /api/admin/recipes/[id]  (admin only)
// ---------------------------------------------------------------------------
// Returns a single recipe with its full ingredient list.
// Each ingredient row includes the linked raw material or intermediate product
// for human-readable display.
// Response type: RecipeWithIngredients
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }: RouteContext) => {
    try {
      const id = params?.id as string
      if (!id) return notFound('')

      const recipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: {
            include: {
              // Resolve the linked material so consumers get name/unit directly
              rawMaterial: {
                select: { id: true, name: true, type: true, unit: true },
              },
              intermediateProduct: {
                select: { id: true, name: true, type: true, unit: true },
              },
            },
          },
        },
      })

      if (!recipe) return notFound(id)

      return NextResponse.json({ success: true, data: recipe })
    } catch (error) {
      console.error('[GET /api/admin/recipes/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve recipe details.',
          },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// PATCH /api/admin/recipes/[id]  (admin only)
// ---------------------------------------------------------------------------
// Updates recipe fields and replaces its ingredient list atomically.
// Accepts the same shape as POST but all top-level fields are optional;
// if `ingredients` is provided it must be a non-empty array that replaces
// the existing ingredient rows wholesale.
// ---------------------------------------------------------------------------

const UpdateRecipeIngredientSchema = z
  .object({
    rawMaterialId: z.string().cuid().optional(),
    intermediateProductId: z.string().cuid().optional(),
    quantity: z.number().positive().finite(),
    unit: z.string().min(1).max(20),
  })
  .refine(
    (d) =>
      (d.rawMaterialId !== undefined) !== (d.intermediateProductId !== undefined),
    {
      message:
        'Each ingredient must have either rawMaterialId OR intermediateProductId, but not both.',
      path: ['rawMaterialId'],
    },
  )

const UpdateRecipeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  laborMinutes: z.number().int().positive().optional(),
  ingredients: z.array(UpdateRecipeIngredientSchema).min(1).optional(),
})

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }: RouteContext) => {
    const id = params?.id as string
    if (!id) return notFound('')

    try {
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

      const result = UpdateRecipeSchema.safeParse(body)
      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed.',
              details: result.error.flatten(),
            },
          },
          { status: 422 },
        )
      }

      const { name, description, laborMinutes, ingredients } = result.data

      // Verify the recipe exists first
      const existing = await prisma.recipe.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return notFound(id)

      const recipe = await prisma.$transaction(async (tx) => {
        // If ingredients are provided, replace them wholesale
        if (ingredients !== undefined) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
        }

        return tx.recipe.update({
          where: { id },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(laborMinutes !== undefined && { laborMinutes }),
            ...(ingredients !== undefined && {
              ingredients: {
                create: ingredients.map((ing) => ({
                  rawMaterialId: ing.rawMaterialId ?? null,
                  intermediateProductId: ing.intermediateProductId ?? null,
                  quantity: ing.quantity,
                  unit: ing.unit,
                })),
              },
            }),
          },
          include: {
            ingredients: {
              include: {
                rawMaterial: { select: { id: true, name: true, type: true, unit: true } },
                intermediateProduct: { select: { id: true, name: true, type: true, unit: true } },
              },
            },
            _count: { select: { ingredients: true, batches: true } },
          },
        })
      })

      return NextResponse.json({ success: true, data: recipe })
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid recipe data.', details: err.errors },
          },
          { status: 422 },
        )
      }
      if ((err as { code?: string }).code === 'P2025') return notFound(id)
      console.error('[PATCH /api/admin/recipes/[id]] Error:', err)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update recipe.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/recipes/[id]  (admin only)
// ---------------------------------------------------------------------------
// Deletes a recipe. Refuses if active batches reference this recipe.
// Ingredients are deleted by cascade (RecipeIngredient has onDelete: Cascade).
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }: RouteContext) => {
    const id = params?.id as string
    if (!id) return notFound('')

    try {
      // Guard: refuse deletion when live batches exist
      const batchCount = await prisma.productionBatch.count({
        where: {
          recipeId: id,
          status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED'] },
        },
      })

      if (batchCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Cannot delete recipe: ${batchCount} active batch${batchCount === 1 ? '' : 'es'} reference it. Complete or cancel them first.`,
            },
          },
          { status: 409 },
        )
      }

      await prisma.recipe.delete({ where: { id } })
      return NextResponse.json({ success: true, data: null })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') return notFound(id)
      console.error('[DELETE /api/admin/recipes/[id]] Error:', err)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete recipe.' },
        },
        { status: 500 },
      )
    }
  },
)
