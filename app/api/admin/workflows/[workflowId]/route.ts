import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[workflowId]  (admin only)
// ---------------------------------------------------------------------------
// Returns a single workflow with its ordered steps and their conditions.
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { workflowId } = params as { workflowId: string }

    const workflow = await workflowService.getWorkflow(workflowId)

    return NextResponse.json({ success: true, data: workflow }, { status: 200 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: (error as Error).message },
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
// PATCH /api/admin/workflows/[workflowId]  (admin only)
// ---------------------------------------------------------------------------
// Applies a sparse/partial update to a workflow.
// Body: partial { name?, description?, isActive?, triggerType? }
// ---------------------------------------------------------------------------

export const PATCH = withAdminAuth(async (req: NextRequest, { params, token }) => {
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

    const updated = await workflowService.updateWorkflow(workflowId, body, token.id)

    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: (error as any).errors,
          },
        },
        { status: 400 },
      )
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: (error as Error).message },
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
// DELETE /api/admin/workflows/[workflowId]  (admin only)
// ---------------------------------------------------------------------------
// Deletes a workflow and cascades to all steps, conditions, and action history.
// Returns 204 No Content on success.
// ---------------------------------------------------------------------------

export const DELETE = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { workflowId } = params as { workflowId: string }

    await workflowService.deleteWorkflow(workflowId)

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: (error as Error).message },
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
