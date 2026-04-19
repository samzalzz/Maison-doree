/**
 * app/api/admin/__tests__/workflow-routes.test.ts
 *
 * Integration-style tests for all Workflow Management API routes.
 *
 * Strategy:
 *  - workflowService singleton is fully mocked (no real DB or auth needed).
 *  - WorkflowExecutor is mocked for the execute endpoint.
 *  - next-auth/jwt getToken is mocked to return a valid admin token by default.
 *  - Each route handler is imported directly and called with a synthetic
 *    NextRequest, allowing full request/response cycle coverage without a
 *    running HTTP server.
 *  - prisma is mocked for the execute route's existence check.
 *
 * Test groups:
 *   1.  POST   /api/admin/workflows
 *   2.  GET    /api/admin/workflows
 *   3.  GET    /api/admin/workflows/[id]
 *   4.  PATCH  /api/admin/workflows/[id]
 *   5.  DELETE /api/admin/workflows/[id]
 *   6.  POST   /api/admin/workflows/[workflowId]/steps
 *   7.  PATCH  /api/admin/workflows/[workflowId]/steps/[stepId]
 *   8.  DELETE /api/admin/workflows/[workflowId]/steps/[stepId]
 *   9.  POST   /api/admin/workflows/[workflowId]/steps/[stepId]/conditions
 *  10.  PATCH  /api/admin/workflows/[workflowId]/steps/[stepId]/conditions/[conditionId]
 *  11.  DELETE /api/admin/workflows/[workflowId]/steps/[stepId]/conditions/[conditionId]
 *  12.  GET    /api/admin/workflows/[workflowId]/actions
 *  13.  GET    /api/admin/workflows/[workflowId]/actions/[actionId]
 *  14.  POST   /api/admin/workflows/[workflowId]/execute
 *  15.  HTTP status code contract tests
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must come before any import that triggers withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: workflow service singleton
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/workflow-service', () => {
  const actual = jest.requireActual('@/lib/services/workflow-service')
  return {
    ...actual, // re-export ValidationError, NotFoundError, WorkflowServiceError
    workflowService: {
      createWorkflow: jest.fn(),
      getWorkflow: jest.fn(),
      listWorkflows: jest.fn(),
      updateWorkflow: jest.fn(),
      deleteWorkflow: jest.fn(),
      createWorkflowStep: jest.fn(),
      updateWorkflowStep: jest.fn(),
      deleteWorkflowStep: jest.fn(),
      createWorkflowCondition: jest.fn(),
      updateWorkflowCondition: jest.fn(),
      deleteWorkflowCondition: jest.fn(),
      listWorkflowActions: jest.fn(),
      getWorkflowAction: jest.fn(),
    },
  }
})

// ---------------------------------------------------------------------------
// Mock: WorkflowExecutor class (execute endpoint)
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/workflow-engine', () => {
  const actual = jest.requireActual('@/lib/services/workflow-engine')
  return {
    ...actual, // re-export WorkflowEngineError etc.
    WorkflowExecutor: jest.fn().mockImplementation(() => ({
      executeWorkflow: jest.fn(),
    })),
  }
})

// ---------------------------------------------------------------------------
// Mock: prisma client (used by execute route for existence check)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    workflow: {
      findUnique: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/db/prisma'
import {
  workflowService,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'
import { WorkflowExecutor, WorkflowEngineError } from '@/lib/services/workflow-engine'

// Route handlers under test
import { POST as postWorkflow, GET as listWorkflows } from '../workflows/route'
import {
  GET as getWorkflowById,
  PATCH as patchWorkflow,
  DELETE as deleteWorkflow,
} from '../workflows/[id]/route'
import { POST as postStep } from '../workflows/[workflowId]/steps/route'
import {
  PATCH as patchStep,
  DELETE as deleteStep,
} from '../workflows/[workflowId]/steps/[stepId]/route'
import { POST as postCondition } from '../workflows/[workflowId]/steps/[stepId]/conditions/route'
import {
  PATCH as patchCondition,
  DELETE as deleteCondition,
} from '../workflows/[workflowId]/steps/[stepId]/conditions/[conditionId]/route'
import { GET as listActions } from '../workflows/[workflowId]/actions/route'
import { GET as getAction } from '../workflows/[workflowId]/actions/[actionId]/route'
import { POST as executeWorkflow } from '../workflows/[workflowId]/execute/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockService = workflowService as jest.Mocked<typeof workflowService>
const mockPrismaWorkflow = (prisma.workflow as unknown) as { findUnique: jest.Mock }

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_ID   = 'clh3v2y0k0000356pk1b6vxxt'
const STEP_ID       = 'clh3v2y0k0001356pk1b6vxxt'
const CONDITION_ID  = 'clh3v2y0k0002356pk1b6vxxt'
const ACTION_ID     = 'clh3v2y0k0003356pk1b6vxxt'
const USER_ID       = 'clh3v2y0k0004356pk1b6vxxt'

const ADMIN_TOKEN = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN' as const,
  sub: USER_ID,
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKFLOW_ID,
    name: 'Test Workflow',
    description: null,
    isActive: true,
    triggerType: 'MANUAL' as const,
    steps: [],
    createdBy: USER_ID,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: STEP_ID,
    workflowId: WORKFLOW_ID,
    stepNumber: 1,
    type: 'ACTION' as const,
    actionType: 'EMAIL',
    actionPayload: { to: 'test@test.com', subject: 'Hi', body: 'Hello' },
    conditions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makeCondition(overrides: Record<string, unknown> = {}) {
  return {
    id: CONDITION_ID,
    stepId: STEP_ID,
    field: 'labStock.quantity',
    operator: 'LESS_THAN' as const,
    value: '10',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTION_ID,
    workflowId: WORKFLOW_ID,
    stepId: STEP_ID,
    status: 'COMPLETED' as const,
    executedAt: new Date('2026-01-01T00:00:00.000Z'),
    result: null,
    errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

/**
 * Builds a NextRequest with an optional JSON body and query parameters.
 */
