import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// PATCH /api/admin/workflows/[workflowId]/steps/[stepId]  (admin only)
// ---------------------------------------------------------------------------
// Applies a partial update to a workflow step.
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { stepId } = params as { workflowId: string; stepId: string }

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

    const step = await workflowService.updateWorkflowStep(stepId, body)

    return NextResponse.json({ success: true, data: step }, { status: 200 })
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

// ---------------------------------------------------------------------------
// DELETE /api/admin/workflows/[workflowId]/steps/[stepId]  (admin only)
// ---------------------------------------------------------------------------
// Deletes a step and cascades to its conditions.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { stepId } = params as { workflowId: string; stepId: string }

    await workflowService.deleteWorkflowStep(stepId)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
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
