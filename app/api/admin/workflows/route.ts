import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// POST /api/admin/workflows  (admin only)
// ---------------------------------------------------------------------------
// Creates a new workflow.
// Body: { name, description?, isActive?, triggerType? }
// Returns: 201 { success: true, data: workflow }
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest, { token }) => {
  try {
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

    const workflow = await workflowService.createWorkflow(body, token.id)

    return NextResponse.json({ success: true, data: workflow }, { status: 201 })
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
// GET /api/admin/workflows  (admin only)
// ---------------------------------------------------------------------------
// Lists workflows with optional filters and pagination.
// Query params: isActive (boolean), triggerType (enum), createdBy (string),
//               page (number), limit (number)
// Default pagination: page=0, limit=50, max limit=100
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)

    // Parse isActive — accept 'true' / 'false' strings only
    const isActiveRaw = searchParams.get('isActive')
    const isActive: boolean | undefined =
      isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined

    // triggerType enum
    const triggerTypeRaw = searchParams.get('triggerType') ?? undefined

    // createdBy plain string filter
    const createdBy = searchParams.get('createdBy') ?? undefined

    // Pagination — defaults provided by WorkflowFiltersSchema but we parse here
    // so malformed values fall back gracefully
    const pageRaw = parseInt(searchParams.get('page') ?? '0', 10)
    const page = isNaN(pageRaw) || pageRaw < 0 ? 0 : pageRaw

    const limitRaw = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = isNaN(limitRaw) ? 50 : Math.min(100, Math.max(1, limitRaw))

    const { workflows, total } = await workflowService.listWorkflows({
      isActive,
      triggerType: triggerTypeRaw as 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED' | undefined,
      createdBy,
      page,
      limit,
    })

    return NextResponse.json({
      success: true,
      data: { workflows, total },
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