function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost${path}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url.toString(), {
    method,
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockGetToken.mockResolvedValue(
    ADMIN_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
  )
})

// ============================================================================
// 1. POST /api/admin/workflows
// ============================================================================

describe('POST /api/admin/workflows', () => {
  it('returns 201 with created workflow on success', async () => {
    const workflow = makeWorkflow()
    mockService.createWorkflow.mockResolvedValueOnce(workflow)

    const req = makeRequest('POST', '/api/admin/workflows', {
      name: 'Test Workflow',
    })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(WORKFLOW_ID)
    expect(json.data.name).toBe('Test Workflow')
    expect(mockService.createWorkflow).toHaveBeenCalledTimes(1)
  })

  it('returns 400 with errors array when ValidationError is thrown', async () => {
    mockService.createWorkflow.mockRejectedValueOnce(
      new ValidationError('Invalid input', ['name: Workflow name is required']),
    )

    const req = makeRequest('POST', '/api/admin/workflows', { name: '' })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
    expect(json.error.errors).toContain('name: Workflow name is required')
  })

  it('returns 400 for blank workflow name', async () => {
    mockService.createWorkflow.mockRejectedValueOnce(
      new ValidationError('Invalid input', ['name: Workflow name is required']),
    )

    const req = makeRequest('POST', '/api/admin/workflows', { name: '   ' })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/admin/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{{not-json',
    })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 401 when no auth token is present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeRequest('POST', '/api/admin/workflows', { name: 'Wf' })
    const res = await postWorkflow(req, { params: {} })

    expect(res.status).toBe(401)
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.createWorkflow.mockRejectedValueOnce(new Error('DB connection lost'))

    const req = makeRequest('POST', '/api/admin/workflows', { name: 'Wf' })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })

  it('passes userId from token to service', async () => {
    const workflow = makeWorkflow()
    mockService.createWorkflow.mockResolvedValueOnce(workflow)

    const req = makeRequest('POST', '/api/admin/workflows', { name: 'Wf' })
    await postWorkflow(req, { params: {} })

    expect(mockService.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Wf' }),
      USER_ID,
    )
  })
})

// ============================================================================
// 2. GET /api/admin/workflows
// ============================================================================

