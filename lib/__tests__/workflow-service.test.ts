/**
 * lib/__tests__/workflow-service.test.ts
 *
 * Unit / integration tests for lib/services/workflow-service.ts
 *
 * Test strategy:
 *  - The Prisma client is fully mocked via jest.mock — no real DB required.
 *  - Each prisma.* call is a jest.fn() whose return value is configured
 *    per-test using mockResolvedValueOnce.
 *  - All 13 service methods are exercised.
 *  - Covers validation errors, not-found errors, FK checks, uniqueness checks,
 *    pagination offset calculation, and cascading deletes.
 *
 * Test cases:
 *   TC-01  createWorkflow — valid minimal input (name only, defaults applied)
 *   TC-02  createWorkflow — valid full input (all fields provided)
 *   TC-03  createWorkflow — ValidationError on blank name
 *   TC-04  createWorkflow — ValidationError on name exceeding 200 chars
 *   TC-05  getWorkflow — found, returns workflow with steps + conditions
 *   TC-06  getWorkflow — NotFoundError when workflow does not exist
 *   TC-07  listWorkflows — no filters, defaults page=0 limit=50, offset=0
 *   TC-08  listWorkflows — filter by isActive=true
 *   TC-09  listWorkflows — filter by triggerType=SCHEDULED
 *   TC-10  listWorkflows — pagination page=1, limit=10 produces offset=10
 *   TC-11  updateWorkflow — sparse update (isActive field only)
 *   TC-12  updateWorkflow — NotFoundError when workflow does not exist
 *   TC-13  deleteWorkflow — success (workflow exists, delete called)
 *   TC-14  deleteWorkflow — NotFoundError when workflow does not exist
 *   TC-15  createWorkflowStep — valid ACTION step (no duplicate stepNumber)
 *   TC-16  createWorkflowStep — ValidationError on duplicate stepNumber
 *   TC-17  createWorkflowStep — NotFoundError when parent workflow missing
 *   TC-18  updateWorkflowStep — stepNumber change triggers uniqueness re-check
 *   TC-19  deleteWorkflowStep — NotFoundError when step does not exist
 *   TC-20  createWorkflowCondition — valid condition attached to existing step
 *   TC-21  createWorkflowCondition — NotFoundError when parent step missing
 *   TC-22  updateWorkflowCondition — partial update (operator + value)
 *   TC-23  deleteWorkflowCondition — success
 *   TC-24  listWorkflowActions — filter by status COMPLETED + pagination
 *   TC-25  listWorkflowActions — NotFoundError when workflow does not exist
 *   TC-26  getWorkflowAction — found
 *   TC-27  getWorkflowAction — NotFoundError
 *   TC-28  Pagination edge case: page=0, limit=100 => offset=0
 *   TC-29  Pagination edge case: page=2, limit=5 => offset=10
 *   TC-30  Error class hierarchy — instanceof checks
 */

// ---------------------------------------------------------------------------
// Mock: Prisma client (must precede all imports that pull in the real client)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    workflow: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowStep: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowCondition: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowAction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks so the mock intercepts the module)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import {
  WorkflowService,
  WorkflowServiceError,
  ValidationError,
  NotFoundError,
} from '@/lib/services/workflow-service'

// ---------------------------------------------------------------------------
// Typed mock references (avoids repeated casts throughout tests)
// ---------------------------------------------------------------------------

const mockWorkflow   = prisma.workflow   as jest.Mocked<typeof prisma.workflow>
const mockStep       = prisma.workflowStep as jest.Mocked<typeof prisma.workflowStep>
const mockCondition  = prisma.workflowCondition as jest.Mocked<typeof prisma.workflowCondition>
const mockAction     = prisma.workflowAction as jest.Mocked<typeof prisma.workflowAction>

// ---------------------------------------------------------------------------
// Shared fixture IDs (valid CUIDs for Zod validation)
// ---------------------------------------------------------------------------

