import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { UpdateWorkflowSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[id]  (admin only)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string }

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: { condition: true, action: true },
        },
        _count: { select: { executions: true } },
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' was not found.` } },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, data: workflow })
  } catch (error) {
    console.error('[GET /api/admin/workflows/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve workflow.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// PATCH /api/admin/workflows/[id]  (admin only)
// ---------------------------------------------------------------------------
// Supports partial updates. When steps are provided, the existing steps for
// this workflow are deleted and replaced atomically.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const result = UpdateWorkflowSchema.safeParse(body)

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

    const existing = await prisma.workflow.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' was not found.` } },
        { status: 404 },
      )
    }

    const { steps, ...scalarUpdates } = result.data

    const updated = await prisma.$transaction(async (tx) => {
      // Update scalar fields
      await tx.workflow.update({
        where: { id },
        data: {
          ...(scalarUpdates.name !== undefined && { name: scalarUpdates.name }),
          ...(scalarUpdates.description !== undefined && { description: scalarUpdates.description }),
          ...(scalarUpdates.enabled !== undefined && { enabled: scalarUpdates.enabled }),
          ...(scalarUpdates.triggerType !== undefined && { triggerType: scalarUpdates.triggerType }),
          ...(scalarUpdates.triggerConfig !== undefined && { triggerConfig: scalarUpdates.triggerConfig }),
        },
      })

      // Replace steps when provided
      if (steps && steps.length > 0) {
        // Cascade delete removes conditions and actions automatically
        await tx.workflowStep.deleteMany({ where: { workflowId: id } })

        for (const step of steps) {
          const workflowStep = await tx.workflowStep.create({
            data: {
              workflowId: id,
              order: step.order,
              type: step.type,
              elseStepOrder: step.elseStepOrder ?? null,
            },
          })

          if (step.type === 'condition' && step.condition) {
            await tx.workflowCondition.create({
              data: {
                stepId: workflowStep.id,
                field: step.condition.field,
                operator: step.condition.operator,
                value: step.condition.value,
              },
            })
          }

          if (step.type === 'action' && step.action) {
            await tx.workflowAction.create({
              data: {
                stepId: workflowStep.id,
                type: step.action.type,
                config: step.action.config,
              },
            })
          }
        }
      }

      return tx.workflow.findUnique({
        where: { id },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: { condition: true, action: true },
          },
        },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[PATCH /api/admin/workflows/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update workflow.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// DELETE /api/admin/workflows/[id]  (admin only)
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string }

    const existing = await prisma.workflow.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' was not found.` } },
        { status: 404 },
      )
    }

    // Cascade delete handles steps, conditions, actions, and executions
    await prisma.workflow.delete({ where: { id } })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[DELETE /api/admin/workflows/[id]] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete workflow.' } },
      { status: 500 },
    )
  }
})