describe('GET /api/admin/workflows', () => {
  it('returns 200 with workflows and pagination metadata', async () => {
    const workflows = [makeWorkflow()]
    mockService.listWorkflows.mockResolvedValueOnce({ workflows, total: 1 })

    const req = makeRequest('GET', '/api/admin/workflows')
    const res = await listWorkflows(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.workflows).toHaveLength(1)
    expect(json.data.total).toBe(1)
    expect(json.pagination).toBeDefined()
    expect(json.pagination.page).toBe(0)
    expect(json.pagination.limit).toBe(50)
  })

  it('applies isActive filter from query params', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, { isActive: 'true' })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.isActive).toBe(true)
  })

  it('applies triggerType filter from query params', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, {
      triggerType: 'SCHEDULED',
    })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.triggerType).toBe('SCHEDULED')
  })

  it('applies createdBy filter from query params', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, {
      createdBy: USER_ID,
    })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.createdBy).toBe(USER_ID)
  })

  it('applies page and limit from query params', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, {
      page: '2',
      limit: '10',
    })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.page).toBe(2)
    expect(callArg.limit).toBe(10)
  })

  it('returns 200 with empty workflows when none match filters', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, { isActive: 'false' })
    const res = await listWorkflows(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.workflows).toHaveLength(0)
    expect(json.data.total).toBe(0)
  })

  it('caps limit at 100', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, { limit: '999' })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.limit).toBe(100)
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.listWorkflows.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest('GET', '/api/admin/workflows')
    const res = await listWorkflows(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 3. GET /api/admin/workflows/[id]
// ============================================================================

describe('GET /api/admin/workflows/[id]', () => {
  it('returns 200 with workflow when found', async () => {
    const workflow = makeWorkflow()
    mockService.getWorkflow.mockResolvedValueOnce(workflow)

    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(WORKFLOW_ID)
    expect(mockService.getWorkflow).toHaveBeenCalledWith(WORKFLOW_ID)
  })

  it('returns 404 when workflow is not found', async () => {
    mockService.getWorkflow.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )

    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockService.getWorkflow.mockRejectedValueOnce(new Error('Unexpected'))

    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 4. PATCH /api/admin/workflows/[id]
// ============================================================================

describe('PATCH /api/admin/workflows/[id]', () => {
  it('returns 200 with updated workflow on success', async () => {
    const updated = makeWorkflow({ name: 'Updated Name', isActive: false })
    mockService.updateWorkflow.mockResolvedValueOnce(updated)

    const req = makeRequest('PATCH', `/api/admin/workflows/${WORKFLOW_ID}`, {
      name: 'Updated Name',
      isActive: false,
    })
    const res = await patchWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('Updated Name')
    expect(json.data.isActive).toBe(false)
    expect(mockService.updateWorkflow).toHaveBeenCalledWith(
      WORKFLOW_ID,
      { name: 'Updated Name', isActive: false },
      USER_ID,
    )
  })

  it('returns 404 when workflow does not exist', async () => {
    mockService.updateWorkflow.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )

    const req = makeRequest('PATCH', `/api/admin/workflows/${WORKFLOW_ID}`, {
      name: 'New Name',
    })
    const res = await patchWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 on ValidationError', async () => {
    mockService.updateWorkflow.mockRejectedValueOnce(
      new ValidationError('Invalid update', ['name: must be at least 1 character']),
    )

    const req = makeRequest('PATCH', `/api/admin/workflows/${WORKFLOW_ID}`, { name: '' })
    const res = await patchWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/workflows/${WORKFLOW_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      },
    )
    const res = await patchWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 5. DELETE /api/admin/workflows/[id]
// ============================================================================

describe('DELETE /api/admin/workflows/[id]', () => {
  it('returns 204 No Content on successful deletion', async () => {
    mockService.deleteWorkflow.mockResolvedValueOnce(undefined)

    const req = makeRequest('DELETE', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await deleteWorkflow(req, { params: { id: WORKFLOW_ID } })

    expect(res.status).toBe(204)
    expect(mockService.deleteWorkflow).toHaveBeenCalledWith(WORKFLOW_ID)
  })

  it('returns 404 when workflow does not exist', async () => {
    mockService.deleteWorkflow.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )

    const req = makeRequest('DELETE', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await deleteWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockService.deleteWorkflow.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest('DELETE', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await deleteWorkflow(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 6. POST /api/admin/workflows/[workflowId]/steps
// ============================================================================

describe('POST /api/admin/workflows/[workflowId]/steps', () => {
  it('returns 201 with created step on success', async () => {
    const step = makeStep()
    mockService.createWorkflowStep.mockResolvedValueOnce(step)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps`,
      {
        stepNumber: 1,
        type: 'ACTION',
        actionType: 'EMAIL',
        actionPayload: { to: 'test@test.com', subject: 'Hi', body: 'Hello' },
      },
    )
    const res = await postStep(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(STEP_ID)
    expect(mockService.createWorkflowStep).toHaveBeenCalledTimes(1)
  })

  it('injects workflowId from URL params into service call', async () => {
    const step = makeStep()
    mockService.createWorkflowStep.mockResolvedValueOnce(step)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps`,
      { stepNumber: 1, type: 'CONDITION' },
    )
    await postStep(req, { params: { workflowId: WORKFLOW_ID } })

    expect(mockService.createWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: WORKFLOW_ID }),
    )
  })

  it('returns 400 on ValidationError (invalid step type)', async () => {
    mockService.createWorkflowStep.mockRejectedValueOnce(
      new ValidationError('Invalid step', ['type: Invalid enum value']),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps`,
      { stepNumber: 1, type: 'INVALID_TYPE' },
    )
    const res = await postStep(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
  })

  it('returns 404 when parent workflow does not exist', async () => {
    mockService.createWorkflowStep.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps`,
      { stepNumber: 1, type: 'CONDITION' },
    )
    const res = await postStep(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/workflows/${WORKFLOW_ID}/steps`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{{bad' },
    )
    const res = await postStep(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.createWorkflowStep.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps`,
      { stepNumber: 1, type: 'CONDITION' },
    )
    const res = await postStep(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 7. PATCH /api/admin/workflows/[workflowId]/steps/[stepId]
// ============================================================================

describe('PATCH /api/admin/workflows/[workflowId]/steps/[stepId]', () => {
  it('returns 200 with updated step on success', async () => {
    const step = makeStep({ stepNumber: 2 })
    mockService.updateWorkflowStep.mockResolvedValueOnce(step)

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
      { stepNumber: 2 },
    )
    const res = await patchStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.stepNumber).toBe(2)
    expect(mockService.updateWorkflowStep).toHaveBeenCalledWith(STEP_ID, { stepNumber: 2 })
  })

  it('returns 404 when step does not exist', async () => {
    mockService.updateWorkflowStep.mockRejectedValueOnce(
      new NotFoundError('WorkflowStep', STEP_ID),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
      { stepNumber: 3 },
    )
    const res = await patchStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 on ValidationError', async () => {
    mockService.updateWorkflowStep.mockRejectedValueOnce(
      new ValidationError('Invalid step update', ['stepNumber: must be positive']),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
      { stepNumber: -1 },
    )
    const res = await patchStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'bad' },
    )
    const res = await patchStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 8. DELETE /api/admin/workflows/[workflowId]/steps/[stepId]
// ============================================================================

describe('DELETE /api/admin/workflows/[workflowId]/steps/[stepId]', () => {
  it('returns 204 No Content on successful deletion', async () => {
    mockService.deleteWorkflowStep.mockResolvedValueOnce(undefined)

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
    )
    const res = await deleteStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })

    expect(res.status).toBe(204)
    expect(mockService.deleteWorkflowStep).toHaveBeenCalledWith(STEP_ID)
  })

  it('returns 404 when step does not exist', async () => {
    mockService.deleteWorkflowStep.mockRejectedValueOnce(
      new NotFoundError('WorkflowStep', STEP_ID),
    )

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
    )
    const res = await deleteStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockService.deleteWorkflowStep.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}`,
    )
    const res = await deleteStep(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 9. POST /api/admin/workflows/[workflowId]/steps/[stepId]/conditions
// ============================================================================

describe('POST /api/admin/workflows/[workflowId]/steps/[stepId]/conditions', () => {
  it('returns 201 with created condition on success', async () => {
    const condition = makeCondition()
    mockService.createWorkflowCondition.mockResolvedValueOnce(condition)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      {
        field: 'labStock.quantity',
        operator: 'LESS_THAN',
        value: '10',
      },
    )
    const res = await postCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(CONDITION_ID)
    expect(mockService.createWorkflowCondition).toHaveBeenCalledTimes(1)
  })

  it('injects stepId from URL params into service call', async () => {
    const condition = makeCondition()
    mockService.createWorkflowCondition.mockResolvedValueOnce(condition)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      { field: 'quantity', operator: 'EQUALS', value: '0' },
    )
    await postCondition(req, { params: { workflowId: WORKFLOW_ID, stepId: STEP_ID } })

    expect(mockService.createWorkflowCondition).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: STEP_ID }),
    )
  })

  it('returns 400 on ValidationError (invalid operator)', async () => {
    mockService.createWorkflowCondition.mockRejectedValueOnce(
      new ValidationError('Invalid condition', ['operator: Invalid enum value']),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      { field: 'qty', operator: 'STARTS_WITH', value: '10' },
    )
    const res = await postCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
  })

  it('returns 404 when parent step does not exist', async () => {
    mockService.createWorkflowCondition.mockRejectedValueOnce(
      new NotFoundError('WorkflowStep', STEP_ID),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      { field: 'qty', operator: 'EQUALS', value: '0' },
    )
    const res = await postCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{{bad' },
    )
    const res = await postCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.createWorkflowCondition.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions`,
      { field: 'qty', operator: 'EQUALS', value: '0' },
    )
    const res = await postCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 10. PATCH /api/admin/workflows/[workflowId]/steps/[stepId]/conditions/[conditionId]
// ============================================================================

describe('PATCH conditions/[conditionId]', () => {
  it('returns 200 with updated condition on success', async () => {
    const condition = makeCondition({ value: '50', operator: 'GREATER_THAN' })
    mockService.updateWorkflowCondition.mockResolvedValueOnce(condition)

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
      { value: '50', operator: 'GREATER_THAN' },
    )
    const res = await patchCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.value).toBe('50')
    expect(json.data.operator).toBe('GREATER_THAN')
    expect(mockService.updateWorkflowCondition).toHaveBeenCalledWith(
      CONDITION_ID,
      { value: '50', operator: 'GREATER_THAN' },
    )
  })

  it('returns 404 when condition does not exist', async () => {
    mockService.updateWorkflowCondition.mockRejectedValueOnce(
      new NotFoundError('WorkflowCondition', CONDITION_ID),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
      { value: '20' },
    )
    const res = await patchCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 on ValidationError', async () => {
    mockService.updateWorkflowCondition.mockRejectedValueOnce(
      new ValidationError('Invalid update', ['operator: Invalid enum value']),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
      { operator: 'INVALID' },
    )
    const res = await patchCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'bad' },
    )
    const res = await patchCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 11. DELETE /api/admin/workflows/[workflowId]/steps/[stepId]/conditions/[conditionId]
// ============================================================================

describe('DELETE conditions/[conditionId]', () => {
  it('returns 204 No Content on successful deletion', async () => {
    mockService.deleteWorkflowCondition.mockResolvedValueOnce(undefined)

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
    )
    const res = await deleteCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })

    expect(res.status).toBe(204)
    expect(mockService.deleteWorkflowCondition).toHaveBeenCalledWith(CONDITION_ID)
  })

  it('returns 404 when condition does not exist', async () => {
    mockService.deleteWorkflowCondition.mockRejectedValueOnce(
      new NotFoundError('WorkflowCondition', CONDITION_ID),
    )

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
    )
    const res = await deleteCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockService.deleteWorkflowCondition.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'DELETE',
      `/api/admin/workflows/${WORKFLOW_ID}/steps/${STEP_ID}/conditions/${CONDITION_ID}`,
    )
    const res = await deleteCondition(req, {
      params: { workflowId: WORKFLOW_ID, stepId: STEP_ID, conditionId: CONDITION_ID },
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 12. GET /api/admin/workflows/[workflowId]/actions
// ============================================================================

describe('GET /api/admin/workflows/[workflowId]/actions', () => {
  it('returns 200 with actions list and pagination metadata', async () => {
    const actions = [makeAction()]
    mockService.listWorkflowActions.mockResolvedValueOnce({ actions, total: 1 })

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
    )
    const res = await listActions(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.actions).toHaveLength(1)
    expect(json.data.total).toBe(1)
    expect(json.pagination).toBeDefined()
    expect(json.pagination.page).toBe(0)
    expect(json.pagination.limit).toBe(50)
  })

  it('filters by status query param', async () => {
    mockService.listWorkflowActions.mockResolvedValueOnce({ actions: [], total: 0 })

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
      undefined,
      { status: 'FAILED' },
    )
    await listActions(req, { params: { workflowId: WORKFLOW_ID } })

    expect(mockService.listWorkflowActions).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.objectContaining({ status: 'FAILED' }),
    )
  })

  it('passes page and limit from query params', async () => {
    mockService.listWorkflowActions.mockResolvedValueOnce({ actions: [], total: 0 })

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
      undefined,
      { page: '1', limit: '20' },
    )
    await listActions(req, { params: { workflowId: WORKFLOW_ID } })

    expect(mockService.listWorkflowActions).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })

  it('returns 404 when workflow does not exist', async () => {
    mockService.listWorkflowActions.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
    )
    const res = await listActions(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('ignores unknown status filter values', async () => {
    mockService.listWorkflowActions.mockResolvedValueOnce({ actions: [], total: 0 })

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
      undefined,
      { status: 'UNKNOWN_STATUS' },
    )
    await listActions(req, { params: { workflowId: WORKFLOW_ID } })

    expect(mockService.listWorkflowActions).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.objectContaining({ status: undefined }),
    )
  })

  it('returns 500 on unexpected error', async () => {
    mockService.listWorkflowActions.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions`,
    )
    const res = await listActions(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 13. GET /api/admin/workflows/[workflowId]/actions/[actionId]
// ============================================================================

describe('GET /api/admin/workflows/[workflowId]/actions/[actionId]', () => {
  it('returns 200 with action when found', async () => {
    const action = makeAction()
    mockService.getWorkflowAction.mockResolvedValueOnce(action)

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions/${ACTION_ID}`,
    )
    const res = await getAction(req, { params: { workflowId: WORKFLOW_ID, actionId: ACTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(ACTION_ID)
    expect(mockService.getWorkflowAction).toHaveBeenCalledWith(ACTION_ID)
  })

  it('returns 404 when action is not found', async () => {
    mockService.getWorkflowAction.mockRejectedValueOnce(
      new NotFoundError('WorkflowAction', ACTION_ID),
    )

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions/${ACTION_ID}`,
    )
    const res = await getAction(req, { params: { workflowId: WORKFLOW_ID, actionId: ACTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockService.getWorkflowAction.mockRejectedValueOnce(new Error('Unexpected'))

    const req = makeRequest(
      'GET',
      `/api/admin/workflows/${WORKFLOW_ID}/actions/${ACTION_ID}`,
    )
    const res = await getAction(req, { params: { workflowId: WORKFLOW_ID, actionId: ACTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 14. POST /api/admin/workflows/[workflowId]/execute
// ============================================================================

describe('POST /api/admin/workflows/[workflowId]/execute', () => {
  function getMockExecutorInstance() {
    const MockConstructor = WorkflowExecutor as jest.MockedClass<typeof WorkflowExecutor>
    return MockConstructor.mock.results[MockConstructor.mock.results.length - 1]?.value as {
      executeWorkflow: jest.Mock
    }
  }

  it('returns 200 with execution result on success', async () => {
    mockPrismaWorkflow.findUnique.mockResolvedValueOnce({ id: WORKFLOW_ID })

    const executionResult = {
      workflowId: WORKFLOW_ID,
      status: 'COMPLETED' as const,
      stepsExecuted: 2,
      actions: [{ stepId: STEP_ID, status: 'COMPLETED' as const }],
    }

    // The route creates a new WorkflowExecutor() instance each call
    const MockConstructor = WorkflowExecutor as jest.MockedClass<typeof WorkflowExecutor>
    MockConstructor.mockImplementationOnce(
      () => ({ executeWorkflow: jest.fn().mockResolvedValueOnce(executionResult) }) as unknown as WorkflowExecutor,
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
      { triggerData: { labId: 'lab1' } },
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.workflowId).toBe(WORKFLOW_ID)
    expect(json.data.status).toBe('COMPLETED')
    expect(json.data.stepsExecuted).toBe(2)
  })

  it('returns 404 when workflow does not exist', async () => {
    mockPrismaWorkflow.findUnique.mockResolvedValueOnce(null)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when WorkflowEngineError is thrown', async () => {
    mockPrismaWorkflow.findUnique.mockResolvedValueOnce({ id: WORKFLOW_ID })

    const MockConstructor = WorkflowExecutor as jest.MockedClass<typeof WorkflowExecutor>
    MockConstructor.mockImplementationOnce(
      () => ({
        executeWorkflow: jest.fn().mockRejectedValueOnce(
          new WorkflowEngineError('WORKFLOW_INACTIVE', 'Workflow is inactive'),
        ),
      }) as unknown as WorkflowExecutor,
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('WORKFLOW_INACTIVE')
  })

  it('forwards optional triggerData body to executor', async () => {
    mockPrismaWorkflow.findUnique.mockResolvedValueOnce({ id: WORKFLOW_ID })

    const mockExecuteWorkflow = jest.fn().mockResolvedValueOnce({
      workflowId: WORKFLOW_ID,
      status: 'COMPLETED',
      stepsExecuted: 0,
      actions: [],
    })

    const MockConstructor = WorkflowExecutor as jest.MockedClass<typeof WorkflowExecutor>
    MockConstructor.mockImplementationOnce(
      () => ({ executeWorkflow: mockExecuteWorkflow }) as unknown as WorkflowExecutor,
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
      { triggerData: { labId: 'clh3v2y0k0000356pk1b6vxxt', quantity: 5 } },
    )
    await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })

    expect(mockExecuteWorkflow).toHaveBeenCalledWith(
      WORKFLOW_ID,
      expect.anything(), // prisma client
      expect.objectContaining({ labId: 'clh3v2y0k0000356pk1b6vxxt', quantity: 5 }),
    )
  })

  it('returns 401 when no auth token is present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })

    expect(res.status).toBe(401)
  })

  it('returns 500 on unexpected error', async () => {
    mockPrismaWorkflow.findUnique.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('UNKNOWN')
  })
})

// ============================================================================
// 15. HTTP Status Code Contract Tests
// ============================================================================

describe('HTTP status code contracts', () => {
  it('POST creates return 201', async () => {
    mockService.createWorkflow.mockResolvedValueOnce(makeWorkflow())
    const req = makeRequest('POST', '/api/admin/workflows', { name: 'Test' })
    const res = await postWorkflow(req, { params: {} })
    expect(res.status).toBe(201)
  })

  it('GET single resources return 200', async () => {
    mockService.getWorkflow.mockResolvedValueOnce(makeWorkflow())
    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    expect(res.status).toBe(200)
  })

  it('PATCH updates return 200', async () => {
    mockService.updateWorkflow.mockResolvedValueOnce(makeWorkflow({ name: 'New' }))
    const req = makeRequest('PATCH', `/api/admin/workflows/${WORKFLOW_ID}`, { name: 'New' })
    const res = await patchWorkflow(req, { params: { id: WORKFLOW_ID } })
    expect(res.status).toBe(200)
  })

  it('DELETE returns 204 No Content', async () => {
    mockService.deleteWorkflow.mockResolvedValueOnce(undefined)
    const req = makeRequest('DELETE', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await deleteWorkflow(req, { params: { id: WORKFLOW_ID } })
    expect(res.status).toBe(204)
  })

  it('ValidationError returns 400', async () => {
    mockService.createWorkflow.mockRejectedValueOnce(
      new ValidationError('Bad input', ['name: required']),
    )
    const req = makeRequest('POST', '/api/admin/workflows', {})
    const res = await postWorkflow(req, { params: {} })
    expect(res.status).toBe(400)
  })

  it('NotFoundError returns 404', async () => {
    mockService.getWorkflow.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )
    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    expect(res.status).toBe(404)
  })

  it('Unexpected errors return 500', async () => {
    mockService.deleteWorkflow.mockRejectedValueOnce(new Error('Crash'))
    const req = makeRequest('DELETE', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await deleteWorkflow(req, { params: { id: WORKFLOW_ID } })
    expect(res.status).toBe(500)
  })

  it('error responses include code and message fields', async () => {
    mockService.getWorkflow.mockRejectedValueOnce(
      new NotFoundError('Workflow', WORKFLOW_ID),
    )
    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(json.success).toBe(false)
    expect(typeof json.error.code).toBe('string')
    expect(typeof json.error.message).toBe('string')
  })

  it('ValidationError responses include errors array', async () => {
    mockService.createWorkflow.mockRejectedValueOnce(
      new ValidationError('Bad input', ['name: too short', 'triggerType: invalid']),
    )
    const req = makeRequest('POST', '/api/admin/workflows', { name: '' })
    const res = await postWorkflow(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(Array.isArray(json.error.errors)).toBe(true)
    expect(json.error.errors).toHaveLength(2)
  })

  it('success responses include success:true and data fields', async () => {
    mockService.getWorkflow.mockResolvedValueOnce(makeWorkflow())
    const req = makeRequest('GET', `/api/admin/workflows/${WORKFLOW_ID}`)
    const res = await getWorkflowById(req, { params: { id: WORKFLOW_ID } })
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
  })
})
