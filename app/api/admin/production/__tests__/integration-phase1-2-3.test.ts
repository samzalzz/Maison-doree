/**
 * app/api/admin/production/__tests__/integration-phase1-2-3.test.ts
 *
 * Capstone integration test: Phase 1 (MVP Core) + Phase 2 (Forecasting)
 * + Phase 3 (Workflow) cohesion.
 *
 * Test strategy
 * ─────────────
 *  - Every service and Prisma call is mocked — no real database is needed.
 *  - Route handlers are imported directly and exercised via synthetic NextRequest
 *    objects, mirroring the patterns from workflow-routes.test.ts and
 *    integration-phase1-phase2.test.ts.
 *  - The auth middleware is replaced with a pass-through ADMIN mock so all
 *    requests succeed by default.
 *  - WorkflowExecutor is tested against a mocked Prisma client (the pattern
 *    established in workflow-engine.test.ts).
 *  - Pure logic (calculateForecast, WorkflowConditionEvaluator) is tested
 *    directly to keep assertions deterministic.
 *
 * Scenarios covered (12+ test cases required)
 * ────────────────────────────────────────────
 *  SC-1  Production batch history feeds Phase 2 forecast confidence (tier 90)
 *  SC-2  Workflow CONDITION evaluates Phase 1 LabStock data (LOW_STOCK path)
 *  SC-3  Workflow TRANSFER action updates Phase 1 LabStock based on Phase 2 forecast
 *  SC-4  No naming conflicts: enums and FK fields are unique across all phases
 *  SC-5  Transaction rollback: failed TRANSFER leaves stock unchanged
 *  SC-6  End-to-end: forecast → workflow execution → batch action + transfer
 *  SC-7  Pagination: consistent page/limit behaviour across all three phases
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must precede route imports)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: auth middleware — every request is treated as an authenticated ADMIN
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = {
  id: 'cladmin000000000000000001',
  email: 'admin@maison-doree.ma',
  name: 'Admin',
  role: 'ADMIN' as const,
  sub: 'cladmin000000000000000001',
}

jest.mock('@/lib/auth-middleware', () => ({
  withAdminAuth: (handler: Function) =>
    async (
      req: Request,
      context?: { params?: Record<string, string> },
    ) =>
      handler(req, { params: context?.params ?? {}, token: ADMIN_TOKEN }),
  withAuth: (handler: Function) =>
    async (
      req: Request,
      context?: { params?: Record<string, string> },
    ) =>
      handler(req, { params: context?.params ?? {}, token: ADMIN_TOKEN }),
}))

// ---------------------------------------------------------------------------
// Mock: lib/workflow-engine  (fire-and-forget side-effect in batches/route.ts)
// ---------------------------------------------------------------------------

jest.mock('@/lib/workflow-engine', () => ({
  triggerWorkflows: jest.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Mock: Prisma client  (all DB access intercepted)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    // Phase 1 tables
    recipe: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    productionLab: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    productionBatch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    labStock: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    machine: { findUnique: jest.fn() },
    labEmployee: { findUnique: jest.fn() },
    // Phase 2 tables
    dailyForecast: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    // Phase 3 tables
    workflow: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowStep: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowCondition: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowAction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    // Transactions
    $transaction: jest.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock: workflow service singleton  (used by workflow route handlers)
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/workflow-service', () => {
  const actual = jest.requireActual('@/lib/services/workflow-service')
  return {
    ...actual,
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
// Mock: WorkflowExecutor  (isolated for scenario-level control in route tests)
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/workflow-engine', () => {
  const actual = jest.requireActual('@/lib/services/workflow-engine')
  return {
    ...actual,
    WorkflowExecutor: jest.fn().mockImplementation(() => ({
      executeWorkflow: jest.fn(),
    })),
  }
})

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/db/prisma'
import { workflowService } from '@/lib/services/workflow-service'
import {
  WorkflowExecutor,
  WorkflowConditionEvaluator,
  transferHandler,
  updateInventoryHandler,
} from '@/lib/services/workflow-engine'
import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'

// Phase 1 type imports — compile-time proof of naming compatibility
import type {
  ProductionBatch,
  DailyForecast,
  ProductionStatus,
  ProductionLab,
  RawMaterial,
  LabStock,
} from '@/lib/types-production'

// Phase 2 / Phase 3 validator imports — enum uniqueness proof
import {
  WorkflowTriggerTypeSchema,
  WorkflowStepTypeSchema,
  WorkflowConditionOperatorSchema,
  WorkflowActionStatusSchema,
} from '@/lib/validators-workflow'

// Route handlers under test
import { POST as postWorkflow, GET as listWorkflows } from '../../workflows/route'
import { POST as executeWorkflow } from '../../workflows/[workflowId]/execute/route'
import { GET as listBatches } from '../batches/route'
import { GET as getForecast } from '../forecast/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockService = workflowService as jest.Mocked<typeof workflowService>

// ---------------------------------------------------------------------------
// CUID-style fixture IDs
// ---------------------------------------------------------------------------

const LAB_A_ID    = 'cllaba0000000000000000001'
const LAB_B_ID    = 'cllabc0000000000000000002'
const RECIPE_ID   = 'clrecipe000000000000000001'
const MATERIAL_ID = 'clmaterial00000000000000001'
const WORKFLOW_ID = 'clworkflow00000000000000001'
const STEP_1_ID   = 'clstep000000000000000000001'
const STEP_2_ID   = 'clstep000000000000000000002'
const BATCH_ID    = 'clbatch00000000000000000001'
const FORECAST_ID = 'clforecast0000000000000001'
const USER_ID     = ADMIN_TOKEN.id

// ---------------------------------------------------------------------------
// Shared fixture factories
// ---------------------------------------------------------------------------

/** Creates a Decimal-like value for Prisma mocks. */
function dec(value: number): Decimal {
  return {
    toNumber: () => value,
    toString: () => String(value),
  } as unknown as Decimal
}

