/**
 * lib/__tests__/workflow-engine.test.ts
 *
 * Unit tests for lib/services/workflow-engine.ts
 *
 * Test strategy
 * ─────────────
 *  • All Prisma calls are replaced with lightweight jest mocks — no real DB is
 *    needed.  This keeps tests fast and deterministic.
 *  • Each describe block maps to one of the exported classes / functions.
 *  • Inline comments annotate which "conceptual test case" from the task spec
 *    each test covers (TC-1 … TC-12+).
 *
 * Coverage targets (≥ 12 test cases as required by the task):
 *   TC-01  Valid workflow execution — ACTION steps only (COMPLETED)
 *   TC-02  Workflow with CONDITION step that passes (execution continues)
 *   TC-03  Workflow with CONDITION step that fails (steps are skipped)
 *   TC-04  WorkflowConditionEvaluator — EQUALS operator
 *   TC-05  WorkflowConditionEvaluator — GREATER_THAN operator
 *   TC-06  WorkflowConditionEvaluator — LESS_THAN operator
 *   TC-07  WorkflowConditionEvaluator — CONTAINS operator
 *   TC-08  TRANSFER handler — success (both labs already have stock)
 *   TC-09  TRANSFER handler — insufficient stock (returns error result)
 *   TC-10  TRANSFER handler — source stock not found (returns error result)
 *   TC-11  UPDATE_INVENTORY handler — success (positive delta)
 *   TC-12  UPDATE_INVENTORY handler — material not found (returns error result)
 *   TC-13  UPDATE_INVENTORY handler — negative delta (decrement)
 *   TC-14  NOTIFY handler — success with multiple channels
 *   TC-15  NOTIFY handler — empty channels array (returns error result)
 *   TC-16  EMAIL handler — success
 *   TC-17  EMAIL handler — invalid email (returns error result)
 *   TC-18  Transaction rollback on TRANSFER failure
 *   TC-19  Mixed CONDITION + ACTION workflow (condition gates action)
 *   TC-20  Workflow not found returns FAILED result
 *   TC-21  Inactive workflow returns FAILED result
 *   TC-22  Unknown action handler returns FAILED result
 */

import { Decimal } from '@prisma/client/runtime/library'
import {
  WorkflowEngineError,
  ConditionEvaluationError,
  WorkflowConditionEvaluator,
  transferHandler,
  updateInventoryHandler,
  notifyHandler,
  emailHandler,
  WorkflowExecutor,
} from '../services/workflow-engine'

// ============================================================================
// HELPERS — mock Prisma builders
// ============================================================================

/** Creates a minimal PrismaClient mock shaped for the inventory helpers. */
function buildMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(overrides.tx ?? {})),
    labStock: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    workflow: {
      findUnique: jest.fn(),
    },
    workflowAction: {
      create: jest.fn().mockResolvedValue({ id: 'audit-row-id' }),
      update: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as import('@prisma/client').PrismaClient
}

/** Builds a minimal HydratedStep shape. */
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

/** A fake Decimal-like value that satisfies toNumber(). */
function dec(value: number): Decimal {
  return {
    toNumber: () => value,
    toString: () => String(value),
  } as unknown as Decimal
}

// ============================================================================
// TC-04 … TC-07 — WorkflowConditionEvaluator
// ============================================================================

