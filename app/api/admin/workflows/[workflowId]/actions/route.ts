import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[workflowId]/actions  (admin only)
// ---------------------------------------------------------------------------
// Lists execution history (audit trail) for a workflow.
// Query params: status (enum), page (number), limit (number)
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { workflowId } = params as { workflowId: string }

    const { searchParams } = new URL(req.url)

    const pageRaw = parseInt(searchParams.get('page') ?? '0', 10)
    const page = isNaN(pageRaw) || pageRaw < 0 ? 0 : pageRaw

    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = isNaN(limitRaw) ? 50 : Math.min(100, Math.max(1, limitRaw))

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const
    type ActionStatus = (typeof validStatuses)[number]
    const rawStatus = searchParams.get('status')
    const status: ActionStatus | undefined =
      rawStatus && validStatuses.includes(rawStatus as ActionStatus)
        ? (rawStatus as ActionStatus)
        : undefined

    const { actions, total } = await workflowService.listWorkflowActions(workflowId, {
      status,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: { actions, total },
      pagination: { page, limit, total },
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: error.errors,
          },
        },
        { status: 400 },
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        },
        { status: 404 },
      )
    }
    console.error('[Workflow API]', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNKNOWN', message: 'Internal server error' },
      },
      { status: 500 },
    )
  }
})