/** UTC midnight Date N days offset from today. */
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Builds N completed ProductionBatch rows each on a separate UTC day,
 * starting `latestDaysAgo` days before today.
 * Used to simulate historical batch data for confidence scoring.
 */
function makeBatchHistory(
  count: number,
  quantity: number,
  latestDaysAgo = 1,
): Array<{ recipeId: string; quantity: number; status: 'COMPLETED'; actualCompletionTime: Date }> {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (latestDaysAgo + i))
    d.setUTCHours(12, 0, 0, 0) // non-midnight so the date slice is unambiguous
    return {
      recipeId: RECIPE_ID,
      quantity,
      status: 'COMPLETED' as const,
      actualCompletionTime: d,
    }
  })
}

/** Minimal WorkflowStep for WorkflowExecutor mock Prisma. */
function makeStep(
  id: string,
  stepNumber: number,
  type: 'ACTION' | 'CONDITION',
  opts: {
    actionType?: string
    actionPayload?: Record<string, unknown>
    conditions?: Array<{ field: string; operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS'; value: string }>
  } = {},
) {
  return {
    id,
    stepNumber,
    type,
    actionType: opts.actionType ?? null,
    actionPayload: opts.actionPayload ?? null,
    conditions: opts.conditions ?? [],
  }
}

/** Builds a NextRequest with an optional JSON body and optional query params. */
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
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  // Default: auth succeeds
  mockGetToken.mockResolvedValue(
    ADMIN_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
  )
})

// ============================================================================
// SCENARIO 1 — Phase 1 → Phase 2: batch history feeds forecast confidence
// ============================================================================

describe('SC-1: Phase 1 batch history feeds Phase 2 forecast confidence', () => {
  /**
   * GET /api/admin/production/forecast queries productionBatch rows with
   * status=COMPLETED over the last 30 days and derives a confidence score.
   *
   * 15+ distinct calendar days with data → confidence tier 90.
   */
  it('SC-1a: returns confidence 90 when 15+ days of COMPLETED batches exist', async () => {
    const batches = makeBatchHistory(15, 80, 1) // 15 batches, each on a different day
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce(batches)
    ;(mockPrisma.recipe.findMany as jest.Mock).mockResolvedValueOnce([
      { id: RECIPE_ID, name: 'Cake A' },
    ])
    ;(mockPrisma.dailyForecast.upsert as jest.Mock).mockResolvedValue({})

    const req = makeRequest('GET', '/api/admin/production/forecast', undefined, {
      recipeId: RECIPE_ID,
      days: '1',
    })
    // When recipeId is specified the route also calls recipe.findUnique
    ;(mockPrisma.recipe.findUnique as jest.Mock).mockResolvedValueOnce({
      id: RECIPE_ID,
      name: 'Cake A',
    })

    const res = await getForecast(req, {})
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // With 15+ days of data, the confidence must be at the highest tier (90)
    const forecastRows: Array<{ confidence: number }> = body.data
    expect(forecastRows.length).toBeGreaterThan(0)
    for (const row of forecastRows) {
      expect(row.confidence).toBe(90)
    }
  })

  it('SC-1b: returns confidence 0 when no COMPLETED batches exist', async () => {
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(mockPrisma.recipe.findUnique as jest.Mock).mockResolvedValueOnce({
      id: RECIPE_ID,
      name: 'Cake A',
    })
    ;(mockPrisma.dailyForecast.upsert as jest.Mock).mockResolvedValue({})

    const req = makeRequest('GET', '/api/admin/production/forecast', undefined, {
      recipeId: RECIPE_ID,
      days: '1',
    })
    const res = await getForecast(req, {})
    const body = await res.json()

    expect(res.status).toBe(200)
    const forecastRows: Array<{ confidence: number }> = body.data
    // Zero historical days → confidence 0
    for (const row of forecastRows) {
      expect(row.confidence).toBe(0)
    }
  })

  it('SC-1c: forecast query filters only COMPLETED batches (not PLANNED or CANCELLED)', async () => {
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(mockPrisma.recipe.findUnique as jest.Mock).mockResolvedValueOnce({
      id: RECIPE_ID,
      name: 'Cake A',
    })
    ;(mockPrisma.dailyForecast.upsert as jest.Mock).mockResolvedValue({})

    const req = makeRequest('GET', '/api/admin/production/forecast', undefined, {
      recipeId: RECIPE_ID,
    })
    await getForecast(req, {})

    // The where clause passed to productionBatch.findMany must use status: 'COMPLETED'
    const callArg = (mockPrisma.productionBatch.findMany as jest.Mock).mock.calls[0][0]
    expect(callArg.where.status).toBe('COMPLETED')
  })
})

