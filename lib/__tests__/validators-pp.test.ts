/**
 * Unit tests for lib/validators-pp.ts
 *
 * Coverage targets:
 *   - Zod schemas: valid inputs parse without error
 *   - Zod schemas: invalid inputs produce expected ZodError failures
 *   - validateMRPSuggestion: all four constraint rules + combinations
 *   - validateMaterialAllocation: positive-qty rule and stock-ceiling rule
 */

import {
  // Enum schemas
  MRPSuggestionStatusSchema,
  TraceabilityEventTypeSchema,
  // EnhancedForecast
  CreateEnhancedForecastSchema,
  UpdateEnhancedForecastSchema,
  EnhancedForecastFiltersSchema,
  // MRPSuggestion
  CreateMRPSuggestionSchema,
  UpdateMRPSuggestionSchema,
  MRPSuggestionFiltersSchema,
  // MaterialAllocation
  CreateMaterialAllocationSchema,
  UpdateMaterialAllocationSchema,
  MaterialAllocationFiltersSchema,
  // TraceabilityRecord
  CreateTraceabilityRecordSchema,
  TraceabilityRecordFiltersSchema,
  // Business logic
  validateMRPSuggestion,
  validateMaterialAllocation,
} from '../validators-pp'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid CUID-shaped string for use in test fixtures. */
const CUID  = 'clh3v2y0k0000356pk1b6vxxt'
const CUID2 = 'clh3v2y0k0001356pk1b6vxxt'
const CUID3 = 'clh3v2y0k0002356pk1b6vxxt'

// ---------------------------------------------------------------------------
// MRPSuggestionStatusSchema
// ---------------------------------------------------------------------------

