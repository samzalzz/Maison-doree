/**
 * Unit tests for lib/validators-qm.ts
 *
 * Coverage targets:
 *   - Zod schema: valid inputs parse without error
 *   - Zod schema: invalid inputs produce the expected ZodError paths
 *   - validateInspectionTransition: every allowed and blocked transition
 *   - validateInspectionContext: every inspection type with valid and invalid combinations
 */

import {
  CreateQualityInspectionSchema,
  UpdateQualityInspectionSchema,
  QualityInspectionFiltersSchema,
  CreateInspectionCheckpointSchema,
  UpdateInspectionCheckpointSchema,
  validateInspectionTransition,
  validateInspectionContext,
  InspectionTypeSchema,
  InspectionStatusSchema,
} from '../validators-qm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid CUID-shaped string for use in test fixtures. */
const CUID = 'clh3v2y0k0000356pk1b6vxxt'
const CUID2 = 'clh3v2y0k0001356pk1b6vxxt'
const CUID3 = 'clh3v2y0k0002356pk1b6vxxt'

// ---------------------------------------------------------------------------
// InspectionTypeSchema
// ---------------------------------------------------------------------------

describe('InspectionTypeSchema', () => {
  it('accepts INCOMING', () => {
    expect(InspectionTypeSchema.parse('INCOMING')).toBe('INCOMING')
  })

  it('accepts IN_PROCESS', () => {
    expect(InspectionTypeSchema.parse('IN_PROCESS')).toBe('IN_PROCESS')
  })

  it('accepts FINAL', () => {
    expect(InspectionTypeSchema.parse('FINAL')).toBe('FINAL')
  })

  it('rejects an unknown value', () => {
    expect(() => InspectionTypeSchema.parse('OUTGOING')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// InspectionStatusSchema
// ---------------------------------------------------------------------------

describe('InspectionStatusSchema', () => {
  const validStatuses = ['PLANNED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL']

  it.each(validStatuses)('accepts %s', (status) => {
    expect(InspectionStatusSchema.parse(status)).toBe(status)
  })

  it('rejects an unknown value', () => {
    expect(() => InspectionStatusSchema.parse('PENDING')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateQualityInspectionSchema
// ---------------------------------------------------------------------------

describe('CreateQualityInspectionSchema', () => {
  const base = {
    inspectionType: 'INCOMING',
    materialId: CUID,
    supplierId: CUID2,
    scheduledDate: '2026-05-01T10:00:00.000Z',
  }

  it('parses a valid INCOMING payload', () => {
    const result = CreateQualityInspectionSchema.parse(base)
    expect(result.inspectionType).toBe('INCOMING')
    expect(result.materialId).toBe(CUID)
    expect(result.supplierId).toBe(CUID2)
    expect(result.scheduledDate).toBeInstanceOf(Date)
  })

  it('parses a valid IN_PROCESS payload', () => {
    const result = CreateQualityInspectionSchema.parse({
      inspectionType: 'IN_PROCESS',
      materialId: CUID,
      batchId: CUID2,
      scheduledDate: '2026-05-02T08:00:00.000Z',
    })
    expect(result.batchId).toBe(CUID2)
  })

  it('parses a valid FINAL payload with optional notes', () => {
    const result = CreateQualityInspectionSchema.parse({
      inspectionType: 'FINAL',
      materialId: CUID,
      batchId: CUID3,
      notes: 'Final product check',
      scheduledDate: new Date('2026-06-01'),
    })
    expect(result.notes).toBe('Final product check')
  })

  it('coerces a date string into a Date object', () => {
    const result = CreateQualityInspectionSchema.parse({
      ...base,
      scheduledDate: '2026-07-15',
    })
    expect(result.scheduledDate).toBeInstanceOf(Date)
  })

  it('rejects when inspectionType is missing', () => {
    const { inspectionType: _omit, ...rest } = base as Record<string, unknown>
    expect(() => CreateQualityInspectionSchema.parse(rest)).toThrow()
  })

  it('rejects when materialId is not a valid CUID', () => {
    expect(() =>
      CreateQualityInspectionSchema.parse({ ...base, materialId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects when batchId is present but not a valid CUID', () => {
    expect(() =>
      CreateQualityInspectionSchema.parse({ ...base, batchId: 'bad' }),
    ).toThrow()
  })

  it('rejects when notes exceed 500 characters', () => {
    expect(() =>
      CreateQualityInspectionSchema.parse({ ...base, notes: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('rejects when scheduledDate is an invalid date string', () => {
    expect(() =>
      CreateQualityInspectionSchema.parse({ ...base, scheduledDate: 'not-a-date' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateQualityInspectionSchema
// ---------------------------------------------------------------------------

describe('UpdateQualityInspectionSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    const result = UpdateQualityInspectionSchema.parse({})
    expect(result).toEqual({})
  })

  it('parses a partial update with status and notes', () => {
    const result = UpdateQualityInspectionSchema.parse({
      inspectionStatus: 'IN_PROGRESS',
      notes: 'Started inspection',
    })
    expect(result.inspectionStatus).toBe('IN_PROGRESS')
    expect(result.notes).toBe('Started inspection')
  })

  it('parses a completedDate as a Date', () => {
    const result = UpdateQualityInspectionSchema.parse({
      completedDate: '2026-05-10T14:00:00.000Z',
    })
    expect(result.completedDate).toBeInstanceOf(Date)
  })

  it('rejects an invalid inspectionStatus value', () => {
    expect(() =>
      UpdateQualityInspectionSchema.parse({ inspectionStatus: 'DONE' }),
    ).toThrow()
  })

  it('rejects notes longer than 500 characters', () => {
    expect(() =>
      UpdateQualityInspectionSchema.parse({ notes: 'a'.repeat(501) }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// QualityInspectionFiltersSchema
// ---------------------------------------------------------------------------

describe('QualityInspectionFiltersSchema', () => {
  it('applies default values when no fields are provided', () => {
    const result = QualityInspectionFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses all optional fields when provided', () => {
    const result = QualityInspectionFiltersSchema.parse({
      inspectionType: 'FINAL',
      inspectionStatus: 'PASSED',
      materialId: CUID,
      batchId: CUID2,
      supplierId: CUID3,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      limit: 25,
      offset: 50,
    })
    expect(result.inspectionType).toBe('FINAL')
    expect(result.inspectionStatus).toBe('PASSED')
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.toDate).toBeInstanceOf(Date)
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(50)
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      QualityInspectionFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects negative offset', () => {
    expect(() =>
      QualityInspectionFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })

  it('rejects an invalid materialId CUID', () => {
    expect(() =>
      QualityInspectionFiltersSchema.parse({ materialId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects a non-integer limit', () => {
    expect(() =>
      QualityInspectionFiltersSchema.parse({ limit: 10.5 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateInspectionCheckpointSchema
// ---------------------------------------------------------------------------

describe('CreateInspectionCheckpointSchema', () => {
  const base = {
    inspectionId: CUID,
    checkpointName: 'Appearance Check',
    passed: true,
  }

  it('parses a valid checkpoint creation payload', () => {
    const result = CreateInspectionCheckpointSchema.parse(base)
    expect(result.inspectionId).toBe(CUID)
    expect(result.checkpointName).toBe('Appearance Check')
    expect(result.passed).toBe(true)
  })

  it('parses passed=false with optional notes', () => {
    const result = CreateInspectionCheckpointSchema.parse({
      ...base,
      passed: false,
      notes: 'Colour outside specification',
    })
    expect(result.passed).toBe(false)
    expect(result.notes).toBe('Colour outside specification')
  })

  it('rejects when inspectionId is not a valid CUID', () => {
    expect(() =>
      CreateInspectionCheckpointSchema.parse({ ...base, inspectionId: 'bad' }),
    ).toThrow()
  })

  it('rejects when checkpointName is empty', () => {
    expect(() =>
      CreateInspectionCheckpointSchema.parse({ ...base, checkpointName: '' }),
    ).toThrow()
  })

  it('rejects when checkpointName exceeds 100 characters', () => {
    expect(() =>
      CreateInspectionCheckpointSchema.parse({
        ...base,
        checkpointName: 'x'.repeat(101),
      }),
    ).toThrow()
  })

  it('rejects when passed is missing', () => {
    const { passed: _omit, ...rest } = base as Record<string, unknown>
    expect(() => CreateInspectionCheckpointSchema.parse(rest)).toThrow()
  })

  it('rejects notes longer than 500 characters', () => {
    expect(() =>
      CreateInspectionCheckpointSchema.parse({ ...base, notes: 'n'.repeat(501) }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateInspectionCheckpointSchema
// ---------------------------------------------------------------------------

describe('UpdateInspectionCheckpointSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateInspectionCheckpointSchema.parse({})).toEqual({})
  })

  it('parses passed=false', () => {
    const result = UpdateInspectionCheckpointSchema.parse({ passed: false })
    expect(result.passed).toBe(false)
  })

  it('parses a notes update', () => {
    const result = UpdateInspectionCheckpointSchema.parse({
      notes: 'Corrected after re-check',
    })
    expect(result.notes).toBe('Corrected after re-check')
  })

  it('rejects notes longer than 500 characters', () => {
    expect(() =>
      UpdateInspectionCheckpointSchema.parse({ notes: 'z'.repeat(501) }),
    ).toThrow()
  })

  it('rejects a non-boolean passed value', () => {
    expect(() =>
      UpdateInspectionCheckpointSchema.parse({ passed: 'yes' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// validateInspectionTransition
// ---------------------------------------------------------------------------

describe('validateInspectionTransition', () => {
  // Allowed transitions
  it('allows PLANNED → IN_PROGRESS', () => {
    expect(validateInspectionTransition('PLANNED', 'IN_PROGRESS')).toBe(true)
  })

  it('allows IN_PROGRESS → PASSED', () => {
    expect(validateInspectionTransition('IN_PROGRESS', 'PASSED')).toBe(true)
  })

  it('allows IN_PROGRESS → FAILED', () => {
    expect(validateInspectionTransition('IN_PROGRESS', 'FAILED')).toBe(true)
  })

  it('allows IN_PROGRESS → CONDITIONAL', () => {
    expect(validateInspectionTransition('IN_PROGRESS', 'CONDITIONAL')).toBe(true)
  })

  // Blocked transitions — backwards
  it('blocks IN_PROGRESS → PLANNED (backwards)', () => {
    expect(validateInspectionTransition('IN_PROGRESS', 'PLANNED')).toBe(false)
  })

  it('blocks PASSED → IN_PROGRESS (backwards from terminal)', () => {
    expect(validateInspectionTransition('PASSED', 'IN_PROGRESS')).toBe(false)
  })

  it('blocks FAILED → IN_PROGRESS (backwards from terminal)', () => {
    expect(validateInspectionTransition('FAILED', 'IN_PROGRESS')).toBe(false)
  })

  it('blocks CONDITIONAL → IN_PROGRESS (backwards from terminal)', () => {
    expect(validateInspectionTransition('CONDITIONAL', 'IN_PROGRESS')).toBe(false)
  })

  // Self-loops
  it('blocks PLANNED → PLANNED (self-loop)', () => {
    expect(validateInspectionTransition('PLANNED', 'PLANNED')).toBe(false)
  })

  it('blocks IN_PROGRESS → IN_PROGRESS (self-loop)', () => {
    expect(validateInspectionTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false)
  })

  it('blocks PASSED → PASSED (self-loop on terminal)', () => {
    expect(validateInspectionTransition('PASSED', 'PASSED')).toBe(false)
  })

  // Skipping stages
  it('blocks PLANNED → PASSED (skipping IN_PROGRESS)', () => {
    expect(validateInspectionTransition('PLANNED', 'PASSED')).toBe(false)
  })

  it('blocks PLANNED → FAILED (skipping IN_PROGRESS)', () => {
    expect(validateInspectionTransition('PLANNED', 'FAILED')).toBe(false)
  })

  it('blocks PLANNED → CONDITIONAL (skipping IN_PROGRESS)', () => {
    expect(validateInspectionTransition('PLANNED', 'CONDITIONAL')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateInspectionContext
// ---------------------------------------------------------------------------

describe('validateInspectionContext', () => {
  // INCOMING — valid
  it('returns valid for INCOMING with materialId + supplierId', () => {
    const result = validateInspectionContext('INCOMING', CUID, undefined, CUID2)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // INCOMING — missing supplierId
  it('returns error for INCOMING without supplierId', () => {
    const result = validateInspectionContext('INCOMING', CUID)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'supplierId is required for INCOMING inspections',
    )
  })

  // INCOMING — has batchId (not allowed)
  it('returns error for INCOMING with batchId present', () => {
    const result = validateInspectionContext('INCOMING', CUID, CUID3, CUID2)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'batchId must not be provided for INCOMING inspections',
    )
  })

  // INCOMING — both batchId present and supplierId missing
  it('returns multiple errors for INCOMING with batchId and no supplierId', () => {
    const result = validateInspectionContext('INCOMING', CUID, CUID3)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  // IN_PROCESS — valid
  it('returns valid for IN_PROCESS with materialId + batchId', () => {
    const result = validateInspectionContext('IN_PROCESS', CUID, CUID2)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // IN_PROCESS — missing batchId
  it('returns error for IN_PROCESS without batchId', () => {
    const result = validateInspectionContext('IN_PROCESS', CUID)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'batchId is required for IN_PROCESS inspections',
    )
  })

  // IN_PROCESS — has supplierId (not allowed)
  it('returns error for IN_PROCESS with supplierId present', () => {
    const result = validateInspectionContext('IN_PROCESS', CUID, CUID2, CUID3)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'supplierId must not be provided for IN_PROCESS inspections',
    )
  })

  // FINAL — valid
  it('returns valid for FINAL with materialId + batchId', () => {
    const result = validateInspectionContext('FINAL', CUID, CUID2)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // FINAL — missing batchId
  it('returns error for FINAL without batchId', () => {
    const result = validateInspectionContext('FINAL', CUID)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'batchId is required for FINAL inspections',
    )
  })

  // FINAL — has supplierId (not allowed)
  it('returns error for FINAL with supplierId present', () => {
    const result = validateInspectionContext('FINAL', CUID, CUID2, CUID3)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'supplierId must not be provided for FINAL inspections',
    )
  })

  // Empty materialId
  it('returns error when materialId is an empty string', () => {
    const result = validateInspectionContext('INCOMING', '', undefined, CUID2)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'materialId is required for all inspection types',
    )
  })
})