const WF_ID        = 'clh3v2y0k0000356pk1b6vxxt'
const STEP_ID      = 'clh3v2y0k0001356pk1b6vxxt'
const CONDITION_ID = 'clh3v2y0k0002356pk1b6vxxt'
const ACTION_ID    = 'clh3v2y0k0003356pk1b6vxxt'
const USER_ID      = 'clh3v2y0k0004356pk1b6vxxt'
const NOW          = new Date('2026-04-19T10:00:00.000Z')

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: WF_ID,
    name: 'Restock Alert',
    description: 'Triggers on low stock',
    isActive: true,
    triggerType: 'EVENT_BASED',
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    steps: [],
    ...overrides,
  }
}

function makeStep(overrides: Record<string, unknown> = {}) {
  return {
    id: STEP_ID,
    workflowId: WF_ID,
    stepNumber: 1,
    order: 1,
    type: 'ACTION',
    actionType: 'NOTIFY',
    actionPayload: { message: 'Low stock', channels: ['slack'] },
    conditions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeCondition(overrides: Record<string, unknown> = {}) {
  return {
    id: CONDITION_ID,
    stepId: STEP_ID,
    field: 'labStock.quantity',
    operator: 'LESS_THAN',
    value: '10',
    createdAt: NOW,
    ...overrides,
  }
}

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTION_ID,
    workflowId: WF_ID,
    stepId: STEP_ID,
    status: 'COMPLETED',
    executedAt: NOW,
    result: { transferred: 50 },
    errorMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Service instance under test
// ---------------------------------------------------------------------------

let service: WorkflowService

// ---------------------------------------------------------------------------
// Reset all mocks between tests to prevent state leakage
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.resetAllMocks()
  service = new WorkflowService()
})

// ============================================================================
// ERROR CLASS HIERARCHY
// ============================================================================

describe('Error classes (TC-30)', () => {
  it('WorkflowServiceError carries code and name', () => {
    const err = new WorkflowServiceError('base error', 'BASE_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(WorkflowServiceError)
    expect(err.code).toBe('BASE_CODE')
    expect(err.name).toBe('WorkflowServiceError')
    expect(err.message).toBe('base error')
  })

  it('ValidationError is a WorkflowServiceError with VALIDATION_ERROR code', () => {
    const err = new ValidationError('bad input', ['name: required', 'name: too long'])
    expect(err).toBeInstanceOf(WorkflowServiceError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err.errors).toEqual(['name: required', 'name: too long'])
  })

  it('NotFoundError formats message and code correctly', () => {
    const err = new NotFoundError('Workflow', WF_ID)
    expect(err).toBeInstanceOf(WorkflowServiceError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe(`Workflow not found: ${WF_ID}`)
  })
})

// ============================================================================
// 1. createWorkflow
// ============================================================================

describe('createWorkflow', () => {
  it('TC-01 creates a workflow with name only (defaults applied)', async () => {
    const created = makeWorkflow({ name: 'Daily Report', description: null, triggerType: 'MANUAL' })
    mockWorkflow.create.mockResolvedValueOnce(created as never)

    const result = await service.createWorkflow({ name: 'Daily Report' }, USER_ID)

    expect(mockWorkflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Daily Report',
          createdBy: USER_ID,
          isActive: true,
          triggerType: 'MANUAL',
        }),
      }),
    )
    expect(result.name).toBe('Daily Report')
  })

  it('TC-02 creates a workflow with all fields provided', async () => {
    const created = makeWorkflow()
    mockWorkflow.create.mockResolvedValueOnce(created as never)

    const result = await service.createWorkflow(
      {
        name: 'Restock Alert',
        description: 'Triggers on low stock',
        isActive: true,
        triggerType: 'EVENT_BASED',
      },
      USER_ID,
    )

    expect(mockWorkflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Restock Alert',
          description: 'Triggers on low stock',
          triggerType: 'EVENT_BASED',
          isActive: true,
        }),
      }),
    )
    expect(result.triggerType).toBe('EVENT_BASED')
  })

  it('TC-03 throws ValidationError on blank name (empty string)', async () => {
    await expect(
      service.createWorkflow({ name: '' }, USER_ID),
    ).rejects.toThrow(ValidationError)

    await expect(
      service.createWorkflow({ name: '' }, USER_ID),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })

    expect(mockWorkflow.create).not.toHaveBeenCalled()
  })

  it('TC-04 throws ValidationError on name exceeding 200 characters', async () => {
    const longName = 'x'.repeat(201)
    await expect(
      service.createWorkflow({ name: longName }, USER_ID),
    ).rejects.toThrow(ValidationError)

    expect(mockWorkflow.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 2. getWorkflow
// ============================================================================

describe('getWorkflow', () => {
  it('TC-05 returns workflow with steps and conditions', async () => {
    const wf = makeWorkflow({
      steps: [makeStep({ conditions: [makeCondition()] })],
    })
    mockWorkflow.findUnique.mockResolvedValueOnce(wf as never)

    const result = await service.getWorkflow(WF_ID)

    expect(mockWorkflow.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WF_ID } }),
    )
    expect(result.id).toBe(WF_ID)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].conditions).toHaveLength(1)
  })

  it('TC-06 throws NotFoundError when workflow does not exist', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.getWorkflow(WF_ID)).rejects.toThrow(NotFoundError)
    await expect(service.getWorkflow(WF_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining(WF_ID),
    })
  })
})

