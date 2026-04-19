/**
 * Unit tests for lib/validators-workflow.ts
 *
 * Coverage targets:
 *   - All 4 enum schemas: valid values accepted, invalid values rejected
 *   - WorkflowActionTypeSchema: valid action handler types
 *   - CreateWorkflowSchema: required fields, optional fields, defaults
 *   - UpdateWorkflowSchema: all fields optional, constraints still enforced
 *   - WorkflowFiltersSchema: pagination defaults, valid filters, edge cases
 *   - WorkflowStepPayloadSchema: each actionType variant, invalid payloads
 *   - CreateWorkflowStepSchema: ACTION cross-field requirements, CONDITION rules
 *   - UpdateWorkflowStepSchema: all fields optional
 *   - CreateWorkflowConditionSchema: all operators, field/value bounds
 *   - UpdateWorkflowConditionSchema: all fields optional
 *   - CreateWorkflowActionSchema: status defaults, CUID validation
 *   - UpdateWorkflowActionSchema: status transitions, ISO date, flexible result
 */

import {
  // Enum schemas
  WorkflowTriggerTypeSchema,
  WorkflowStepTypeSchema,
  WorkflowConditionOperatorSchema,
  WorkflowActionStatusSchema,
  WorkflowActionTypeSchema,
  // Workflow CRUD
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  WorkflowFiltersSchema,
  // Workflow step payload
  WorkflowStepPayloadSchema,
  TransferPayloadSchema,
  UpdateInventoryPayloadSchema,
  NotifyPayloadSchema,
  EmailPayloadSchema,
  // Workflow step CRUD
  CreateWorkflowStepSchema,
  UpdateWorkflowStepSchema,
  // Workflow condition CRUD
  CreateWorkflowConditionSchema,
  UpdateWorkflowConditionSchema,
  // Workflow action CRUD
  CreateWorkflowActionSchema,
  UpdateWorkflowActionSchema,
} from '../validators-workflow'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid CUID-shaped string for use in test fixtures. */
const CUID  = 'clh3v2y0k0000356pk1b6vxxt'
const CUID2 = 'clh3v2y0k0001356pk1b6vxxt'
const CUID3 = 'clh3v2y0k0002356pk1b6vxxt'

// ---------------------------------------------------------------------------
// WorkflowTriggerTypeSchema
// ---------------------------------------------------------------------------