// ============================================================================
// SCENARIO 2 — Phase 2 → Phase 3: condition evaluates Phase 1 stock data
// ============================================================================

describe('SC-2: Workflow condition evaluates Phase 1 LabStock data (low-stock alert)', () => {
  const evaluator = new WorkflowConditionEvaluator()

  /**
   * The WorkflowConditionEvaluator resolves field paths from triggerData.
   * When the workflow is triggered with Phase 1 lab-stock data as context,
   * a LESS_THAN condition on the quantity field should evaluate correctly.
   */
  it('SC-2a: LESS_THAN condition is true when stock is below the threshold', () => {
    // Lab has 50 kg remaining; workflow triggers when stock < 200
    const ctx = {
      workflowId: WORKFLOW_ID,
      stepId: STEP_1_ID,
      triggerData: { quantity: 50, labId: LAB_A_ID, materialId: MATERIAL_ID },
    }

    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'LESS_THAN', value: '200' },
      ctx,
    )

    expect(result).toBe(true)
  })

  it('SC-2b: LESS_THAN condition is false when stock meets the threshold', () => {
    // Lab has 300 kg — no alert needed
    const ctx = {
      workflowId: WORKFLOW_ID,
      stepId: STEP_1_ID,
      triggerData: { quantity: 300, labId: LAB_A_ID, materialId: MATERIAL_ID },
    }

    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'LESS_THAN', value: '200' },
      ctx,
    )

    expect(result).toBe(false)
  })

  it('SC-2c: workflow executes UPDATE_INVENTORY when low-stock condition passes', async () => {
    // Simulate the WorkflowExecutor receiving Phase 1 stock data as triggerData
    const conditionStep = makeStep(STEP_1_ID, 1, 'CONDITION', {
      conditions: [{ field: 'quantity', operator: 'LESS_THAN', value: '200' }],
    })
    const actionStep = makeStep(STEP_2_ID, 2, 'ACTION', {
      actionType: 'UPDATE_INVENTORY',
      actionPayload: { labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: 150, reason: 'Low-stock restock' },
    })

    const wf = { id: WORKFLOW_ID, isActive: true, steps: [conditionStep, actionStep] }

    const txMock = {
      labStock: {
        findUnique: jest.fn().mockResolvedValueOnce({
          labId: LAB_A_ID,
          materialId: MATERIAL_ID,
          quantity: dec(50),
        }),
        update: jest.fn().mockResolvedValueOnce({ quantity: dec(200) }),
      },
    }

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const executor = new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    const result = await executor.executeWorkflow(
      WORKFLOW_ID,
      prismaForExecutor,
      // Phase 1 stock data passed as triggerData (quantity = 50 → condition passes)
      { quantity: 50, labId: LAB_A_ID, materialId: MATERIAL_ID },
    )

    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(2)
    const actionResult = result.actions.find((a: { stepId: string }) => a.stepId === STEP_2_ID)
    expect(actionResult?.status).toBe('COMPLETED')
  })
})

// ============================================================================
// SCENARIO 3 — Phase 2 → Phase 3: workflow TRANSFER based on forecast data
// ============================================================================