// ============================================================================
// 3. listWorkflows
// ============================================================================

describe('listWorkflows', () => {
  it('TC-07 lists with no filters, applies defaults (page=0, limit=50, offset=0)', async () => {
    const workflows = [makeWorkflow()]
    mockWorkflow.count.mockResolvedValueOnce(1 as never)
    mockWorkflow.findMany.mockResolvedValueOnce(workflows as never)

    const result = await service.listWorkflows({})

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      }),
    )
    expect(result.total).toBe(1)
    expect(result.workflows).toHaveLength(1)
  })

  it('TC-08 filters by isActive=true', async () => {
    mockWorkflow.count.mockResolvedValueOnce(3 as never)
    mockWorkflow.findMany.mockResolvedValueOnce([makeWorkflow(), makeWorkflow(), makeWorkflow()] as never)

    const result = await service.listWorkflows({ isActive: true })

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    )
    expect(result.total).toBe(3)
  })

  it('TC-09 filters by triggerType=SCHEDULED', async () => {
    mockWorkflow.count.mockResolvedValueOnce(2 as never)
    mockWorkflow.findMany.mockResolvedValueOnce([makeWorkflow(), makeWorkflow()] as never)

    await service.listWorkflows({ triggerType: 'SCHEDULED' })

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ triggerType: 'SCHEDULED' }),
      }),
    )
  })

  it('TC-10 pagination: page=1, limit=10 produces skip=10', async () => {
    mockWorkflow.count.mockResolvedValueOnce(25 as never)
    mockWorkflow.findMany.mockResolvedValueOnce([] as never)

    await service.listWorkflows({ page: 1, limit: 10 })

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 10 }),
    )
  })
})

// ============================================================================
// 4. updateWorkflow
// ============================================================================