describe('WorkflowTriggerTypeSchema', () => {
  const valid = ['MANUAL', 'SCHEDULED', 'EVENT_BASED']

  it.each(valid)('accepts %s', (value) => {
    expect(WorkflowTriggerTypeSchema.parse(value)).toBe(value)
  })

  it('rejects an unknown trigger type', () => {
    expect(() => WorkflowTriggerTypeSchema.parse('ON_DEMAND')).toThrow()
  })

  it('rejects lowercase variant', () => {
    expect(() => WorkflowTriggerTypeSchema.parse('manual')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowStepTypeSchema
// ---------------------------------------------------------------------------

describe('WorkflowStepTypeSchema', () => {
  it('accepts ACTION', () => {
    expect(WorkflowStepTypeSchema.parse('ACTION')).toBe('ACTION')
  })

  it('accepts CONDITION', () => {
    expect(WorkflowStepTypeSchema.parse('CONDITION')).toBe('CONDITION')
  })

  it('rejects an unknown step type', () => {
    expect(() => WorkflowStepTypeSchema.parse('LOOP')).toThrow()
  })

  it('rejects lowercase variant', () => {
    expect(() => WorkflowStepTypeSchema.parse('action')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowConditionOperatorSchema
// ---------------------------------------------------------------------------

describe('WorkflowConditionOperatorSchema', () => {
  const valid = ['EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS']

  it.each(valid)('accepts %s', (op) => {
    expect(WorkflowConditionOperatorSchema.parse(op)).toBe(op)
  })

  it('rejects STARTS_WITH (not in enum)', () => {
    expect(() => WorkflowConditionOperatorSchema.parse('STARTS_WITH')).toThrow()
  })

  it('rejects NOT_EQUALS (not in enum)', () => {
    expect(() => WorkflowConditionOperatorSchema.parse('NOT_EQUALS')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowActionStatusSchema
// ---------------------------------------------------------------------------

describe('WorkflowActionStatusSchema', () => {
  const valid = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']

  it.each(valid)('accepts %s', (status) => {
    expect(WorkflowActionStatusSchema.parse(status)).toBe(status)
  })

  it('rejects CANCELLED (not in enum)', () => {
    expect(() => WorkflowActionStatusSchema.parse('CANCELLED')).toThrow()
  })

  it('rejects lowercase variant', () => {
    expect(() => WorkflowActionStatusSchema.parse('pending')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowActionTypeSchema
// ---------------------------------------------------------------------------

describe('WorkflowActionTypeSchema', () => {
  const valid = ['TRANSFER', 'UPDATE_INVENTORY', 'NOTIFY', 'EMAIL']

  it.each(valid)('accepts %s', (type) => {
    expect(WorkflowActionTypeSchema.parse(type)).toBe(type)
  })

  it('rejects an unknown action type', () => {
    expect(() => WorkflowActionTypeSchema.parse('ARCHIVE')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateWorkflowSchema
// ---------------------------------------------------------------------------

describe('CreateWorkflowSchema', () => {
  // Test case 1: Valid — all fields provided
  it('parses a valid payload with all fields', () => {
    const result = CreateWorkflowSchema.parse({
      name: 'Restock Alert',
      description: 'Triggers when lab stock falls below threshold.',
      isActive: true,
      triggerType: 'EVENT_BASED',
    })
    expect(result.name).toBe('Restock Alert')
    expect(result.description).toBe('Triggers when lab stock falls below threshold.')
    expect(result.isActive).toBe(true)
    expect(result.triggerType).toBe('EVENT_BASED')
  })

  // Test case 2: Valid — minimal (name only; defaults apply)
  it('parses a minimal payload — name only — and applies defaults', () => {
    const result = CreateWorkflowSchema.parse({ name: 'Daily Report' })
    expect(result.name).toBe('Daily Report')
    expect(result.description).toBeUndefined()
    expect(result.isActive).toBe(true)         // default
    expect(result.triggerType).toBe('MANUAL')  // default
  })

  // Test case 3: Invalid — name exceeds 200 characters
  it('rejects name exceeding 200 characters', () => {
    expect(() =>
      CreateWorkflowSchema.parse({ name: 'w'.repeat(201) }),
    ).toThrow()
  })

  // Test case 4: Invalid — name is an empty string
  it('rejects an empty name string', () => {
    expect(() => CreateWorkflowSchema.parse({ name: '' })).toThrow()
  })

  // Test case 5: Invalid — description exceeds 500 characters
  it('rejects description exceeding 500 characters', () => {
    expect(() =>
      CreateWorkflowSchema.parse({ name: 'Test', description: 'd'.repeat(501) }),
    ).toThrow()
  })

  it('accepts description exactly at 500-character boundary', () => {
    const result = CreateWorkflowSchema.parse({
      name: 'Test',
      description: 'd'.repeat(500),
    })
    expect(result.description).toHaveLength(500)
  })

  it('rejects an unknown triggerType', () => {
    expect(() =>
      CreateWorkflowSchema.parse({ name: 'Test', triggerType: 'ON_DEMAND' }),
    ).toThrow()
  })

  it('rejects a missing name', () => {
    expect(() => CreateWorkflowSchema.parse({})).toThrow()
  })

  it('accepts isActive: false explicitly', () => {
    const result = CreateWorkflowSchema.parse({ name: 'Disabled Workflow', isActive: false })
    expect(result.isActive).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// UpdateWorkflowSchema
// ---------------------------------------------------------------------------

describe('UpdateWorkflowSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateWorkflowSchema.parse({})).toEqual({})
  })

  it('parses a name-only update', () => {
    const result = UpdateWorkflowSchema.parse({ name: 'Renamed Workflow' })
    expect(result.name).toBe('Renamed Workflow')
    expect(result.triggerType).toBeUndefined()
  })

  it('parses a triggerType-only update', () => {
    const result = UpdateWorkflowSchema.parse({ triggerType: 'SCHEDULED' })
    expect(result.triggerType).toBe('SCHEDULED')
  })

  it('parses isActive toggle', () => {
    const result = UpdateWorkflowSchema.parse({ isActive: false })
    expect(result.isActive).toBe(false)
  })

  it('rejects an empty name string when provided', () => {
    expect(() => UpdateWorkflowSchema.parse({ name: '' })).toThrow()
  })

  it('rejects name exceeding 200 characters when provided', () => {
    expect(() => UpdateWorkflowSchema.parse({ name: 'x'.repeat(201) })).toThrow()
  })

  it('rejects an invalid triggerType when provided', () => {
    expect(() => UpdateWorkflowSchema.parse({ triggerType: 'BATCH_BASED' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowFiltersSchema
// ---------------------------------------------------------------------------

describe('WorkflowFiltersSchema', () => {
  // Test case 6: Pagination defaults
  it('applies defaults when no query params are provided', () => {
    const result = WorkflowFiltersSchema.parse({})
    expect(result.page).toBe(0)
    expect(result.limit).toBe(50)
    expect(result.isActive).toBeUndefined()
    expect(result.triggerType).toBeUndefined()
    expect(result.createdBy).toBeUndefined()
  })

  it('parses all optional filters together', () => {
    const result = WorkflowFiltersSchema.parse({
      isActive: true,
      triggerType: 'SCHEDULED',
      createdBy: 'user-abc-123',
      page: 2,
      limit: 25,
    })
    expect(result.isActive).toBe(true)
    expect(result.triggerType).toBe('SCHEDULED')
    expect(result.createdBy).toBe('user-abc-123')
    expect(result.page).toBe(2)
    expect(result.limit).toBe(25)
  })

  it('rejects limit above maximum (100)', () => {
    expect(() => WorkflowFiltersSchema.parse({ limit: 101 })).toThrow()
  })

  it('rejects limit of zero', () => {
    expect(() => WorkflowFiltersSchema.parse({ limit: 0 })).toThrow()
  })

  it('rejects a negative page number', () => {
    expect(() => WorkflowFiltersSchema.parse({ page: -1 })).toThrow()
  })

  it('accepts page 0 (first page)', () => {
    const result = WorkflowFiltersSchema.parse({ page: 0 })
    expect(result.page).toBe(0)
  })

  it('accepts limit exactly at maximum (100)', () => {
    const result = WorkflowFiltersSchema.parse({ limit: 100 })
    expect(result.limit).toBe(100)
  })

  it('rejects a non-integer limit', () => {
    expect(() => WorkflowFiltersSchema.parse({ limit: 10.5 })).toThrow()
  })

  it('rejects an invalid triggerType filter', () => {
    expect(() => WorkflowFiltersSchema.parse({ triggerType: 'UNKNOWN' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// WorkflowStepPayloadSchema (discriminated union)
// ---------------------------------------------------------------------------

describe('WorkflowStepPayloadSchema', () => {
  // Test case 7: Valid TRANSFER payload
  it('parses a valid TRANSFER payload', () => {
    const result = WorkflowStepPayloadSchema.parse({
      actionType: 'TRANSFER',
      actionPayload: {
        sourceLabId: CUID,
        destLabId: CUID2,
        materialId: CUID3,
        quantity: 50,
      },
    })
    expect(result.actionType).toBe('TRANSFER')
    if (result.actionType === 'TRANSFER') {
      expect(result.actionPayload.quantity).toBe(50)
    }
  })

  it('rejects TRANSFER with zero quantity', () => {
    expect(() =>
      WorkflowStepPayloadSchema.parse({
        actionType: 'TRANSFER',
        actionPayload: { sourceLabId: CUID, destLabId: CUID2, materialId: CUID3, quantity: 0 },
      }),
    ).toThrow()
  })

  it('parses a valid UPDATE_INVENTORY payload (negative quantity allowed)', () => {
    const result = WorkflowStepPayloadSchema.parse({
      actionType: 'UPDATE_INVENTORY',
      actionPayload: {
        labId: CUID,
        materialId: CUID2,
        quantity: -20,
        reason: 'Spoilage adjustment',
      },
    })
    expect(result.actionType).toBe('UPDATE_INVENTORY')
    if (result.actionType === 'UPDATE_INVENTORY') {
      expect(result.actionPayload.quantity).toBe(-20)
    }
  })

  it('parses a valid NOTIFY payload', () => {
    const result = WorkflowStepPayloadSchema.parse({
      actionType: 'NOTIFY',
      actionPayload: {
        message: 'Stock level critical.',
        channels: ['slack', 'dashboard'],
      },
    })
    expect(result.actionType).toBe('NOTIFY')
    if (result.actionType === 'NOTIFY') {
      expect(result.actionPayload.channels).toHaveLength(2)
    }
  })

  it('rejects NOTIFY with empty channels array', () => {
    expect(() =>
      WorkflowStepPayloadSchema.parse({
        actionType: 'NOTIFY',
        actionPayload: { message: 'Test', channels: [] },
      }),
    ).toThrow()
  })

  it('parses a valid EMAIL payload', () => {
    const result = WorkflowStepPayloadSchema.parse({
      actionType: 'EMAIL',
      actionPayload: {
        to: 'admin@maison-doree.ma',
        subject: 'Low stock alert',
        body: 'Lab Préparation stock for Farine de blé is critically low.',
      },
    })
    expect(result.actionType).toBe('EMAIL')
    if (result.actionType === 'EMAIL') {
      expect(result.actionPayload.to).toBe('admin@maison-doree.ma')
    }
  })

  it('rejects EMAIL with an invalid email address', () => {
    expect(() =>
      WorkflowStepPayloadSchema.parse({
        actionType: 'EMAIL',
        actionPayload: { to: 'not-an-email', subject: 'Test', body: 'Body text.' },
      }),
    ).toThrow()
  })

  it('rejects an unknown actionType discriminant', () => {
    expect(() =>
      WorkflowStepPayloadSchema.parse({
        actionType: 'ARCHIVE',
        actionPayload: { something: true },
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Individual payload schemas (direct coverage)
// ---------------------------------------------------------------------------

describe('TransferPayloadSchema', () => {
  it('rejects when sourceLabId is not a CUID', () => {
    expect(() =>
      TransferPayloadSchema.parse({
        sourceLabId: 'bad-id',
        destLabId: CUID2,
        materialId: CUID3,
        quantity: 10,
      }),
    ).toThrow()
  })
})

describe('NotifyPayloadSchema', () => {
  it('rejects message exceeding 500 characters', () => {
    expect(() =>
      NotifyPayloadSchema.parse({ message: 'm'.repeat(501), channels: ['email'] }),
    ).toThrow()
  })
})

describe('EmailPayloadSchema', () => {
  it('rejects body exceeding 2000 characters', () => {
    expect(() =>
      EmailPayloadSchema.parse({
        to: 'test@example.com',
        subject: 'Test',
        body: 'b'.repeat(2001),
      }),
    ).toThrow()
  })
})

describe('UpdateInventoryPayloadSchema', () => {
  it('rejects non-finite quantity (Infinity)', () => {
    expect(() =>
      UpdateInventoryPayloadSchema.parse({
        labId: CUID,
        materialId: CUID2,
        quantity: Infinity,
        reason: 'Test',
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateWorkflowStepSchema
// ---------------------------------------------------------------------------

describe('CreateWorkflowStepSchema', () => {
  const baseAction = {
    workflowId: CUID,
    stepNumber: 1,
    type: 'ACTION' as const,
    actionType: 'TRANSFER',
    actionPayload: {
      sourceLabId: CUID,
      destLabId: CUID2,
      materialId: CUID3,
      quantity: 100,
    },
  }

  const baseCondition = {
    workflowId: CUID,
    stepNumber: 2,
    type: 'CONDITION' as const,
  }

  // Test case 8: Valid — ACTION step with TRANSFER payload
  it('parses a valid ACTION step with a TRANSFER payload', () => {
    const result = CreateWorkflowStepSchema.parse(baseAction)
    expect(result.type).toBe('ACTION')
    expect(result.actionType).toBe('TRANSFER')
    expect(result.actionPayload).toBeDefined()
  })

  // Test case 9: Valid — CONDITION step (no actionType / actionPayload)
  it('parses a valid CONDITION step with no actionType or actionPayload', () => {
    const result = CreateWorkflowStepSchema.parse(baseCondition)
    expect(result.type).toBe('CONDITION')
    expect(result.actionType).toBeUndefined()
    expect(result.actionPayload).toBeUndefined()
  })

  // Test case 10: Invalid — ACTION step missing actionType
  it('rejects an ACTION step where actionType is missing', () => {
    const { actionType: _omit, ...withoutType } = baseAction as Record<string, unknown>
    expect(() => CreateWorkflowStepSchema.parse(withoutType)).toThrow()
  })

  it('rejects an ACTION step where actionPayload is missing', () => {
    const { actionPayload: _omit, ...withoutPayload } = baseAction as Record<string, unknown>
    expect(() => CreateWorkflowStepSchema.parse(withoutPayload)).toThrow()
  })

  it('rejects a CONDITION step that includes an actionType', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({ ...baseCondition, actionType: 'NOTIFY' }),
    ).toThrow()
  })

  it('rejects a CONDITION step that includes an actionPayload', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({
        ...baseCondition,
        actionPayload: { message: 'x', channels: ['email'] },
      }),
    ).toThrow()
  })

  it('rejects when workflowId is not a CUID', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({ ...baseAction, workflowId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects stepNumber of zero', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({ ...baseAction, stepNumber: 0 }),
    ).toThrow()
  })

  it('rejects a negative stepNumber', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({ ...baseAction, stepNumber: -1 }),
    ).toThrow()
  })

  it('rejects a non-integer stepNumber', () => {
    expect(() =>
      CreateWorkflowStepSchema.parse({ ...baseAction, stepNumber: 1.5 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateWorkflowStepSchema
// ---------------------------------------------------------------------------

describe('UpdateWorkflowStepSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateWorkflowStepSchema.parse({})).toEqual({})
  })

  it('parses a stepNumber-only update', () => {
    const result = UpdateWorkflowStepSchema.parse({ stepNumber: 3 })
    expect(result.stepNumber).toBe(3)
  })

  it('parses updating actionType and actionPayload together', () => {
    const result = UpdateWorkflowStepSchema.parse({
      actionType: 'EMAIL',
      actionPayload: { to: 'admin@example.com', subject: 'Alert', body: 'Details.' },
    })
    expect(result.actionType).toBe('EMAIL')
    expect(result.actionPayload).toBeDefined()
  })

  it('rejects a blank actionType string when provided', () => {
    expect(() => UpdateWorkflowStepSchema.parse({ actionType: '' })).toThrow()
  })

  it('rejects an invalid step type when provided', () => {
    expect(() => UpdateWorkflowStepSchema.parse({ type: 'LOOP' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateWorkflowConditionSchema
// ---------------------------------------------------------------------------

describe('CreateWorkflowConditionSchema', () => {
  const base = {
    stepId: CUID,
    field: 'labStock.quantity',
    operator: 'LESS_THAN' as const,
    value: '50',
  }

  // Test case 11: Valid — all four operators accepted
  it.each(['EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS'])(
    'accepts operator %s',
    (operator) => {
      const result = CreateWorkflowConditionSchema.parse({ ...base, operator })
      expect(result.operator).toBe(operator)
    },
  )

  it('parses a complete valid payload', () => {
    const result = CreateWorkflowConditionSchema.parse(base)
    expect(result.stepId).toBe(CUID)
    expect(result.field).toBe('labStock.quantity')
    expect(result.operator).toBe('LESS_THAN')
    expect(result.value).toBe('50')
  })

  it('rejects an unknown operator', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, operator: 'STARTS_WITH' }),
    ).toThrow()
  })

  it('rejects an empty field path', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, field: '' }),
    ).toThrow()
  })

  it('rejects field path exceeding 100 characters', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, field: 'f'.repeat(101) }),
    ).toThrow()
  })

  it('rejects an empty value string', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, value: '' }),
    ).toThrow()
  })

  it('rejects value exceeding 500 characters', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, value: 'v'.repeat(501) }),
    ).toThrow()
  })

  it('rejects when stepId is not a CUID', () => {
    expect(() =>
      CreateWorkflowConditionSchema.parse({ ...base, stepId: 'bad-id' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateWorkflowConditionSchema
// ---------------------------------------------------------------------------

describe('UpdateWorkflowConditionSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateWorkflowConditionSchema.parse({})).toEqual({})
  })

  it('parses an operator-only update', () => {
    const result = UpdateWorkflowConditionSchema.parse({ operator: 'GREATER_THAN' })
    expect(result.operator).toBe('GREATER_THAN')
  })

  it('parses updating operator and value together', () => {
    const result = UpdateWorkflowConditionSchema.parse({
      operator: 'CONTAINS',
      value: 'flour',
    })
    expect(result.operator).toBe('CONTAINS')
    expect(result.value).toBe('flour')
  })

  it('rejects an empty value string when provided', () => {
    expect(() => UpdateWorkflowConditionSchema.parse({ value: '' })).toThrow()
  })

  it('rejects an invalid operator when provided', () => {
    expect(() =>
      UpdateWorkflowConditionSchema.parse({ operator: 'NOT_EQUALS' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateWorkflowActionSchema
// ---------------------------------------------------------------------------

describe('CreateWorkflowActionSchema', () => {
  const base = { workflowId: CUID, stepId: CUID2 }

  it('parses a minimal payload and defaults status to PENDING', () => {
    const result = CreateWorkflowActionSchema.parse(base)
    expect(result.workflowId).toBe(CUID)
    expect(result.stepId).toBe(CUID2)
    expect(result.status).toBe('PENDING')
  })

  it('parses an explicit IN_PROGRESS status on creation', () => {
    const result = CreateWorkflowActionSchema.parse({ ...base, status: 'IN_PROGRESS' })
    expect(result.status).toBe('IN_PROGRESS')
  })

  it('rejects an unknown status', () => {
    expect(() =>
      CreateWorkflowActionSchema.parse({ ...base, status: 'RUNNING' }),
    ).toThrow()
  })

  it('rejects when workflowId is not a CUID', () => {
    expect(() =>
      CreateWorkflowActionSchema.parse({ ...base, workflowId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects when stepId is not a CUID', () => {
    expect(() =>
      CreateWorkflowActionSchema.parse({ ...base, stepId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects when workflowId is missing', () => {
    const { workflowId: _omit, ...rest } = base as Record<string, unknown>
    expect(() => CreateWorkflowActionSchema.parse(rest)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateWorkflowActionSchema
// ---------------------------------------------------------------------------

describe('UpdateWorkflowActionSchema', () => {
  // Test case 12: Valid — PENDING → IN_PROGRESS transition
  it('parses a status-only update (PENDING → IN_PROGRESS)', () => {
    const result = UpdateWorkflowActionSchema.parse({ status: 'IN_PROGRESS' })
    expect(result.status).toBe('IN_PROGRESS')
  })

  it('parses marking COMPLETED with executedAt and result', () => {
    const result = UpdateWorkflowActionSchema.parse({
      status: 'COMPLETED',
      executedAt: '2026-04-19T10:30:00.000Z',
      result: { transferredQuantity: 100, sourceStock: 50, destStock: 250 },
    })
    expect(result.status).toBe('COMPLETED')
    expect(result.executedAt).toBe('2026-04-19T10:30:00.000Z')
    expect(result.result).toEqual({ transferredQuantity: 100, sourceStock: 50, destStock: 250 })
  })

  it('parses marking FAILED with an error message', () => {
    const result = UpdateWorkflowActionSchema.parse({
      status: 'FAILED',
      executedAt: '2026-04-19T10:30:05.000Z',
      errorMessage: 'Insufficient stock in source lab',
    })
    expect(result.status).toBe('FAILED')
    expect(result.errorMessage).toBe('Insufficient stock in source lab')
  })

  it('parses an empty object (all fields optional)', () => {
    expect(UpdateWorkflowActionSchema.parse({})).toEqual({})
  })

  it('rejects an invalid status value', () => {
    expect(() => UpdateWorkflowActionSchema.parse({ status: 'CANCELLED' })).toThrow()
  })

  it('rejects a non-ISO executedAt string', () => {
    expect(() =>
      UpdateWorkflowActionSchema.parse({ executedAt: 'not-a-date' }),
    ).toThrow()
  })

  it('rejects a plain date string without time component as executedAt', () => {
    // Zod .datetime() requires a full ISO 8601 datetime, not just a date.
    expect(() =>
      UpdateWorkflowActionSchema.parse({ executedAt: '2026-04-19' }),
    ).toThrow()
  })

  it('accepts a flexible result object with arbitrary keys', () => {
    const result = UpdateWorkflowActionSchema.parse({
      result: { customKey: 'customValue', nestedObj: { a: 1 }, arr: [1, 2] },
    })
    expect(result.result).toHaveProperty('customKey', 'customValue')
  })

  it('accepts an errorMessage with no other fields set', () => {
    const result = UpdateWorkflowActionSchema.parse({
      errorMessage: 'Timeout after 30 seconds',
    })
    expect(result.errorMessage).toBe('Timeout after 30 seconds')
    expect(result.status).toBeUndefined()
  })
})