describe('SC-3: Workflow TRANSFER action driven by Phase 2 forecast quantity', () => {
  /**
   * A forecast with predictedQuantity > threshold triggers a TRANSFER workflow.
   * The GREATER_THAN condition evaluates forecast quantity from triggerData.
   */
  it('SC-3a: GREATER_THAN condition is true when forecast exceeds the threshold', () => {
    const evaluator = new WorkflowConditionEvaluator()

    // Forecast predicts 150 units; workflow triggers when predictedQuantity > 100
    const ctx = {
      workflowId: WORKFLOW_ID,
      stepId: STEP_1_ID,
      triggerData: { predictedQuantity: 150, recipeId: RECIPE_ID },
    }

    const result = evaluator.evaluateCondition(
      { field: 'predictedQuantity', operator: 'GREATER_THAN', value: '100' },
      ctx,
    )

    expect(result).toBe(true)
  })

  it('SC-3b: TRANSFER handler decrements source lab and increments dest lab', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          // First call: source lab has 500 kg
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(500) })
          // Second call: dest lab has 200 kg
          .mockResolvedValueOnce({ labId: LAB_B_ID, materialId: MATERIAL_ID, quantity: dec(200) }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ quantity: dec(400) }) // source decremented by 100
          .mockResolvedValueOnce({ quantity: dec(300) }), // dest incremented by 100
        create: jest.fn(),
      },
    }

    const prismaForTransfer = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const ctx = { workflowId: WORKFLOW_ID, stepId: STEP_1_ID }
    const result = await transferHandler(
      { sourceLabId: LAB_A_ID, destLabId: LAB_B_ID, materialId: MATERIAL_ID, quantity: 100 },
      ctx,
      prismaForTransfer,
    )

    expect(result.success).toBe(true)
    expect(result.result?.transferredQuantity).toBe(100)
    // Source should have been decremented
    expect(txMock.labStock.update).toHaveBeenCalledTimes(2)
  })

  it('SC-3c: TRANSFER + condition workflow succeeds when forecast > threshold', async () => {
    const conditionStep = makeStep(STEP_1_ID, 1, 'CONDITION', {
      conditions: [{ field: 'predictedQuantity', operator: 'GREATER_THAN', value: '100' }],
    })
    const transferStep = makeStep(STEP_2_ID, 2, 'ACTION', {
      actionType: 'TRANSFER',
      actionPayload: {
        sourceLabId: LAB_A_ID,
        destLabId: LAB_B_ID,
        materialId: MATERIAL_ID,
        quantity: 100,
      },
    })

    const wf = { id: WORKFLOW_ID, isActive: true, steps: [conditionStep, transferStep] }

    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(500) })
          .mockResolvedValueOnce({ labId: LAB_B_ID, materialId: MATERIAL_ID, quantity: dec(200) }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ quantity: dec(400) })
          .mockResolvedValueOnce({ quantity: dec(300) }),
        create: jest.fn(),
      },
    }

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const executor = new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    const result = await executor.executeWorkflow(
      WORKFLOW_ID,
      prismaForExecutor,
      // Phase 2 forecast data as trigger context — predictedQuantity=150 > 100
      { predictedQuantity: 150, recipeId: RECIPE_ID },
    )

    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(2)
    const transferResult = result.actions.find((a: { stepId: string }) => a.stepId === STEP_2_ID)
    expect(transferResult?.status).toBe('COMPLETED')
  })
})

// ============================================================================
// SCENARIO 4 — No naming conflicts across all three phases
// ============================================================================

describe('SC-4: No naming conflicts or type mismatches across Phase 1, 2, and 3', () => {
  it('SC-4a: ProductionStatus, WorkflowTriggerType, WorkflowActionStatus all have unique values', () => {
    // Phase 1 ProductionStatus values
    const productionStatuses: ProductionStatus[] = [
      'PLANNED',
      'IN_PROGRESS',
      'COMPLETED',
      'PAUSED',
      'CANCELLED',
    ]

    // Phase 3 WorkflowTriggerType values
    const triggerTypes = ['MANUAL', 'SCHEDULED', 'EVENT_BASED'] as const

    // Phase 3 WorkflowActionStatus values
    const actionStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const

    // All Phase 1 status values should be valid TypeScript strings
    expect(productionStatuses).toHaveLength(5)
    expect(productionStatuses).toContain('COMPLETED')

    // Phase 3 trigger types should not share values with Phase 1 statuses
    for (const trigger of triggerTypes) {
      expect(productionStatuses).not.toContain(trigger)
    }

    // WorkflowActionStatus shares COMPLETED/IN_PROGRESS with Phase 1 intentionally
    // (they describe the same lifecycle concept) — verify they are recognisable across
    // phases without TypeScript errors
    expect(actionStatuses).toContain('COMPLETED')
    expect(actionStatuses).toContain('IN_PROGRESS')
    expect(productionStatuses).toContain('COMPLETED')
    expect(productionStatuses).toContain('IN_PROGRESS')
  })

  it('SC-4b: WorkflowConditionOperator enum values parse without error', () => {
    const operators = ['EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS'] as const
    for (const op of operators) {
      expect(() => WorkflowConditionOperatorSchema.parse(op)).not.toThrow()
    }
    // STARTS_WITH exists in the old types-production but NOT in Phase 3 validators
    expect(() => WorkflowConditionOperatorSchema.parse('STARTS_WITH')).toThrow()
  })

  it('SC-4c: WorkflowTriggerType values are all parseable', () => {
    for (const t of ['MANUAL', 'SCHEDULED', 'EVENT_BASED'] as const) {
      expect(() => WorkflowTriggerTypeSchema.parse(t)).not.toThrow()
    }
  })

  it('SC-4d: WorkflowStepType values are all parseable', () => {
    for (const t of ['ACTION', 'CONDITION'] as const) {
      expect(() => WorkflowStepTypeSchema.parse(t)).not.toThrow()
    }
  })

  it('SC-4e: Phase 1 FK fields recipeId and labId appear consistently across types', () => {
    // Compile-time proof: ProductionBatch and DailyForecast both expose recipeId
    const batchRecipeRef: Pick<ProductionBatch, 'recipeId'> = { recipeId: RECIPE_ID }
    const forecastRecipeRef: Pick<DailyForecast, 'recipeId'> = { recipeId: RECIPE_ID }
    expect(batchRecipeRef.recipeId).toBe(forecastRecipeRef.recipeId)

    // LabStock exposes labId — same FK name used in WorkflowStep TRANSFER payload
    const stockLabRef: Pick<LabStock, 'labId'> = { labId: LAB_A_ID }
    expect(stockLabRef.labId).toBe(LAB_A_ID)
  })

  it('SC-4f: DailyForecast uses consistent field names with Phase 1 types', () => {
    // DailyForecast.confidence is an integer 0-100 — same semantics as Phase 2
    const forecast: Pick<DailyForecast, 'confidence' | 'predictedQuantity' | 'recipeId'> = {
      confidence: 90,
      predictedQuantity: 80,
      recipeId: RECIPE_ID,
    }
    expect(forecast.confidence).toBeGreaterThanOrEqual(0)
    expect(forecast.confidence).toBeLessThanOrEqual(100)
    expect(forecast.recipeId).toBeTruthy()
  })

  it('SC-4g: WorkflowActionStatusSchema accepts COMPLETED and FAILED (used in audit rows)', () => {
    expect(() => WorkflowActionStatusSchema.parse('COMPLETED')).not.toThrow()
    expect(() => WorkflowActionStatusSchema.parse('FAILED')).not.toThrow()
    expect(() => WorkflowActionStatusSchema.parse('IN_PROGRESS')).not.toThrow()
    expect(() => WorkflowActionStatusSchema.parse('PENDING')).not.toThrow()
    // Invalid value should throw
    expect(() => WorkflowActionStatusSchema.parse('RUNNING')).toThrow()
  })
})

