import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[workflowId]/actions/[actionId]  (admin only)
// ---------------------------------------------------------------------------
// Returns a single workflow action (execution audit record) by its ID.
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (_req: NextRequest, { params }) => {
  try {
    const { actionId } = params as { workflowId: string; actionId: string }

    const action = await workflowService.getWorkflowAction(actionId)

    return NextResponse.json({ success: true, data: action }, { status: 200 })
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