describe('WorkflowConditionEvaluator', () => {
  const evaluator = new WorkflowConditionEvaluator()
  const ctx = (data: Record<string, unknown> = {}) => ({
    workflowId: 'wf-1',
    stepId: 'step-1',
    triggerData: data,
  })

  // TC-04: EQUALS
  it('TC-04: EQUALS — returns true when field value matches exactly', () => {
    const result = evaluator.evaluateCondition(
      { field: 'status', operator: 'EQUALS', value: 'LOW' },
      ctx({ status: 'LOW' }),
    )
    expect(result).toBe(true)
  })

  it('TC-04b: EQUALS — returns false when field value does not match', () => {
    const result = evaluator.evaluateCondition(
      { field: 'status', operator: 'EQUALS', value: 'HIGH' },
      ctx({ status: 'LOW' }),
    )
    expect(result).toBe(false)
  })

  // TC-05: GREATER_THAN
  it('TC-05: GREATER_THAN — returns true when actual > threshold', () => {
    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'GREATER_THAN', value: '50' },
      ctx({ quantity: 100 }),
    )
    expect(result).toBe(true)
  })

  it('TC-05b: GREATER_THAN — returns false when actual <= threshold', () => {
    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'GREATER_THAN', value: '100' },
      ctx({ quantity: 50 }),
    )
    expect(result).toBe(false)
  })

  // TC-06: LESS_THAN
  it('TC-06: LESS_THAN — returns true when actual < threshold', () => {
    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'LESS_THAN', value: '50' },
      ctx({ quantity: 10 }),
    )
    expect(result).toBe(true)
  })

  it('TC-06b: LESS_THAN — returns false when actual >= threshold', () => {
    const result = evaluator.evaluateCondition(
      { field: 'quantity', operator: 'LESS_THAN', value: '10' },
      ctx({ quantity: 50 }),
    )
    expect(result).toBe(false)
  })

  // TC-07: CONTAINS
  it('TC-07: CONTAINS — returns true when field value includes the substring', () => {
    const result = evaluator.evaluateCondition(
      { field: 'name', operator: 'CONTAINS', value: 'flour' },
      ctx({ name: 'wheat-flour-500g' }),
    )
    expect(result).toBe(true)
  })

  it('TC-07b: CONTAINS — returns false when substring is absent', () => {
    const result = evaluator.evaluateCondition(
      { field: 'name', operator: 'CONTAINS', value: 'sugar' },
      ctx({ name: 'wheat-flour-500g' }),
    )
    expect(result).toBe(false)
  })

  it('evaluateStep returns true when all conditions pass (OR logic — at least one true)', () => {
    const step = makeStep('s1', 1, 'CONDITION', {
      conditions: [
        { field: 'quantity', operator: 'LESS_THAN', value: '5' },   // false
        { field: 'status', operator: 'EQUALS', value: 'LOW' },       // true
      ],
    })
    const result = evaluator.evaluateStep(step, ctx({ quantity: 10, status: 'LOW' }))
    expect(result).toBe(true)
  })

  it('evaluateStep returns false when all conditions fail', () => {
    const step = makeStep('s1', 1, 'CONDITION', {
      conditions: [
        { field: 'quantity', operator: 'LESS_THAN', value: '5' },   // false
        { field: 'status', operator: 'EQUALS', value: 'CRITICAL' }, // false
      ],
    })
    const result = evaluator.evaluateStep(step, ctx({ quantity: 10, status: 'LOW' }))
    expect(result).toBe(false)
  })

  it('evaluateStep returns true when no conditions are attached (pass-through)', () => {
    const step = makeStep('s1', 1, 'CONDITION', { conditions: [] })
    expect(evaluator.evaluateStep(step, ctx())).toBe(true)
  })

  it('evaluateCondition resolves nested dot-paths', () => {
    const result = evaluator.evaluateCondition(
      { field: 'lab.quantity', operator: 'GREATER_THAN', value: '0' },
      ctx({ lab: { quantity: 5 } }),
    )
    expect(result).toBe(true)
  })

  it('evaluateCondition returns false for NaN numeric comparison', () => {
    const result = evaluator.evaluateCondition(
      { field: 'value', operator: 'GREATER_THAN', value: 'not-a-number' },
      ctx({ value: 10 }),
    )
    expect(result).toBe(false)
  })
})

// ============================================================================
// TC-08 … TC-10 — transferHandler
// ============================================================================