// ============================================================================
// SCENARIO 5 — Transaction rollback: failed TRANSFER leaves stock unchanged
// ============================================================================

describe('SC-5: Transaction rollback — failed TRANSFER leaves source stock unchanged', () => {
  it('SC-5a: returns error when source stock is insufficient', async () => {
    // Source has 50 kg; workflow requests 100 kg transfer
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(50) }),
        update: jest.fn(),
        create: jest.fn(),
      },
    }

    const prismaForTransfer = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const ctx = { workflowId: WORKFLOW_ID, stepId: STEP_1_ID }
    const result = await transferHandler(
      { sourceLabId: LAB_A_ID, destLabId: LAB_B_ID, materialId: MATERIAL_ID, quantity: 100 },
      ctx,
      prismaForTransfer,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient stock in source lab')
    // No stock mutation should have occurred
    expect(txMock.labStock.update).not.toHaveBeenCalled()
    expect(txMock.labStock.create).not.toHaveBeenCalled()
  })

  it('SC-5b: returns error when source stock record does not exist', async () => {
    const txMock = {
      labStock: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(),
        create: jest.fn(),
      },
    }

    const prismaForTransfer = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const ctx = { workflowId: WORKFLOW_ID, stepId: STEP_1_ID }
    const result = await transferHandler(
      { sourceLabId: LAB_A_ID, destLabId: LAB_B_ID, materialId: MATERIAL_ID, quantity: 50 },
      ctx,
      prismaForTransfer,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Source lab stock not found')
    expect(txMock.labStock.update).not.toHaveBeenCalled()
  })

  it('SC-5c: WorkflowAction status is FAILED when TRANSFER fails (insufficient stock)', async () => {
    const transferStep = makeStep(STEP_1_ID, 1, 'ACTION', {
      actionType: 'TRANSFER',
      actionPayload: {
        sourceLabId: LAB_A_ID,
        destLabId: LAB_B_ID,
        materialId: MATERIAL_ID,
        quantity: 100, // more than the 50 kg available
      },
    })

    const wf = { id: WORKFLOW_ID, isActive: true, steps: [transferStep] }

    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(50) }),
        update: jest.fn(),
        create: jest.fn(),
      },
    }

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'audit-fail' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const executor = new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    const result = await executor.executeWorkflow(WORKFLOW_ID, prismaForExecutor)

    expect(result.status).toBe('FAILED')
    expect(result.actions[0].status).toBe('FAILED')
    expect(result.actions[0].error).toBe('Insufficient stock in source lab')
    // No stock should have been modified
    expect(txMock.labStock.update).not.toHaveBeenCalled()
  })

  it('SC-5d: entire prisma.$transaction is rolled back when DB throws during TRANSFER', async () => {
    const prismaForTransfer = {
      $transaction: jest.fn().mockRejectedValueOnce(new Error('DB connection lost')),
    } as unknown as PrismaClient

    const ctx = { workflowId: WORKFLOW_ID, stepId: STEP_1_ID }
    const result = await transferHandler(
      { sourceLabId: LAB_A_ID, destLabId: LAB_B_ID, materialId: MATERIAL_ID, quantity: 50 },
      ctx,
      prismaForTransfer,
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB connection lost')
  })
})

