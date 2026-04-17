import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[id]/executions  (admin only)
// ---------------------------------------------------------------------------
// Returns paginated execution history for a workflow.
// Query params: skip, take, status
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { id } = params as { id: string }

    const workflow = await prisma.workflow.findUnique({ where: { id }, select: { id: true } })

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' was not found.` } },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    const validStatuses = ['pending', 'running', 'completed', 'failed'] as const
    type ExecutionStatus = (typeof validStatuses)[number]
    const rawStatus = searchParams.get('status')
    const status: ExecutionStatus | undefined =
      rawStatus && validStatuses.includes(rawStatus as ExecutionStatus)
        ? (rawStatus as ExecutionStatus)
        : undefined

    const where = {
      workflowId: id,
      ...(status !== undefined && { status }),
    }

    const [executions, total] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.workflowExecution.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: executions,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/workflows/[id]/executions] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve execution history.' } },
      { status: 500 },
    )
  }
})
