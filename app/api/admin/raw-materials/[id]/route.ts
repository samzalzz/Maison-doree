import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateRawMaterialSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// PATCH /api/admin/raw-materials/[id]  (admin only)
// ---------------------------------------------------------------------------
// Partially updates an existing raw material.
// Accepts the same fields as POST but all optional, except the same
// isIntermediate / productionRecipeId co-validation rules still apply.
//
// Body: Partial<CreateRawMaterialInput>
// Returns 200 with the updated material.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

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

      // Confirm the record exists before attempting the update
      const existing = await prisma.rawMaterial.findUnique({
        where: { id },
        select: { id: true, isIntermediate: true, productionRecipeId: true },
      })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Raw material '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      // Merge incoming fields with the existing record so the superRefine
      // cross-field rule can be evaluated against the full intended state.
      const merged = {
        name: body.name ?? undefined,
        type: body.type ?? undefined,
        unit: body.unit ?? undefined,
        isIntermediate:
          body.isIntermediate !== undefined
            ? body.isIntermediate
            : existing.isIntermediate,
        productionRecipeId:
          body.productionRecipeId !== undefined
            ? body.productionRecipeId
            : existing.productionRecipeId ?? undefined,
      }

      // Remove undefined keys so Zod optional fields behave correctly
      const payload = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== undefined),
      )

      const result = UpdateRawMaterialSchema.safeParse(payload)

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

      // If isIntermediate is being set to true, verify the referenced recipe exists
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

      const updated = await prisma.rawMaterial.update({
        where: { id },
        data: result.data,
      })

      return NextResponse.json({ success: true, data: updated })
    } catch (error) {
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

      console.error('[PATCH /api/admin/raw-materials/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update raw material.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/raw-materials/[id]  (admin only)
// ---------------------------------------------------------------------------
// Permanently removes a raw material record.
// Will fail with 409 if the material is referenced by recipe ingredients
// (Prisma enforces the FK constraint).
//
// Returns 200 { success: true } on success.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const existing = await prisma.rawMaterial.findUnique({
        where: { id },
        select: { id: true, name: true },
      })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Raw material '${id}' was not found.`,
            },
          },
          { status: 404 },
        )
      }

      await prisma.rawMaterial.delete({ where: { id } })

      return NextResponse.json({ success: true })
    } catch (error) {
      // FK constraint: material is referenced by one or more recipe ingredients
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MATERIAL_IN_USE',
              message:
                'This material is referenced by one or more recipe ingredients and cannot be deleted.',
            },
          },
          { status: 409 },
        )
      }

      console.error('[DELETE /api/admin/raw-materials/[id]] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete raw material.' },
        },
        { status: 500 },
      )
    }
  },
)
