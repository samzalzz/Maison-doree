import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateWorkflowSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows  (admin only)
// ---------------------------------------------------------------------------
// Returns a paginated list of all workflows.
// Query params: skip, take, triggerType, enabled
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    const triggerTypeParam = searchParams.get('triggerType')
    const validTriggers = ['BATCH_CREATED', 'BATCH_COMPLETED', 'LOW_STOCK', 'SCHEDULED', 'MANUAL'] as const
    type TriggerType = (typeof validTriggers)[number]
    const triggerType: TriggerType | undefined =
      triggerTypeParam && validTriggers.includes(triggerTypeParam as TriggerType)
        ? (triggerTypeParam as TriggerType)
        : undefined

    const enabledParam = searchParams.get('enabled')
    const enabled: boolean | undefined =
      enabledParam === 'true' ? true : enabledParam === 'false' ? false : undefined

    const where = {
      ...(triggerType !== undefined && { triggerType }),
      ...(enabled !== undefined && { enabled }),
    }

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { steps: true, executions: true } },
        },
      }),
      prisma.workflow.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: workflows,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/workflows] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve workflows.' } },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/workflows  (admin only)
// ---------------------------------------------------------------------------
// Creates a new workflow together with its ordered steps (conditions + actions)
// in a single atomic transaction.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { token }) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' } },
        { status: 400 },
      )
    }

    const result = CreateWorkflowSchema.safeParse(body)

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

    const { name, description, triggerType, triggerConfig, steps } = result.data

    const workflow = await prisma.$transaction(async (tx) => {
      const created = await tx.workflow.create({
        data: {
          name,
          description: description ?? null,
          triggerType,
          triggerConfig,
          createdBy: token.id,
        },
      })

      for (const step of steps) {
        const workflowStep = await tx.workflowStep.create({
          data: {
            workflowId: created.id,
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

      return tx.workflow.findUnique({
        where: { id: created.id },
        include: {
          steps: {
            orderBy: { order: 'asc' },
            include: { condition: true, action: true },
          },
        },
      })
    })

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/workflows] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create workflow.' } },
      { status: 500 },
    )
  }
})