describe('transferHandler', () => {
  const ctx: import('../services/workflow-engine').WorkflowContext = {
    workflowId: 'wf-1',
    stepId: 'step-1',
  }
  const payload = {
    sourceLabId: 'lab-src',
    destLabId: 'lab-dst',
    materialId: 'mat-1',
    quantity: 30,
  }

  // TC-08: success
  it('TC-08: succeeds when source has sufficient stock and dest already exists', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          // first call → source stock
          .mockResolvedValueOnce({ labId: 'lab-src', materialId: 'mat-1', quantity: dec(100) })
          // second call → dest stock
          .mockResolvedValueOnce({ labId: 'lab-dst', materialId: 'mat-1', quantity: dec(50) }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ quantity: dec(70) })  // source after decrement
          .mockResolvedValueOnce({ quantity: dec(80) }),  // dest after increment
        create: jest.fn(),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await transferHandler(payload, ctx, prisma)

    expect(result.success).toBe(true)
    expect(result.result?.transferredQuantity).toBe(30)
    expect(txMock.labStock.create).not.toHaveBeenCalled()
  })

  it('TC-08b: creates dest stock when it does not exist yet', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: 'lab-src', materialId: 'mat-1', quantity: dec(100) })
          .mockResolvedValueOnce(null), // dest doesn't exist
        update: jest.fn().mockResolvedValueOnce({ quantity: dec(70) }),
        create: jest.fn().mockResolvedValue({ quantity: dec(30) }),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await transferHandler(payload, ctx, prisma)

    expect(result.success).toBe(true)
    expect(txMock.labStock.create).toHaveBeenCalledTimes(1)
  })

  // TC-09: insufficient stock
  it('TC-09: returns error result when source has insufficient stock', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: 'lab-src', materialId: 'mat-1', quantity: dec(10) }),
        update: jest.fn(),
        create: jest.fn(),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await transferHandler(payload, ctx, prisma)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient stock in source lab')
    expect(txMock.labStock.update).not.toHaveBeenCalled()
  })

  // TC-10: source stock not found
  it('TC-10: returns error result when source lab stock does not exist', async () => {
    const txMock = {
      labStock: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(),
        create: jest.fn(),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await transferHandler(payload, ctx, prisma)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Source lab stock not found')
  })

  // TC-18: transaction rollback on failure
  it('TC-18: wraps operations in a transaction (rollback if Prisma throws)', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValueOnce(new Error('DB connection lost')),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await transferHandler(payload, ctx, prisma)

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB connection lost')
  })
})

// ============================================================================
// TC-11 … TC-13 — updateInventoryHandler
// ============================================================================

