import { NextRequest, NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/workflows/[workflowId]/executions  (admin only)
// ---------------------------------------------------------------------------
// Returns paginated action/execution history for a workflow.
// Query params: skip, take, status
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest, { params }) => {
  try {
    const { workflowId } = params as { workflowId: string }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    })

    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Workflow '${workflowId}' was not found.` },
        },
        { status: 404 },
      )
    }

    const { searchParams } = new URL(req.url)

    const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '20', 10) || 20))

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const
    type ActionStatus = (typeof validStatuses)[number]
    const rawStatus = searchParams.get('status')?.toUpperCase()
    const status: ActionStatus | undefined =
      rawStatus && validStatuses.includes(rawStatus as ActionStatus)
        ? (rawStatus as ActionStatus)
        : undefined

    const where = {
      workflowId,
      ...(status !== undefined && { status }),
    }

    const [executions, total] = await Promise.all([
      prisma.workflowAction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { step: true },
      }),
      prisma.workflowAction.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: executions,
      pagination: { skip, take, total, hasMore: skip + take < total },
    })
  } catch (error) {
    console.error('[GET /api/admin/workflows/[workflowId]/executions] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve execution history.' },
      },
      { status: 500 },
    )
  }
})