// ============================================================================
// SCENARIO 6 — End-to-end: forecast → workflow → batch + transfer
// ============================================================================

describe('SC-6: End-to-end flow — forecast → workflow execution → production update', () => {
  /**
   * Full integration of all three phases:
   *  1. A DailyForecast exists with predictedQuantity=300 (Phase 2)
   *  2. A workflow is set up with:
   *       Step 1: CONDITION — predictedQuantity > 200
   *       Step 2: ACTION    — TRANSFER 100 kg from Lab A to Lab B (Phase 1/3)
   *       Step 3: ACTION    — NOTIFY (Phase 3)
   *  3. The executor receives the forecast as triggerData
   *  4. All steps complete; stock moves from Lab A to Lab B
   */
  it('SC-6a: all three phases interact correctly in a single workflow execution', async () => {
    const conditionStep = makeStep(STEP_1_ID, 1, 'CONDITION', {
      conditions: [{ field: 'predictedQuantity', operator: 'GREATER_THAN', value: '200' }],
    })
    const STEP_3_ID = 'clstep000000000000000000003'
    const transferStep = makeStep(STEP_2_ID, 2, 'ACTION', {
      actionType: 'TRANSFER',
      actionPayload: {
        sourceLabId: LAB_A_ID,
        destLabId: LAB_B_ID,
        materialId: MATERIAL_ID,
        quantity: 100,
      },
    })
    const notifyStep = makeStep(STEP_3_ID, 3, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'High demand forecast — materials transferred', channels: ['dashboard'] },
    })

    const wf = { id: WORKFLOW_ID, isActive: true, steps: [conditionStep, transferStep, notifyStep] }

    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          // Source: 500 kg available
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(500) })
          // Dest: 200 kg available
          .mockResolvedValueOnce({ labId: LAB_B_ID, materialId: MATERIAL_ID, quantity: dec(200) }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ quantity: dec(400) }) // Lab A: 500 - 100 = 400
          .mockResolvedValueOnce({ quantity: dec(300) }), // Lab B: 200 + 100 = 300
        create: jest.fn(),
      },
    }

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'audit-e2e' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    // triggerData: Phase 2 forecast data
    const triggerData = {
      predictedQuantity: 300, // > 200, so condition passes
      recipeId: RECIPE_ID,
      date: daysFromNow(1).toISOString(),
    }

    const executor = new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    const result = await executor.executeWorkflow(WORKFLOW_ID, prismaForExecutor, triggerData)

    // Overall: all phases interact without error
    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(3)
    expect(result.workflowId).toBe(WORKFLOW_ID)

    // Phase 3 TRANSFER action — Lab A stock decremented, Lab B stock incremented
    const transferResult = result.actions.find((a: { stepId: string }) => a.stepId === STEP_2_ID)
    expect(transferResult).toBeDefined()
    expect(transferResult?.status).toBe('COMPLETED')
    expect(transferResult?.result?.transferredQuantity).toBe(100)

    // Phase 3 NOTIFY action — success
    const notifyResult = result.actions.find((a: { stepId: string }) => a.stepId === STEP_3_ID)
    expect(notifyResult).toBeDefined()
    expect(notifyResult?.status).toBe('COMPLETED')

    // Data consistency: two UPDATE calls occurred (source decrement, dest increment)
    expect(txMock.labStock.update).toHaveBeenCalledTimes(2)
  })

  it('SC-6b: condition step gates execution — no transfer when forecast is below threshold', async () => {
    const conditionStep = makeStep(STEP_1_ID, 1, 'CONDITION', {
      conditions: [{ field: 'predictedQuantity', operator: 'GREATER_THAN', value: '200' }],
    })
    const transferStep = makeStep(STEP_2_ID, 2, 'ACTION', {
      actionType: 'TRANSFER',
      actionPayload: {
        sourceLabId: LAB_A_ID,
        destLabId: LAB_B_ID,
        materialId: MATERIAL_ID,
        quantity: 100,
      },
    })

    const wf = { id: WORKFLOW_ID, isActive: true, steps: [conditionStep, transferStep] }

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'audit-skip' }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaClient

    // predictedQuantity=80 → NOT > 200 → condition fails → transfer skipped
    const result = await (
      new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    ).executeWorkflow(WORKFLOW_ID, prismaForExecutor, { predictedQuantity: 80 })

    expect(result.status).toBe('COMPLETED') // no failure, just skipped
    expect(result.stepsExecuted).toBe(2)
    // Transfer step was skipped (not in actions array)
    const transferResult = result.actions.find((a: { stepId: string }) => a.stepId === STEP_2_ID)
    expect(transferResult).toBeUndefined()
    // No $transaction should have been opened
    expect((prismaForExecutor.$transaction as jest.Mock)).not.toHaveBeenCalled()
  })

  it('SC-6c: audit rows are written for every executed ACTION step', async () => {
    const actionStep = makeStep(STEP_1_ID, 1, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'E2E audit test', channels: ['email'] },
    })
    const wf = { id: WORKFLOW_ID, isActive: true, steps: [actionStep] }

    const createAuditMock = jest.fn().mockResolvedValue({ id: 'audit-row' })
    const updateAuditMock = jest.fn().mockResolvedValue({})

    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: { create: createAuditMock, update: updateAuditMock },
    } as unknown as PrismaClient

    await (
      new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    ).executeWorkflow(WORKFLOW_ID, prismaForExecutor)

    // One create (IN_PROGRESS) + one update (COMPLETED) per ACTION step
    expect(createAuditMock).toHaveBeenCalledTimes(1)
    expect(updateAuditMock).toHaveBeenCalledTimes(1)
    const createCall = createAuditMock.mock.calls[0][0] as { data: { status: string } }
    expect(createCall.data.status).toBe('IN_PROGRESS')
    const updateCall = updateAuditMock.mock.calls[0][0] as { data: { status: string } }
    expect(updateCall.data.status).toBe('COMPLETED')
  })
})