describe('updateInventoryHandler', () => {
  const ctx: import('../services/workflow-engine').WorkflowContext = {
    workflowId: 'wf-1',
    stepId: 'step-2',
  }

  // TC-11: success — positive delta
  it('TC-11: adds positive delta to existing stock', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: 'lab-1', materialId: 'mat-1', quantity: dec(50) }),
        update: jest.fn().mockResolvedValueOnce({ quantity: dec(80) }),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await updateInventoryHandler(
      { labId: 'lab-1', materialId: 'mat-1', quantity: 30, reason: 'Restock' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(true)
    expect(result.result?.reason).toBe('Restock')
    expect(txMock.labStock.update).toHaveBeenCalledTimes(1)
  })

  // TC-12: material not found
  it('TC-12: returns error when material is not found in lab stock', async () => {
    const txMock = {
      labStock: {
        findUnique: jest.fn().mockResolvedValueOnce(null),
        update: jest.fn(),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await updateInventoryHandler(
      { labId: 'lab-1', materialId: 'mat-missing', quantity: 10, reason: 'Adjustment' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Material not found in lab stock')
    expect(txMock.labStock.update).not.toHaveBeenCalled()
  })

  // TC-13: negative delta (decrement)
  it('TC-13: applies negative delta (stock decrement)', async () => {
    const txMock = {
      labStock: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ labId: 'lab-1', materialId: 'mat-1', quantity: dec(100) }),
        update: jest.fn().mockResolvedValueOnce({ quantity: dec(60) }),
      },
    }

    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    } as unknown as import('@prisma/client').PrismaClient

    const result = await updateInventoryHandler(
      { labId: 'lab-1', materialId: 'mat-1', quantity: -40, reason: 'Spoilage' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(true)
    expect(result.result?.reason).toBe('Spoilage')
    // The update should have been called with a Decimal of 60 (100 + -40)
    const callArgs = txMock.labStock.update.mock.calls[0][0] as {
      data: { quantity: Decimal }
    }
    expect(callArgs.data.quantity.toNumber()).toBe(60)
  })
})

// ============================================================================
// TC-14 … TC-15 — notifyHandler
// ============================================================================

describe('notifyHandler', () => {
  const ctx: import('../services/workflow-engine').WorkflowContext = {
    workflowId: 'wf-1',
    stepId: 'step-3',
  }
  const prisma = {} as import('@prisma/client').PrismaClient

  // TC-14: success
  it('TC-14: returns notifiedChannels list on success', async () => {
    const result = await notifyHandler(
      { message: 'Stock critical', channels: ['slack', 'email', 'dashboard'] },
      ctx,
      prisma,
    )

    expect(result.success).toBe(true)
    expect(Array.isArray(result.result?.notifiedChannels)).toBe(true)
    expect(result.result?.notifiedChannels).toEqual(['slack', 'email', 'dashboard'])
    expect(typeof result.result?.timestamp).toBe('string')
  })

  // TC-15: empty channels
  it('TC-15: returns error when channels array is empty', async () => {
    const result = await notifyHandler(
      { message: 'Stock critical', channels: [] },
      ctx,
      prisma,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('No valid channels provided')
  })

  it('TC-15b: returns error when channels is not an array', async () => {
    const result = await notifyHandler(
      { message: 'Stock critical', channels: 'slack' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('No valid channels provided')
  })

  it('filters out empty-string channel entries', async () => {
    const result = await notifyHandler(
      { message: 'Alert', channels: ['slack', '', '   '] },
      ctx,
      prisma,
    )
    // '' and '   ' are invalid; 'slack' is valid — at least one valid channel
    expect(result.success).toBe(true)
    expect(result.result?.notifiedChannels).toEqual(['slack'])
  })
})

// ============================================================================
// TC-16 … TC-17 — emailHandler
// ============================================================================

describe('emailHandler', () => {
  const ctx: import('../services/workflow-engine').WorkflowContext = {
    workflowId: 'wf-1',
    stepId: 'step-4',
  }
  const prisma = {} as import('@prisma/client').PrismaClient

  // TC-16: success
  it('TC-16: returns sentAt and messageId on success', async () => {
    const result = await emailHandler(
      { to: 'admin@maison-doree.ma', subject: 'Low stock alert', body: 'Lab stock is low.' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(true)
    expect(result.result?.to).toBe('admin@maison-doree.ma')
    expect(result.result?.subject).toBe('Low stock alert')
    expect(typeof result.result?.sentAt).toBe('string')
    expect(typeof result.result?.messageId).toBe('string')
  })

  // TC-17: invalid email
  it('TC-17: returns error for invalid email address', async () => {
    const result = await emailHandler(
      { to: 'not-an-email', subject: 'Test', body: 'Body.' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid email address')
  })

  it('TC-17b: returns error when to field is missing', async () => {
    const result = await emailHandler(
      { to: '', subject: 'Test', body: 'Body.' },
      ctx,
      prisma,
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid email address')
  })
})

// ============================================================================
// TC-01, TC-02, TC-03, TC-19, TC-20, TC-21, TC-22 — WorkflowExecutor
// ============================================================================

describe('WorkflowExecutor', () => {
  const executor = new WorkflowExecutor()

  /** Minimal workflow fixture factory. */
  function makeWorkflow(
    steps: ReturnType<typeof makeStep>[],
    isActive = true,
  ) {
    return { id: 'wf-1', isActive, steps }
  }

  // TC-20: workflow not found
  it('TC-20: returns FAILED when workflow is not found', async () => {
    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(null) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    const result = await executor.executeWorkflow('wf-missing', prisma)

    expect(result.status).toBe('FAILED')
    expect(result.stepsExecuted).toBe(0)
    expect(result.actions[0].error).toMatch(/not found/)
  })

  // TC-21: inactive workflow
  it('TC-21: returns FAILED when workflow is inactive', async () => {
    const prisma = {
      workflow: {
        findUnique: jest.fn().mockResolvedValue(makeWorkflow([], false)),
      },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    const result = await executor.executeWorkflow('wf-1', prisma)

    expect(result.status).toBe('FAILED')
    expect(result.actions[0].error).toContain('inactive')
  })

  // TC-01: ACTION-only workflow — success
  it('TC-01: executes an ACTION-only workflow and returns COMPLETED', async () => {
    const step = makeStep('step-1', 1, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'Hello', channels: ['slack'] },
    })
    const wf = makeWorkflow([step])

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    const result = await executor.executeWorkflow('wf-1', prisma)

    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(1)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].status).toBe('COMPLETED')
  })

  // TC-22: unknown action handler
  it('TC-22: marks step FAILED and returns FAILED for unknown action handler', async () => {
    const step = makeStep('step-1', 1, 'ACTION', {
      actionType: 'UNKNOWN_HANDLER',
      actionPayload: {},
    })
    const wf = makeWorkflow([step])

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    const result = await executor.executeWorkflow('wf-1', prisma)

    expect(result.status).toBe('FAILED')
    expect(result.actions[0].status).toBe('FAILED')
    expect(result.actions[0].error).toContain('UNKNOWN_HANDLER')
  })

  // TC-02: CONDITION step passes → execution continues
  it('TC-02: continues execution when CONDITION step passes', async () => {
    const conditionStep = makeStep('step-1', 1, 'CONDITION', {
      conditions: [{ field: 'quantity', operator: 'LESS_THAN', value: '100' }],
    })
    const actionStep = makeStep('step-2', 2, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'Restock', channels: ['email'] },
    })
    const wf = makeWorkflow([conditionStep, actionStep])

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    // triggerData has quantity = 50, which is < 100 → condition passes
    const result = await executor.executeWorkflow('wf-1', prisma, { quantity: 50 })

    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(2)
    // The ACTION step should have been executed (COMPLETED entry in actions)
    const actionResult = result.actions.find((a) => a.stepId === 'step-2')
    expect(actionResult?.status).toBe('COMPLETED')
  })

  // TC-03: CONDITION step fails → subsequent ACTION steps are skipped
  it('TC-03: skips subsequent ACTION steps when CONDITION step fails', async () => {
    const conditionStep = makeStep('step-1', 1, 'CONDITION', {
      conditions: [{ field: 'quantity', operator: 'LESS_THAN', value: '10' }],
    })
    const actionStep = makeStep('step-2', 2, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'Critical', channels: ['slack'] },
    })
    const wf = makeWorkflow([conditionStep, actionStep])

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    // quantity = 200, which is NOT < 10 → condition fails → action skipped
    const result = await executor.executeWorkflow('wf-1', prisma, { quantity: 200 })

    expect(result.status).toBe('COMPLETED') // overall still COMPLETED (no failure)
    expect(result.stepsExecuted).toBe(2)
    // ACTION step should not appear in actions (it was skipped before any audit write)
    const actionResult = result.actions.find((a) => a.stepId === 'step-2')
    expect(actionResult).toBeUndefined()
  })

  // TC-19: mixed CONDITION + ACTION workflow
  it('TC-19: mixed workflow — condition gates action correctly', async () => {
    const cond1 = makeStep('cond-1', 1, 'CONDITION', {
      conditions: [{ field: 'status', operator: 'EQUALS', value: 'LOW' }],
    })
    const action1 = makeStep('action-1', 2, 'ACTION', {
      actionType: 'EMAIL',
      actionPayload: { to: 'mgr@lab.com', subject: 'Low Stock', body: 'Stock is low.' },
    })
    const action2 = makeStep('action-2', 3, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'Alert sent', channels: ['dashboard'] },
    })
    const wf = makeWorkflow([cond1, action1, action2])

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as import('@prisma/client').PrismaClient

    // condition passes (status === 'LOW') → both actions should execute
    const result = await executor.executeWorkflow('wf-1', prisma, { status: 'LOW' })

    expect(result.status).toBe('COMPLETED')
    expect(result.stepsExecuted).toBe(3)
    const completedActions = result.actions.filter((a) => a.status === 'COMPLETED')
    expect(completedActions).toHaveLength(2)
  })

  it('writes WorkflowAction audit rows for executed ACTION steps', async () => {
    const step = makeStep('step-1', 1, 'ACTION', {
      actionType: 'NOTIFY',
      actionPayload: { message: 'Audit test', channels: ['slack'] },
    })
    const wf = makeWorkflow([step])

    const createMock = jest.fn().mockResolvedValue({ id: 'audit-1' })
    const updateMock = jest.fn().mockResolvedValue({})

    const prisma = {
      workflow: { findUnique: jest.fn().mockResolvedValue(wf) },
      workflowAction: { create: createMock, update: updateMock },
    } as unknown as import('@prisma/client').PrismaClient

    await executor.executeWorkflow('wf-1', prisma)

    // create called once (IN_PROGRESS entry), update called once (COMPLETED)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(updateMock).toHaveBeenCalledTimes(1)
    const createCall = createMock.mock.calls[0][0] as { data: { status: string } }
    expect(createCall.data.status).toBe('IN_PROGRESS')
    const updateCall = updateMock.mock.calls[0][0] as { data: { status: string } }
    expect(updateCall.data.status).toBe('COMPLETED')
  })
})

// ============================================================================
// Error class tests
// ============================================================================

describe('WorkflowEngineError', () => {
  it('sets name and code correctly', () => {
    const err = new WorkflowEngineError('TEST_CODE', 'test message')
    expect(err.name).toBe('WorkflowEngineError')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err instanceof Error).toBe(true)
  })
})

describe('ConditionEvaluationError', () => {
  it('inherits from WorkflowEngineError with correct code', () => {
    const err = new ConditionEvaluationError('bad operator')
    expect(err.name).toBe('ConditionEvaluationError')
    expect(err.code).toBe('CONDITION_EVALUATION_ERROR')
    expect(err instanceof WorkflowEngineError).toBe(true)
  })
})
