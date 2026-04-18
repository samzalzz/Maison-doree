import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateRawMaterialSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// POST /api/admin/raw-materials  (admin only)
// ---------------------------------------------------------------------------
// Creates a new raw or intermediate material.
// The Zod schema enforces that productionRecipeId is present if and only if
// isIntermediate is true.
//
// Body: CreateRawMaterialInput
//   name, type, unit, isIntermediate, productionRecipeId?
// Returns 201 with the created material.
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

    const result = CreateRawMaterialSchema.safeParse(body)

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

    // When isIntermediate is true, verify the referenced recipe exists.
    if (result.data.isIntermediate && result.data.productionRecipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: result.data.productionRecipeId },
        select: { id: true },
      })

      if (!recipe) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RECIPE_NOT_FOUND',
              message: `Recipe '${result.data.productionRecipeId}' was not found.`,
            },
          },
          { status: 404 },
        )
      }
    }

    const material = await prisma.rawMaterial.create({
      data: result.data,
    })

    return NextResponse.json({ success: true, data: material }, { status: 201 })
  } catch (error) {
    // Handle the unique constraint violation (name + type combination)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_MATERIAL',
            message: 'A raw material with this name and type already exists.',
          },
        },
        { status: 409 },
      )
    }

    console.error('[POST /api/admin/raw-materials] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create raw material.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/raw-materials  (admin only)
// ---------------------------------------------------------------------------
// Returns a paginated list of raw materials.
// Supports optional filter by isIntermediate to separate base ingredients
// from in-house produced intermediate materials.
//
// Query params:
//   isIntermediate  – "true" or "false" (optional)
//   skip            – offset (default 0)
//   take            – page size (default 20, max 100)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    // Parse the optional isIntermediate filter
    const isIntermediateParam = searchParams.get('isIntermediate')
    const isIntermediate =
      isIntermediateParam === 'true'
        ? true
        : isIntermediateParam === 'false'
          ? false
          : undefined

    const where: Prisma.RawMaterialWhereInput =
      isIntermediate !== undefined ? { isIntermediate } : {}

    const [materials, total] = await Promise.all([
      prisma.rawMaterial.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.rawMaterial.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: materials,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/raw-materials] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve raw materials.' },
      },
      { status: 500 },
    )
  }
})