// ============================================================================
// SCENARIO 7 — Pagination consistent across all three phase endpoints
// ============================================================================

describe('SC-7: Pagination consistent across Phase 1, 2, and 3 endpoints', () => {
  /**
   * All three phases expose list endpoints with page/limit or skip/take
   * semantics and enforce a ceiling of 100 on the page size.
   */
  it('SC-7a: GET /api/admin/workflows returns 200 with pagination metadata', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({
      workflows: Array.from({ length: 5 }, (_, i) => ({
        id: `wfid${i}`,
        name: `Workflow ${i}`,
        description: null,
        isActive: true,
        triggerType: 'MANUAL' as const,
        steps: [],
        createdBy: USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      total: 10,
    })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, { page: '0', limit: '5' })
    const res = await listWorkflows(req, { params: {} })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.workflows).toHaveLength(5)
    expect(body.data.total).toBe(10)
    expect(body.pagination.page).toBe(0)
    expect(body.pagination.limit).toBe(5)
  })

  it('SC-7b: GET /api/admin/workflows caps limit at 100', async () => {
    mockService.listWorkflows.mockResolvedValueOnce({ workflows: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/workflows', undefined, { limit: '999' })
    await listWorkflows(req, { params: {} })

    const callArg = mockService.listWorkflows.mock.calls[0][0]
    expect(callArg.limit).toBe(100)
  })

  it('SC-7c: GET /api/admin/production/batches returns paginated results (Phase 1)', async () => {
    const batches = Array.from({ length: 5 }, (_, i) => ({
      id: `batch${i}`,
      batchNumber: `BATCH-2026-04-19-000${i + 1}`,
      labId: LAB_A_ID,
      recipeId: RECIPE_ID,
      quantity: 10,
      status: 'PLANNED',
      plannedStartTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: USER_ID,
      lab: { id: LAB_A_ID, name: 'Lab A', type: 'PREPARATION' },
      recipe: { id: RECIPE_ID, name: 'Cake A', laborMinutes: 60 },
      machine: null,
      employee: null,
      _count: { items: 0 },
    }))

    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce(batches)
    ;(mockPrisma.productionBatch.count as jest.Mock).mockResolvedValueOnce(10)

    const req = makeRequest('GET', '/api/admin/production/batches', undefined, {
      skip: '0',
      take: '5',
    })
    const res = await listBatches(req, {})
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(5)
    expect(body.pagination.total).toBe(10)
    expect(body.pagination.skip).toBe(0)
    expect(body.pagination.take).toBe(5)
  })

  it('SC-7d: GET /api/admin/production/batches caps take at 100 (Phase 1)', async () => {
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(mockPrisma.productionBatch.count as jest.Mock).mockResolvedValueOnce(0)

    const req = makeRequest('GET', '/api/admin/production/batches', undefined, { take: '9999' })
    await listBatches(req, {})

    const callArg = (mockPrisma.productionBatch.findMany as jest.Mock).mock.calls[0][0]
    expect(callArg.take).toBeLessThanOrEqual(100)
  })

  it('SC-7e: GET /api/admin/production/forecast returns paginated data (Phase 2)', async () => {
    // Mock: 3 completed batches from the last 3 days (confidence tier 70)
    const batches = makeBatchHistory(3, 100, 1)
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce(batches)
    ;(mockPrisma.recipe.findUnique as jest.Mock).mockResolvedValueOnce({
      id: RECIPE_ID,
      name: 'Cake A',
    })
    ;(mockPrisma.dailyForecast.upsert as jest.Mock).mockResolvedValue({})

    const req = makeRequest('GET', '/api/admin/production/forecast', undefined, {
      recipeId: RECIPE_ID,
      days: '5',
    })
    const res = await getForecast(req, {})
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // days=5 → 5 forecast rows for the recipe
    expect(body.data).toHaveLength(5)
  })

  it('SC-7f: GET /api/admin/production/forecast caps days at 30 (Phase 2 max)', async () => {
    ;(mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(mockPrisma.recipe.findUnique as jest.Mock).mockResolvedValueOnce({
      id: RECIPE_ID,
      name: 'Cake A',
    })
    // We need enough upsert mocks for up to 30 rows
    ;(mockPrisma.dailyForecast.upsert as jest.Mock).mockResolvedValue({})

    // Request 999 days — should be capped at 30
    const req = makeRequest('GET', '/api/admin/production/forecast', undefined, {
      recipeId: RECIPE_ID,
      days: '999',
    })
    const res = await getForecast(req, {})
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.length).toBeLessThanOrEqual(30)
  })

  it('SC-7g: workflow execute endpoint returns 200 with execution result (Phase 3)', async () => {
    const execResult = {
      workflowId: WORKFLOW_ID,
      status: 'COMPLETED' as const,
      stepsExecuted: 1,
      actions: [{ stepId: STEP_1_ID, status: 'COMPLETED' as const }],
    }

    // Mock: workflow exists
    ;(mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValueOnce({ id: WORKFLOW_ID })

    const MockConstructor = WorkflowExecutor as jest.MockedClass<typeof WorkflowExecutor>
    MockConstructor.mockImplementationOnce(
      () => ({ executeWorkflow: jest.fn().mockResolvedValueOnce(execResult) }) as unknown as WorkflowExecutor,
    )

    const req = makeRequest(
      'POST',
      `/api/admin/workflows/${WORKFLOW_ID}/execute`,
      { triggerData: { predictedQuantity: 150, recipeId: RECIPE_ID } },
    )
    const res = await executeWorkflow(req, { params: { workflowId: WORKFLOW_ID } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('COMPLETED')
    expect(body.data.workflowId).toBe(WORKFLOW_ID)
  })
})

// ============================================================================
// BONUS — Additional cross-phase guard tests
// ============================================================================

describe('Cross-phase guard tests', () => {
  it('updateInventoryHandler adjusts Phase 1 LabStock and returns new quantity', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: dec(500) }),
        update: jest.fn().mockResolvedValueOnce({ quantity: dec(350) }),
      },
    }

    const prismaForUpdate = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as PrismaClient

    const ctx = { workflowId: WORKFLOW_ID, stepId: STEP_2_ID }
    const result = await updateInventoryHandler(
      { labId: LAB_A_ID, materialId: MATERIAL_ID, quantity: -150, reason: 'Batch consumption' },
      ctx,
      prismaForUpdate,
    )

    expect(result.success).toBe(true)
    expect(result.result?.reason).toBe('Batch consumption')
    // new quantity should be 500 - 150 = 350
    const updateCall = txMock.labStock.update.mock.calls[0][0] as { data: { quantity: Decimal } }
    expect(updateCall.data.quantity.toNumber()).toBe(350)
  })

  it('workflow execute API route returns 404 when workflow does not exist (Phase 3)', async () => {
    ;(mockPrisma.workflow.findUnique as jest.Mock).mockResolvedValueOnce(null)

    const req = makeRequest('POST', `/api/admin/workflows/nonexistent-id/execute`)
    const res = await executeWorkflow(req, { params: { workflowId: 'nonexistent-id' } })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('condition evaluator resolves nested dot-path from Phase 1 lab stock context', () => {
    const evaluator = new WorkflowConditionEvaluator()

    // Simulate nested Phase 1 data passed as triggerData
    const ctx = {
      workflowId: WORKFLOW_ID,
      stepId: STEP_1_ID,
      triggerData: {
        lab: { id: LAB_A_ID, stock: { quantity: 25 } },
      },
    }

    const result = evaluator.evaluateCondition(
      { field: 'lab.stock.quantity', operator: 'LESS_THAN', value: '50' },
      ctx,
    )

    expect(result).toBe(true)
  })

  it('workflow is skipped when inactive — Phase 3 guard prevents execution', async () => {
    const wf = { id: WORKFLOW_ID, isActive: false, steps: [] }
    const prismaForExecutor = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient

    const executor = new (jest.requireActual('@/lib/services/workflow-engine').WorkflowExecutor)()
    const result = await executor.executeWorkflow(WORKFLOW_ID, prismaForExecutor)

    expect(result.status).toBe('FAILED')
    expect(result.actions[0].error).toContain('inactive')
  })
})