describe('updateWorkflow', () => {
  it('TC-11 applies sparse update (isActive only)', async () => {
    const updated = makeWorkflow({ isActive: false })
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockWorkflow.update.mockResolvedValueOnce(updated as never)

    const result = await service.updateWorkflow(WF_ID, { isActive: false }, USER_ID)

    expect(mockWorkflow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WF_ID },
        data: { isActive: false },
      }),
    )
    expect(result.isActive).toBe(false)
  })

  it('TC-12 throws NotFoundError when workflow does not exist', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    await expect(
      service.updateWorkflow(WF_ID, { name: 'New Name' }, USER_ID),
    ).rejects.toThrow(NotFoundError)

    expect(mockWorkflow.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 5. deleteWorkflow
// ============================================================================

describe('deleteWorkflow', () => {
  it('TC-13 deletes a workflow (cascade handled by DB)', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockWorkflow.delete.mockResolvedValueOnce({} as never)

    await expect(service.deleteWorkflow(WF_ID)).resolves.toBeUndefined()

    expect(mockWorkflow.delete).toHaveBeenCalledWith({ where: { id: WF_ID } })
  })

  it('TC-14 throws NotFoundError when workflow does not exist', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.deleteWorkflow(WF_ID)).rejects.toThrow(NotFoundError)

    expect(mockWorkflow.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 6. createWorkflowStep
// ============================================================================

describe('createWorkflowStep', () => {
  const validStepInput = {
    workflowId: WF_ID,
    stepNumber: 1,
    type: 'ACTION' as const,
    actionType: 'NOTIFY',
    actionPayload: { message: 'Low stock', channels: ['slack'] },
  }

  it('TC-15 creates a valid ACTION step', async () => {
    const created = makeStep()
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockStep.findFirst.mockResolvedValueOnce(null as never)          // no duplicate
    mockStep.create.mockResolvedValueOnce(created as never)

    const result = await service.createWorkflowStep(validStepInput)

    expect(mockStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: WF_ID,
          stepNumber: 1,
          order: 1,
          type: 'ACTION',
          actionType: 'NOTIFY',
        }),
      }),
    )
    expect(result.type).toBe('ACTION')
    expect(result.stepNumber).toBe(1)
  })

  it('TC-16 throws ValidationError on duplicate stepNumber', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    // findFirst returns an existing step → duplicate detected
    mockStep.findFirst.mockResolvedValueOnce({ id: 'existing-step' } as never)

    let caught: unknown
    try {
      await service.createWorkflowStep(validStepInput)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(ValidationError)
    expect((caught as ValidationError).code).toBe('VALIDATION_ERROR')
    expect(mockStep.create).not.toHaveBeenCalled()
  })

  it('TC-17 throws NotFoundError when parent workflow does not exist', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.createWorkflowStep(validStepInput)).rejects.toThrow(NotFoundError)

    expect(mockStep.findFirst).not.toHaveBeenCalled()
    expect(mockStep.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 7. updateWorkflowStep
// ============================================================================

describe('updateWorkflowStep', () => {
  it('TC-18 stepNumber change triggers uniqueness re-check (no duplicate found)', async () => {
    const existing = makeStep({ stepNumber: 1 })
    const updated  = makeStep({ stepNumber: 3 })

    mockStep.findUnique.mockResolvedValueOnce({
      id: STEP_ID,
      workflowId: WF_ID,
      stepNumber: 1,
    } as never)
    // Uniqueness check for new stepNumber — no conflict
    mockStep.findFirst.mockResolvedValueOnce(null as never)
    mockStep.update.mockResolvedValueOnce(updated as never)

    const result = await service.updateWorkflowStep(STEP_ID, { stepNumber: 3 })

    expect(mockStep.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflowId: WF_ID,
          stepNumber: 3,
          NOT: { id: STEP_ID },
        }),
      }),
    )
    expect(result.stepNumber).toBe(3)

    void existing // suppress unused warning
  })

  it('throws ValidationError when updated stepNumber conflicts with another step', async () => {
    mockStep.findUnique.mockResolvedValueOnce({
      id: STEP_ID,
      workflowId: WF_ID,
      stepNumber: 1,
    } as never)
    // Conflict found
    mockStep.findFirst.mockResolvedValueOnce({ id: 'other-step' } as never)

    await expect(
      service.updateWorkflowStep(STEP_ID, { stepNumber: 2 }),
    ).rejects.toThrow(ValidationError)

    expect(mockStep.update).not.toHaveBeenCalled()
  })

  it('TC-19 deleteWorkflowStep throws NotFoundError when step does not exist', async () => {
    mockStep.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.deleteWorkflowStep(STEP_ID)).rejects.toThrow(NotFoundError)
    expect(mockStep.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 8. createWorkflowCondition
// ============================================================================

describe('createWorkflowCondition', () => {
  const validConditionInput = {
    stepId: STEP_ID,
    field: 'labStock.quantity',
    operator: 'LESS_THAN' as const,
    value: '10',
  }

  it('TC-20 creates a valid condition', async () => {
    const created = makeCondition()
    mockStep.findUnique.mockResolvedValueOnce({ id: STEP_ID } as never)
    mockCondition.create.mockResolvedValueOnce(created as never)

    const result = await service.createWorkflowCondition(validConditionInput)

    expect(mockCondition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepId: STEP_ID,
          field: 'labStock.quantity',
          operator: 'LESS_THAN',
          value: '10',
        }),
      }),
    )
    expect(result.operator).toBe('LESS_THAN')
  })

  it('TC-21 throws NotFoundError when parent step does not exist', async () => {
    mockStep.findUnique.mockResolvedValueOnce(null as never)

    await expect(
      service.createWorkflowCondition(validConditionInput),
    ).rejects.toThrow(NotFoundError)

    expect(mockCondition.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 9. updateWorkflowCondition
// ============================================================================

describe('updateWorkflowCondition', () => {
  it('TC-22 applies partial update (operator + value only)', async () => {
    const updated = makeCondition({ operator: 'GREATER_THAN', value: '100' })
    mockCondition.findUnique.mockResolvedValueOnce({ id: CONDITION_ID } as never)
    mockCondition.update.mockResolvedValueOnce(updated as never)

    const result = await service.updateWorkflowCondition(CONDITION_ID, {
      operator: 'GREATER_THAN',
      value: '100',
    })

    expect(mockCondition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONDITION_ID },
        data: { operator: 'GREATER_THAN', value: '100' },
      }),
    )
    expect(result.operator).toBe('GREATER_THAN')
    expect(result.value).toBe('100')
  })
})

// ============================================================================
// 10. deleteWorkflowCondition
// ============================================================================

describe('deleteWorkflowCondition', () => {
  it('TC-23 deletes a condition successfully', async () => {
    mockCondition.findUnique.mockResolvedValueOnce({ id: CONDITION_ID } as never)
    mockCondition.delete.mockResolvedValueOnce({} as never)

    await expect(service.deleteWorkflowCondition(CONDITION_ID)).resolves.toBeUndefined()

    expect(mockCondition.delete).toHaveBeenCalledWith({ where: { id: CONDITION_ID } })
  })

  it('throws NotFoundError when condition does not exist', async () => {
    mockCondition.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.deleteWorkflowCondition(CONDITION_ID)).rejects.toThrow(NotFoundError)
    expect(mockCondition.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 11. listWorkflowActions
// ============================================================================

describe('listWorkflowActions', () => {
  it('TC-24 filters by status=COMPLETED and paginates', async () => {
    const actions = [makeAction(), makeAction()]
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockAction.count.mockResolvedValueOnce(2 as never)
    mockAction.findMany.mockResolvedValueOnce(actions as never)

    const result = await service.listWorkflowActions(WF_ID, {
      status: 'COMPLETED',
      page: 0,
      limit: 20,
    })

    expect(mockAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workflowId: WF_ID, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      }),
    )
    expect(result.total).toBe(2)
    expect(result.actions).toHaveLength(2)
  })

  it('TC-25 throws NotFoundError when workflow does not exist', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.listWorkflowActions(WF_ID)).rejects.toThrow(NotFoundError)

    expect(mockAction.findMany).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 12. getWorkflowAction
// ============================================================================

describe('getWorkflowAction', () => {
  it('TC-26 returns a workflow action record', async () => {
    const action = makeAction()
    mockAction.findUnique.mockResolvedValueOnce(action as never)

    const result = await service.getWorkflowAction(ACTION_ID)

    expect(mockAction.findUnique).toHaveBeenCalledWith({ where: { id: ACTION_ID } })
    expect(result.id).toBe(ACTION_ID)
    expect(result.status).toBe('COMPLETED')
  })

  it('TC-27 throws NotFoundError when action does not exist', async () => {
    mockAction.findUnique.mockResolvedValueOnce(null as never)

    await expect(service.getWorkflowAction(ACTION_ID)).rejects.toThrow(NotFoundError)
  })
})

// ============================================================================
// 13. PAGINATION EDGE CASES
// ============================================================================

describe('Pagination edge cases', () => {
  it('TC-28 page=0, limit=100 => skip=0', async () => {
    mockWorkflow.count.mockResolvedValueOnce(0 as never)
    mockWorkflow.findMany.mockResolvedValueOnce([] as never)

    await service.listWorkflows({ page: 0, limit: 100 })

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 }),
    )
  })

  it('TC-29 page=2, limit=5 => skip=10', async () => {
    mockWorkflow.count.mockResolvedValueOnce(0 as never)
    mockWorkflow.findMany.mockResolvedValueOnce([] as never)

    await service.listWorkflows({ page: 2, limit: 5 })

    expect(mockWorkflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 }),
    )
  })

  it('listWorkflowActions applies page × limit offset correctly (page=3, limit=10 => skip=30)', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockAction.count.mockResolvedValueOnce(0 as never)
    mockAction.findMany.mockResolvedValueOnce([] as never)

    await service.listWorkflowActions(WF_ID, { page: 3, limit: 10 })

    expect(mockAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 30 }),
    )
  })

  it('listWorkflowActions uses defaults (page=0, limit=50) when filters omitted', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce({ id: WF_ID } as never)
    mockAction.count.mockResolvedValueOnce(0 as never)
    mockAction.findMany.mockResolvedValueOnce([] as never)

    await service.listWorkflowActions(WF_ID)

    expect(mockAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    )
  })
})

