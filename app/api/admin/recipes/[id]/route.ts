import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/recipes/[id]  (admin only)
// ---------------------------------------------------------------------------
// Returns a single recipe with its full ingredient list.
// Each ingredient row includes the linked raw material or intermediate product
// for human-readable display.
// Response type: RecipeWithIngredients
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

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

      if (!recipe) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Recipe '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

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