describe('MRPSuggestionStatusSchema', () => {
  const validStatuses = ['PENDING', 'ORDERED', 'COMPLETED', 'DISMISSED']

  it.each(validStatuses)('accepts %s', (status) => {
    expect(MRPSuggestionStatusSchema.parse(status)).toBe(status)
  })

  it('rejects an unknown status', () => {
    expect(() => MRPSuggestionStatusSchema.parse('CANCELLED')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// TraceabilityEventTypeSchema
// ---------------------------------------------------------------------------

describe('TraceabilityEventTypeSchema', () => {
  const validEvents = [
    'MATERIAL_ALLOCATED',
    'PRODUCTION_STARTED',
    'PRODUCTION_COMPLETED',
    'SHIPPED',
    'RECALL',
  ]

  it.each(validEvents)('accepts %s', (event) => {
    expect(TraceabilityEventTypeSchema.parse(event)).toBe(event)
  })

  it('rejects an unknown event type', () => {
    expect(() => TraceabilityEventTypeSchema.parse('DISPATCHED')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateEnhancedForecastSchema
// ---------------------------------------------------------------------------

describe('CreateEnhancedForecastSchema', () => {
  const base = {
    date: '2026-05-01',
    recipeId: CUID,
    predictedQuantity: 120,
    confidence: 85,
    algorithm: 'SEASONAL',
  }

  it('parses a minimal valid payload', () => {
    const result = CreateEnhancedForecastSchema.parse(base)
    expect(result.recipeId).toBe(CUID)
    expect(result.predictedQuantity).toBe(120)
    expect(result.confidence).toBe(85)
    expect(result.algorithm).toBe('SEASONAL')
    expect(result.date).toBeInstanceOf(Date)
  })

  it('parses a fully populated payload including all optional fields', () => {
    const result = CreateEnhancedForecastSchema.parse({
      ...base,
      reasoning: 'Weekend boost expected',
      sevenDayAverage: 100.5,
      fourteenDayAverage: 98.0,
      thirtyDayAverage: 95.2,
      seasonalFactor: 1.3,
    })
    expect(result.reasoning).toBe('Weekend boost expected')
    expect(result.sevenDayAverage).toBe(100.5)
    expect(result.fourteenDayAverage).toBe(98.0)
    expect(result.thirtyDayAverage).toBe(95.2)
    expect(result.seasonalFactor).toBe(1.3)
  })

  it('coerces a date string into a Date object', () => {
    const result = CreateEnhancedForecastSchema.parse(base)
    expect(result.date).toBeInstanceOf(Date)
  })

  it('accepts confidence of exactly 0', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, confidence: 0 }),
    ).not.toThrow()
  })

  it('accepts confidence of exactly 100', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, confidence: 100 }),
    ).not.toThrow()
  })

  it('accepts seasonalFactor of exactly 0', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, seasonalFactor: 0 }),
    ).not.toThrow()
  })

  it('accepts seasonalFactor of exactly 5', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, seasonalFactor: 5 }),
    ).not.toThrow()
  })

  it('rejects when recipeId is not a valid CUID', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, recipeId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects when predictedQuantity is zero', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, predictedQuantity: 0 }),
    ).toThrow()
  })

  it('rejects when predictedQuantity is negative', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, predictedQuantity: -1 }),
    ).toThrow()
  })

  it('rejects a non-integer predictedQuantity', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, predictedQuantity: 1.5 }),
    ).toThrow()
  })

  it('rejects when confidence exceeds 100', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, confidence: 101 }),
    ).toThrow()
  })

  it('rejects when confidence is below 0', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, confidence: -1 }),
    ).toThrow()
  })

  it('rejects an empty algorithm string', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, algorithm: '' }),
    ).toThrow()
  })

  it('rejects an algorithm string exceeding 50 characters', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, algorithm: 'A'.repeat(51) }),
    ).toThrow()
  })

  it('rejects reasoning exceeding 500 characters', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, reasoning: 'r'.repeat(501) }),
    ).toThrow()
  })

  it('rejects a negative sevenDayAverage', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, sevenDayAverage: -0.1 }),
    ).toThrow()
  })

  it('rejects seasonalFactor above 5', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, seasonalFactor: 5.1 }),
    ).toThrow()
  })

  it('rejects an invalid date string', () => {
    expect(() =>
      CreateEnhancedForecastSchema.parse({ ...base, date: 'not-a-date' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateEnhancedForecastSchema
// ---------------------------------------------------------------------------

describe('UpdateEnhancedForecastSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateEnhancedForecastSchema.parse({})).toEqual({})
  })

  it('parses a partial update with predictedQuantity only', () => {
    const result = UpdateEnhancedForecastSchema.parse({ predictedQuantity: 150 })
    expect(result.predictedQuantity).toBe(150)
  })

  it('parses a partial update with all three fields', () => {
    const result = UpdateEnhancedForecastSchema.parse({
      predictedQuantity: 200,
      confidence: 90,
      reasoning: 'Adjusted after market review',
    })
    expect(result.confidence).toBe(90)
    expect(result.reasoning).toBe('Adjusted after market review')
  })

  it('rejects a non-integer predictedQuantity', () => {
    expect(() =>
      UpdateEnhancedForecastSchema.parse({ predictedQuantity: 1.5 }),
    ).toThrow()
  })

  it('rejects confidence below 0', () => {
    expect(() =>
      UpdateEnhancedForecastSchema.parse({ confidence: -1 }),
    ).toThrow()
  })

  it('rejects confidence above 100', () => {
    expect(() =>
      UpdateEnhancedForecastSchema.parse({ confidence: 101 }),
    ).toThrow()
  })

  it('rejects reasoning exceeding 500 characters', () => {
    expect(() =>
      UpdateEnhancedForecastSchema.parse({ reasoning: 'x'.repeat(501) }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// EnhancedForecastFiltersSchema
// ---------------------------------------------------------------------------

describe('EnhancedForecastFiltersSchema', () => {
  it('applies default pagination values when no fields are provided', () => {
    const result = EnhancedForecastFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses all optional fields when provided', () => {
    const result = EnhancedForecastFiltersSchema.parse({
      recipeId: CUID,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      minConfidence: 70,
      algorithm: 'SEASONAL',
      limit: 25,
      offset: 50,
    })
    expect(result.recipeId).toBe(CUID)
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.toDate).toBeInstanceOf(Date)
    expect(result.minConfidence).toBe(70)
    expect(result.algorithm).toBe('SEASONAL')
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(50)
  })

  it('rejects an invalid recipeId CUID', () => {
    expect(() =>
      EnhancedForecastFiltersSchema.parse({ recipeId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      EnhancedForecastFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects a non-integer limit', () => {
    expect(() =>
      EnhancedForecastFiltersSchema.parse({ limit: 10.5 }),
    ).toThrow()
  })

  it('rejects a negative offset', () => {
    expect(() =>
      EnhancedForecastFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })

  it('rejects minConfidence above 100', () => {
    expect(() =>
      EnhancedForecastFiltersSchema.parse({ minConfidence: 101 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateMRPSuggestionSchema
// ---------------------------------------------------------------------------

describe('CreateMRPSuggestionSchema', () => {
  const base = {
    materialId: CUID,
    currentStock: 10,
    minThreshold: 20,
    projectedUsage: 50,
    projectedDate: '2026-06-01',
    recommendedQty: 100,
  }

  it('parses a minimal valid payload', () => {
    const result = CreateMRPSuggestionSchema.parse(base)
    expect(result.materialId).toBe(CUID)
    expect(result.currentStock).toBe(10)
    expect(result.projectedDate).toBeInstanceOf(Date)
    expect(result.recommendedQty).toBe(100)
  })

  it('parses a payload with optional supplierId and maxCapacity', () => {
    const result = CreateMRPSuggestionSchema.parse({
      ...base,
      supplierId: CUID2,
      maxCapacity: 500,
    })
    expect(result.supplierId).toBe(CUID2)
    expect(result.maxCapacity).toBe(500)
  })

  it('accepts currentStock of exactly 0', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, currentStock: 0 }),
    ).not.toThrow()
  })

  it('accepts projectedUsage of exactly 0', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, projectedUsage: 0 }),
    ).not.toThrow()
  })

  it('rejects when materialId is not a valid CUID', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, materialId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects a negative currentStock', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, currentStock: -1 }),
    ).toThrow()
  })

  it('rejects a negative minThreshold', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, minThreshold: -5 }),
    ).toThrow()
  })

  it('rejects recommendedQty of zero', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, recommendedQty: 0 }),
    ).toThrow()
  })

  it('rejects a negative recommendedQty', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, recommendedQty: -10 }),
    ).toThrow()
  })

  it('rejects maxCapacity of zero', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, maxCapacity: 0 }),
    ).toThrow()
  })

  it('rejects an invalid supplierId CUID', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, supplierId: 'not-cuid' }),
    ).toThrow()
  })

  it('rejects an invalid date string for projectedDate', () => {
    expect(() =>
      CreateMRPSuggestionSchema.parse({ ...base, projectedDate: 'not-a-date' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateMRPSuggestionSchema
// ---------------------------------------------------------------------------

describe('UpdateMRPSuggestionSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateMRPSuggestionSchema.parse({})).toEqual({})
  })

  it('parses a status-only update', () => {
    const result = UpdateMRPSuggestionSchema.parse({ status: 'ORDERED' })
    expect(result.status).toBe('ORDERED')
  })

  it('parses a projectedDate update', () => {
    const result = UpdateMRPSuggestionSchema.parse({ projectedDate: '2026-07-01' })
    expect(result.projectedDate).toBeInstanceOf(Date)
  })

  it('parses a recommendedQty update', () => {
    const result = UpdateMRPSuggestionSchema.parse({ recommendedQty: 250 })
    expect(result.recommendedQty).toBe(250)
  })

  it('rejects an invalid status value', () => {
    expect(() =>
      UpdateMRPSuggestionSchema.parse({ status: 'REJECTED' }),
    ).toThrow()
  })

  it('rejects recommendedQty of zero', () => {
    expect(() =>
      UpdateMRPSuggestionSchema.parse({ recommendedQty: 0 }),
    ).toThrow()
  })

  it('rejects a negative recommendedQty', () => {
    expect(() =>
      UpdateMRPSuggestionSchema.parse({ recommendedQty: -5 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// MRPSuggestionFiltersSchema
// ---------------------------------------------------------------------------

describe('MRPSuggestionFiltersSchema', () => {
  it('applies default pagination values when no fields are provided', () => {
    const result = MRPSuggestionFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses all optional fields when provided', () => {
    const result = MRPSuggestionFiltersSchema.parse({
      materialId: CUID,
      status: 'PENDING',
      supplierId: CUID2,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      limit: 10,
      offset: 20,
    })
    expect(result.materialId).toBe(CUID)
    expect(result.status).toBe('PENDING')
    expect(result.supplierId).toBe(CUID2)
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.limit).toBe(10)
  })

  it('rejects an invalid status in filters', () => {
    expect(() =>
      MRPSuggestionFiltersSchema.parse({ status: 'UNKNOWN' }),
    ).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      MRPSuggestionFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects a negative offset', () => {
    expect(() =>
      MRPSuggestionFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })

  it('rejects an invalid materialId CUID', () => {
    expect(() =>
      MRPSuggestionFiltersSchema.parse({ materialId: 'not-cuid' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateMaterialAllocationSchema
// ---------------------------------------------------------------------------

describe('CreateMaterialAllocationSchema', () => {
  const base = {
    batchId: CUID,
    materialId: CUID2,
    allocatedQty: 25.5,
  }

  it('parses a valid payload', () => {
    const result = CreateMaterialAllocationSchema.parse(base)
    expect(result.batchId).toBe(CUID)
    expect(result.materialId).toBe(CUID2)
    expect(result.allocatedQty).toBe(25.5)
  })

  it('rejects when batchId is not a valid CUID', () => {
    expect(() =>
      CreateMaterialAllocationSchema.parse({ ...base, batchId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects when materialId is not a valid CUID', () => {
    expect(() =>
      CreateMaterialAllocationSchema.parse({ ...base, materialId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects allocatedQty of zero', () => {
    expect(() =>
      CreateMaterialAllocationSchema.parse({ ...base, allocatedQty: 0 }),
    ).toThrow()
  })

  it('rejects a negative allocatedQty', () => {
    expect(() =>
      CreateMaterialAllocationSchema.parse({ ...base, allocatedQty: -1 }),
    ).toThrow()
  })

  it('rejects when batchId is missing', () => {
    const { batchId: _omit, ...rest } = base as Record<string, unknown>
    expect(() => CreateMaterialAllocationSchema.parse(rest)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateMaterialAllocationSchema
// ---------------------------------------------------------------------------

describe('UpdateMaterialAllocationSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateMaterialAllocationSchema.parse({})).toEqual({})
  })

  it('parses actualQty of zero (material reserved but unused)', () => {
    const result = UpdateMaterialAllocationSchema.parse({ actualQty: 0 })
    expect(result.actualQty).toBe(0)
  })

  it('parses a positive actualQty', () => {
    const result = UpdateMaterialAllocationSchema.parse({ actualQty: 18.75 })
    expect(result.actualQty).toBe(18.75)
  })

  it('rejects a negative actualQty', () => {
    expect(() =>
      UpdateMaterialAllocationSchema.parse({ actualQty: -0.1 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// MaterialAllocationFiltersSchema
// ---------------------------------------------------------------------------

describe('MaterialAllocationFiltersSchema', () => {
  it('applies default pagination values when no fields are provided', () => {
    const result = MaterialAllocationFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses batchId and materialId filters', () => {
    const result = MaterialAllocationFiltersSchema.parse({
      batchId: CUID,
      materialId: CUID2,
      limit: 20,
      offset: 40,
    })
    expect(result.batchId).toBe(CUID)
    expect(result.materialId).toBe(CUID2)
    expect(result.limit).toBe(20)
    expect(result.offset).toBe(40)
  })

  it('rejects an invalid batchId CUID', () => {
    expect(() =>
      MaterialAllocationFiltersSchema.parse({ batchId: 'not-cuid' }),
    ).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      MaterialAllocationFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects a negative offset', () => {
    expect(() =>
      MaterialAllocationFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateTraceabilityRecordSchema
// ---------------------------------------------------------------------------

describe('CreateTraceabilityRecordSchema', () => {
  const base = {
    batchId: CUID,
    event: 'PRODUCTION_STARTED',
    recordedBy: 'admin-user-001',
  }

  it('parses a minimal valid payload', () => {
    const result = CreateTraceabilityRecordSchema.parse(base)
    expect(result.batchId).toBe(CUID)
    expect(result.event).toBe('PRODUCTION_STARTED')
    expect(result.recordedBy).toBe('admin-user-001')
  })

  it('parses a payload with optional location and details', () => {
    const result = CreateTraceabilityRecordSchema.parse({
      ...base,
      event: 'SHIPPED',
      location: 'Warehouse A - Bay 3',
      details: 'Shipped to central distribution centre',
    })
    expect(result.location).toBe('Warehouse A - Bay 3')
    expect(result.details).toBe('Shipped to central distribution centre')
  })

  it('parses each valid event type', () => {
    const events = [
      'MATERIAL_ALLOCATED',
      'PRODUCTION_STARTED',
      'PRODUCTION_COMPLETED',
      'SHIPPED',
      'RECALL',
    ]
    for (const event of events) {
      expect(() =>
        CreateTraceabilityRecordSchema.parse({ ...base, event }),
      ).not.toThrow()
    }
  })

  it('rejects when batchId is not a valid CUID', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({ ...base, batchId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects an unknown event type', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({ ...base, event: 'DISPATCHED' }),
    ).toThrow()
  })

  it('rejects location exceeding 100 characters', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({
        ...base,
        location: 'L'.repeat(101),
      }),
    ).toThrow()
  })

  it('rejects details exceeding 500 characters', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({
        ...base,
        details: 'd'.repeat(501),
      }),
    ).toThrow()
  })

  it('rejects an empty recordedBy string', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({ ...base, recordedBy: '' }),
    ).toThrow()
  })

  it('rejects recordedBy exceeding 100 characters', () => {
    expect(() =>
      CreateTraceabilityRecordSchema.parse({
        ...base,
        recordedBy: 'u'.repeat(101),
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// TraceabilityRecordFiltersSchema
// ---------------------------------------------------------------------------

describe('TraceabilityRecordFiltersSchema', () => {
  it('applies default pagination values when no fields are provided', () => {
    const result = TraceabilityRecordFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses all optional fields when provided', () => {
    const result = TraceabilityRecordFiltersSchema.parse({
      batchId: CUID,
      event: 'RECALL',
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      limit: 10,
      offset: 5,
    })
    expect(result.batchId).toBe(CUID)
    expect(result.event).toBe('RECALL')
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.limit).toBe(10)
  })

  it('rejects an invalid event type in filters', () => {
    expect(() =>
      TraceabilityRecordFiltersSchema.parse({ event: 'CREATED' }),
    ).toThrow()
  })

  it('rejects an invalid batchId CUID', () => {
    expect(() =>
      TraceabilityRecordFiltersSchema.parse({ batchId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      TraceabilityRecordFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects a negative offset', () => {
    expect(() =>
      TraceabilityRecordFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// validateMRPSuggestion
// ---------------------------------------------------------------------------

describe('validateMRPSuggestion', () => {
  // --------------- Rule 1: projectedUsage > currentStock -------------------

  it('returns valid when projectedUsage is clearly above currentStock', () => {
    const result = validateMRPSuggestion(10, 20, 50, 30)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error when projectedUsage equals currentStock', () => {
    const result = validateMRPSuggestion(50, 20, 50, 30)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('projectedUsage'))).toBe(true)
  })

  it('returns error when projectedUsage is less than currentStock', () => {
    const result = validateMRPSuggestion(100, 20, 40, 30)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('projectedUsage'))).toBe(true)
  })

  // --------------- Rule 2: recommendedQty >= minThreshold ------------------

  it('returns valid when recommendedQty equals minThreshold', () => {
    const result = validateMRPSuggestion(5, 20, 50, 20)
    expect(result.valid).toBe(true)
  })

  it('returns valid when recommendedQty is above minThreshold', () => {
    const result = validateMRPSuggestion(5, 20, 50, 100)
    expect(result.valid).toBe(true)
  })

  it('returns error when recommendedQty is below minThreshold', () => {
    const result = validateMRPSuggestion(5, 20, 50, 15)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('recommendedQty'))).toBe(true)
  })

  // --------------- Rule 3: recommendedQty <= maxCapacity ------------------

  it('returns valid when recommendedQty equals maxCapacity', () => {
    const result = validateMRPSuggestion(5, 20, 50, 200, 200)
    expect(result.valid).toBe(true)
  })

  it('returns error when recommendedQty exceeds maxCapacity', () => {
    const result = validateMRPSuggestion(5, 20, 50, 300, 200)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('maxCapacity'))).toBe(true)
  })

  // --------------- Rule 4: minThreshold < maxCapacity ----------------------

  it('returns error when minThreshold equals maxCapacity', () => {
    const result = validateMRPSuggestion(5, 200, 50, 200, 200)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('minThreshold'))).toBe(true)
  })

  it('returns error when minThreshold exceeds maxCapacity', () => {
    const result = validateMRPSuggestion(5, 300, 50, 200, 200)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('minThreshold'))).toBe(true)
  })

  it('does not enforce maxCapacity rules when maxCapacity is undefined', () => {
    // Only rule 1 and 2 should be in play
    const result = validateMRPSuggestion(5, 20, 50, 30)
    expect(result.valid).toBe(true)
  })

  // --------------- Multiple violations --------------------------------------

  it('reports multiple errors when several rules are violated simultaneously', () => {
    // projectedUsage <= currentStock (rule 1)
    // recommendedQty < minThreshold (rule 2)
    const result = validateMRPSuggestion(100, 50, 80, 30)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// validateMaterialAllocation
// ---------------------------------------------------------------------------

describe('validateMaterialAllocation', () => {
  // --------------- Rule 1: allocatedQty > 0 --------------------------------

  it('returns valid when allocatedQty is positive and stock is sufficient', () => {
    const result = validateMaterialAllocation(10, 100, 20)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error when allocatedQty is zero', () => {
    const result = validateMaterialAllocation(0, 100, 20)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('allocatedQty'))).toBe(true)
  })

  it('returns error when allocatedQty is negative', () => {
    const result = validateMaterialAllocation(-5, 100, 20)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('allocatedQty'))).toBe(true)
  })

  // --------------- Rule 2: total allocation <= availableStock ---------------

  it('returns valid when total allocation exactly equals availableStock', () => {
    // 30 (new) + 70 (existing) = 100 (available)
    const result = validateMaterialAllocation(30, 100, 70)
    expect(result.valid).toBe(true)
  })

  it('returns error when total allocation exceeds availableStock by 1', () => {
    // 31 + 70 = 101 > 100
    const result = validateMaterialAllocation(31, 100, 70)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('availableStock'))).toBe(true)
  })

  it('returns error when total allocation greatly exceeds availableStock', () => {
    const result = validateMaterialAllocation(200, 50, 0)
    expect(result.valid).toBe(false)
  })

  it('returns valid when there are no existing allocations', () => {
    const result = validateMaterialAllocation(50, 100, 0)
    expect(result.valid).toBe(true)
  })

  // --------------- Multiple violations --------------------------------------

  it('reports both errors when allocatedQty is zero and stock is exceeded', () => {
    // zero qty violates rule 1; 0 + 100 > 50 violates rule 2
    const result = validateMaterialAllocation(0, 50, 100)
    expect(result.valid).toBe(false)
    // Rule 1 fires for zero qty; Rule 2: 0 + 100 = 100 > 50 also fires
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})