// ============================================================================
// 14. FOREIGN KEY CONSTRAINT VIOLATIONS
// ============================================================================

describe('Foreign key constraint violations', () => {
  it('createWorkflowStep rejects when workflowId references non-existent workflow (FK check)', async () => {
    mockWorkflow.findUnique.mockResolvedValueOnce(null as never)

    const input = {
      workflowId: WF_ID,
      stepNumber: 1,
      type: 'CONDITION' as const,
    }

    await expect(service.createWorkflowStep(input)).rejects.toThrow(NotFoundError)
  })

  it('createWorkflowCondition rejects when stepId references non-existent step (FK check)', async () => {
    mockStep.findUnique.mockResolvedValueOnce(null as never)

    const input = {
      stepId: STEP_ID,
      field: 'labStock.quantity',
      operator: 'EQUALS' as const,
      value: '0',
    }

    await expect(service.createWorkflowCondition(input)).rejects.toThrow(NotFoundError)
  })

  it('updateWorkflowStep throws NotFoundError (step not found) before attempting any DB write', async () => {
    mockStep.findUnique.mockResolvedValueOnce(null as never)

    await expect(
      service.updateWorkflowStep(STEP_ID, { actionType: 'EMAIL' }),
    ).rejects.toThrow(NotFoundError)

    // No uniqueness check or update should have been called
    expect(mockStep.findFirst).not.toHaveBeenCalled()
    expect(mockStep.update).not.toHaveBeenCalled()
  })

  it('updateWorkflowCondition throws NotFoundError when condition is missing', async () => {
    mockCondition.findUnique.mockResolvedValueOnce(null as never)

    await expect(
      service.updateWorkflowCondition(CONDITION_ID, { value: '999' }),
    ).rejects.toThrow(NotFoundError)

    expect(mockCondition.update).not.toHaveBeenCalled()
  })
})
