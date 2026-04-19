import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// POST /api/admin/workflows/[workflowId]/steps  (admin only)
// ---------------------------------------------------------------------------
// Creates a new step within an existing workflow.
// Body: { workflowId, stepNumber, type, actionType?, actionPayload? }
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { workflowId } = params as { workflowId: string }

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

    const step = await workflowService.createWorkflowStep({
      ...body,
      workflowId,
    })

    return NextResponse.json({ success: true, data: step }, { status: 201 })
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
