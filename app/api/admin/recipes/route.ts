import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateRecipeSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// POST /api/admin/recipes  (admin only)
// ---------------------------------------------------------------------------
// Creates a new recipe along with all its ingredient lines in a single
// transaction, so either the entire recipe (with ingredients) is persisted
// or nothing is — there will never be a recipe with missing ingredient rows.
//
// Body: CreateRecipeInput
//   name, description?, laborMinutes, ingredients[]
//   Each ingredient must have exactly one of rawMaterialId or
//   intermediateProductId (enforced by the Zod schema via .refine()).
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
        },
        { status: 400 },
      )
    }

    const result = CreateRecipeSchema.safeParse(body)

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

    // Validate that all referenced raw materials / intermediate products exist
    // before opening the transaction to surface helpful errors up front.
    const rawMaterialIds = ingredients
      .filter((i) => i.rawMaterialId)
      .map((i) => i.rawMaterialId as string)

    const intermediateIds = ingredients
      .filter((i) => i.intermediateProductId)
      .map((i) => i.intermediateProductId as string)

    const allMaterialIds = [...new Set([...rawMaterialIds, ...intermediateIds])]

    if (allMaterialIds.length > 0) {
      const foundMaterials = await prisma.rawMaterial.findMany({
        where: { id: { in: allMaterialIds } },
        select: { id: true },
      })

      const foundIds = new Set(foundMaterials.map((m) => m.id))
      const missingIds = allMaterialIds.filter((id) => !foundIds.has(id))

      if (missingIds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_RECIPE',
              message: 'One or more ingredient materials were not found.',
              details: { missingIds },
            },
          },
          { status: 422 },
        )
      }
    }

    // Create the recipe and all its ingredients atomically.
    const recipe = await prisma.$transaction(async (tx) => {
      return tx.recipe.create({
        data: {
          name,
          description,
          laborMinutes,
          ingredients: {
            create: ingredients.map((ing) => ({
              rawMaterialId: ing.rawMaterialId ?? null,
              intermediateProductId: ing.intermediateProductId ?? null,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
          },
        },
        include: { ingredients: true },
      })
    })

    return NextResponse.json({ success: true, data: recipe }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/recipes] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create recipe.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/recipes  (admin only)
// ---------------------------------------------------------------------------
// Returns a paginated list of all recipes (without ingredient detail to keep
// the list payload lightweight; use GET /api/admin/recipes/[id] for full data).
//
// Query params:
//   skip  – offset (default 0)
//   take  – page size (default 20, max 100)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        // Include a lightweight ingredient count so consumers know the recipe
        // complexity without fetching the full ingredient list.
        include: {
          _count: { select: { ingredients: true, batches: true } },
        },
      }),
      prisma.recipe.count(),
    ])

    return NextResponse.json({
      success: true,
      data: recipes,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/recipes] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve recipes.' },
      },
      { status: 500 },
    )
  }
})
