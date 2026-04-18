import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schemas for recipe workflow steps
// ---------------------------------------------------------------------------

const MaterialCheckStepSchema = z.object({
  type: z.literal('material_check'),
  materialIds: z
    .array(z.string().min(1))
    .min(1, 'At least one material ID is required'),
  operator: z.enum(['all_available']),
})

const MachineOperationStepSchema = z.object({
  type: z.literal('machine_operation'),
  machineId: z.string().min(1, 'Machine ID is required'),
  labId: z.string().min(1, 'Lab ID is required'),
  durationMinutes: z
    .number()
    .int('Duration must be a whole number of minutes')
    .positive('Duration must be positive'),
  outputMaterialId: z.string().nullable().optional(),
})

const OutputStepSchema = z.object({
  type: z.literal('output'),
  materialId: z.string().min(1, 'Material ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
})

const WorkflowStepSchema = z.discriminatedUnion('type', [
  MaterialCheckStepSchema,
  MachineOperationStepSchema,
  OutputStepSchema,
])

const SaveWorkflowSchema = z.object({
  steps: z.array(WorkflowStepSchema).min(1, 'At least one workflow step is required'),
  labId: z.string().optional().nullable(),
})

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>
export type SaveWorkflowInput = z.infer<typeof SaveWorkflowSchema>

// ---------------------------------------------------------------------------
// GET /api/admin/recipes/[id]/workflow
// ---------------------------------------------------------------------------
// Returns the saved workflow for a recipe, or 404 if none exists yet.
// The response includes the recipe's ingredient list so the UI can hydrate
// without a second request.
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      // Verify recipe exists
      const recipe = await prisma.recipe.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          laborMinutes: true,
          ingredients: {
            include: {
              rawMaterial: {
                select: { id: true, name: true, type: true, unit: true },
              },
              intermediateProduct: {
                select: { id: true, name: true, type: true, unit: true },
              },
            },
          },
          workflow: true,
        },
      })

      if (!recipe) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Recipe '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      // Parse the stored JSON steps back into a typed array
      let parsedSteps: WorkflowStep[] = []
      if (recipe.workflow?.steps) {
        try {
          parsedSteps = JSON.parse(recipe.workflow.steps) as WorkflowStep[]
        } catch {
          parsedSteps = []
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            laborMinutes: recipe.laborMinutes,
            ingredients: recipe.ingredients,
          },
          workflow: recipe.workflow
            ? {
                id: recipe.workflow.id,
                recipeId: recipe.workflow.recipeId,
                labId: recipe.workflow.labId,
                steps: parsedSteps,
                createdAt: recipe.workflow.createdAt,
                updatedAt: recipe.workflow.updatedAt,
              }
            : null,
        },
      })
    } catch (error) {
      console.error('[GET /api/admin/recipes/[id]/workflow] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve recipe workflow.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// POST /api/admin/recipes/[id]/workflow
// ---------------------------------------------------------------------------
// Creates or replaces the workflow for a recipe (upsert).
// Body: SaveWorkflowInput — { steps: WorkflowStep[], labId?: string }
// Returns the saved workflow record.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(
  async (req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      // Verify recipe exists
      const recipe = await prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: {
            include: {
              rawMaterial: { select: { id: true, name: true, unit: true } },
              intermediateProduct: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      })

      if (!recipe) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Recipe '${id}' was not found.` },
          },
          { status: 404 },
        )
      }

      // Parse and validate body
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

      const parsed = SaveWorkflowSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Workflow validation failed.',
              details: parsed.error.flatten(),
            },
          },
          { status: 422 },
        )
      }

      const { steps, labId } = parsed.data

      // Validate that referenced machineIds exist
      const machineIds = steps
        .filter((s): s is Extract<WorkflowStep, { type: 'machine_operation' }> =>
          s.type === 'machine_operation',
        )
        .map((s) => s.machineId)

      if (machineIds.length > 0) {
        const foundMachines = await prisma.machine.findMany({
          where: { id: { in: machineIds } },
          select: { id: true },
        })
        const foundIds = new Set(foundMachines.map((m) => m.id))
        const missing = machineIds.filter((mid) => !foundIds.has(mid))
        if (missing.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_MACHINE',
                message: 'One or more machines were not found.',
                details: { missingMachineIds: missing },
              },
            },
            { status: 422 },
          )
        }
      }

      // Validate labId if provided
      if (labId) {
        const lab = await prisma.productionLab.findUnique({ where: { id: labId } })
        if (!lab) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'LAB_NOT_FOUND',
                message: `Lab '${labId}' was not found.`,
              },
            },
            { status: 404 },
          )
        }
      }

      // Upsert the workflow record (create or replace)
      const workflow = await prisma.recipeWorkflow.upsert({
        where: { recipeId: id },
        create: {
          recipeId: id,
          steps: JSON.stringify(steps),
          labId: labId ?? null,
        },
        update: {
          steps: JSON.stringify(steps),
          labId: labId ?? null,
        },
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            id: workflow.id,
            recipeId: workflow.recipeId,
            labId: workflow.labId,
            steps,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt,
          },
        },
        { status: 201 },
      )
    } catch (error) {
      console.error('[POST /api/admin/recipes/[id]/workflow] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to save recipe workflow.' },
        },
        { status: 500 },
      )
    }
  },
)

// ---------------------------------------------------------------------------
// DELETE /api/admin/recipes/[id]/workflow
// ---------------------------------------------------------------------------
// Removes the workflow for a recipe entirely.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(
  async (_req: NextRequest, { params }) => {
    try {
      const { id } = params as { id: string }

      const existing = await prisma.recipeWorkflow.findUnique({
        where: { recipeId: id },
      })

      if (!existing) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'No workflow found for this recipe.' },
          },
          { status: 404 },
        )
      }

      await prisma.recipeWorkflow.delete({ where: { recipeId: id } })

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('[DELETE /api/admin/recipes/[id]/workflow] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to delete recipe workflow.' },
        },
        { status: 500 },
      )
    }
  },
)
