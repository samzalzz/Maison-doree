import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { WorkflowExecutor, WorkflowEngineError } from '@/lib/services/workflow-engine'
import { NotFoundError } from '@/lib/services/workflow-service'
import { prisma } from '@/lib/db/prisma'

// ---------------------------------------------------------------------------
// POST /api/admin/workflows/[workflowId]/execute  (admin only)
// ---------------------------------------------------------------------------
// Triggers the WorkflowExecutor for the specified workflow.
// Body (optional): { triggerData?: object }
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { params, token }) => {
  try {
    const { workflowId } = params as { workflowId: string }

    const body = await req.json().catch(() => ({}))
    const triggerData: Record<string, unknown> =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      body.triggerData &&
      typeof body.triggerData === 'object' &&
      !Array.isArray(body.triggerData)
        ? { ...(body.triggerData as Record<string, unknown>), _triggeredBy: token.id }
        : { _triggeredBy: token.id }

    // Verify workflow exists before handing off to executor
    const exists = await (prisma.workflow as unknown as {
      findUnique: (args: unknown) => Promise<{ id: string } | null>
    }).findUnique({
      where: { id: workflowId },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Workflow not found: ${workflowId}` },
        },
        { status: 404 },
      )
    }

    const executor = new WorkflowExecutor()
    const result = await executor.executeWorkflow(workflowId, prisma, triggerData)

    return NextResponse.json({ success: true, data: result }, { status: 200 })
  } catch (error) {
    if (error instanceof WorkflowEngineError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
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
