import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { executeWorkflow } from '@/lib/workflow-engine'

// ---------------------------------------------------------------------------
// POST /api/admin/workflows/[id]/execute  (admin only)
// ---------------------------------------------------------------------------
// Manually triggers a single workflow with optional context data supplied in
// the request body (e.g. sample batch/stock data for testing).
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { params, token }) => {
  try {
    const { id } = params as { id: string }

    // Optional trigger data in request body — defaults to empty object
    const body = await req.json().catch(() => ({}))
    const triggerData: Record<string, unknown> =
      body && typeof body === 'object' && !Array.isArray(body)
        ? { ...body, _triggeredBy: token.id, _triggeredAt: new Date().toISOString() }
        : { _triggeredBy: token.id, _triggeredAt: new Date().toISOString() }

    const workflow = await prisma.workflow.findUnique({ where: { id } })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' was not found.` } },
        { status: 404 },
      )
    }

    if (!workflow.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WORKFLOW_DISABLED',
            message: `Workflow '${workflow.name}' is disabled. Enable it before executing.`,
          },
        },
        { status: 409 },
      )
    }

    const execution = await executeWorkflow(id, triggerData)

    return NextResponse.json({ success: true, data: execution }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/admin/workflows/[id]/execute] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute workflow.' } },
      { status: 500 },
    )
  }
})
