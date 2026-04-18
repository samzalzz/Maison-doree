/**
 * lib/__tests__/traceability-service.test.ts
 *
 * Unit tests for lib/services/traceability-service.ts.
 *
 * Strategy:
 *  - The Prisma client is fully mocked via jest.mock so no real database is
 *    required. All prisma.* calls are replaced with jest.fn() whose return
 *    values are configured per-test.
 *  - The TraceabilityRecord and MaterialAllocation models are not yet in the
 *    generated Prisma client; the service accesses them via (prisma as any).
 *    The mock mirrors this by exposing them as direct properties on the mock.
 *  - QualityInspection is accessed via the typed prisma client (it is present
 *    in the generated client) and is mocked via its typed mock helper.
 *  - Tests are grouped by service function with sub-groups for the happy path,
 *    validation failures, and not-found scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: Prisma client
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    productionBatch: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    qualityInspection: {
      findFirst: jest.fn(),
    },
    // PP / Traceability models accessed via (prisma as any).<model>
    traceabilityRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    materialAllocation: {
      findMany: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import {
  recordEvent,
  getBatchTraceability,
  getRecallHistory,
  traceBatchOrigins,
  searchEvents,
  getBatchesForRecall,
  getComplianceTimeline,
  generateTraceabilityReport,
  TraceabilityServiceError,
  ValidationError,
  NotFoundError,
} from '@/lib/services/traceability-service'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any
const mockBatch = prisma.productionBatch as jest.Mocked<typeof prisma.productionBatch>
const mockQualityInspection = prisma.qualityInspection as jest.Mocked<
  typeof prisma.qualityInspection
>

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const BATCH_ID        = 'clh3v2y0k0000356pk1b6vxxt'
const RECORD_ID       = 'clh3v2y0k0001356pk1b6vxxt'
const RECIPE_ID       = 'clh3v2y0k0002356pk1b6vxxt'
const MATERIAL_ID     = 'clh3v2y0k0003356pk1b6vxxt'
const INT_MATERIAL_ID = 'clh3v2y0k0004356pk1b6vxxt'
const SOURCE_BATCH_ID = 'clh3v2y0k0005356pk1b6vxxt'
const USER_ID         = 'clh3v2y0k0006356pk1b6vxxt'

const NOW = new Date('2026-04-18T12:00:00.000Z')

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: BATCH_ID,
    batchNumber: 'BATCH-2026-001',
    labId: 'clhlab000001',
    recipeId: RECIPE_ID,
    recipe: makeRecipe(),
    quantity: 100,
    status: 'COMPLETED',
    plannedStartTime: new Date('2026-04-10T08:00:00.000Z'),
    actualStartTime: new Date('2026-04-10T08:30:00.000Z'),
    actualCompletionTime: new Date('2026-04-10T16:00:00.000Z'),
    estimatedCompletionTime: null,
    machineId: null,
    employeeId: null,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: RECIPE_ID,
    name: 'Croissant',
    description: 'Classic butter croissant',
    laborMinutes: 90,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeTraceabilityRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    batchId: BATCH_ID,
    event: 'PRODUCTION_STARTED',
    details: '',
    location: null,
    timestamp: NOW,
    recordedBy: USER_ID,
    ...overrides,
  }
}

function makeAllocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clhalloc0001',
    batchId: BATCH_ID,
    materialId: MATERIAL_ID,
    material: {
      id: MATERIAL_ID,
      name: 'Flour',
      type: 'Ingredient',
      isIntermediate: false,
      unit: 'kg',
      productionRecipeId: null,
    },
    allocatedQty: 50,
    actualQty: 48,
    allocatedAt: NOW,
    ...overrides,
  }
}

function makeIntermediateAllocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clhalloc0002',
    batchId: BATCH_ID,
    materialId: INT_MATERIAL_ID,
    material: {
      id: INT_MATERIAL_ID,
      name: 'Pastry Cream',
      type: 'Intermediate',
      isIntermediate: true,
      unit: 'kg',
      productionRecipeId: RECIPE_ID,
    },
    allocatedQty: 20,
    actualQty: 19,
    allocatedAt: NOW,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================================================
// ERROR CLASSES
// ============================================================================

describe('Error classes', () => {
  it('TraceabilityServiceError carries code and name', () => {
    const err = new TraceabilityServiceError('something went wrong', 'SOME_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(TraceabilityServiceError)
    expect(err.code).toBe('SOME_CODE')
    expect(err.name).toBe('TraceabilityServiceError')
    expect(err.message).toBe('something went wrong')
  })

  it('ValidationError is a TraceabilityServiceError with VALIDATION_ERROR code', () => {
    const err = new ValidationError('bad input', ['field: required'])
    expect(err).toBeInstanceOf(TraceabilityServiceError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err.errors).toEqual(['field: required'])
  })

  it('NotFoundError formats message correctly', () => {
    const err = new NotFoundError('ProductionBatch', 'abc123')
    expect(err).toBeInstanceOf(TraceabilityServiceError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe('ProductionBatch not found: abc123')
  })
})

// ============================================================================
// recordEvent
// ============================================================================

describe('recordEvent', () => {
  const validInput = {
    batchId: BATCH_ID,
    event: 'PRODUCTION_STARTED' as const,
    recordedBy: USER_ID,
  }

  describe('happy path', () => {
    it('creates a traceability record when batch exists', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      const expected = makeTraceabilityRecord()
      mockPrisma.traceabilityRecord.create.mockResolvedValueOnce(expected)

      const result = await recordEvent(validInput, USER_ID)

      expect(result).toEqual(expected)
      expect(mockPrisma.traceabilityRecord.create).toHaveBeenCalledTimes(1)
      const createArg = mockPrisma.traceabilityRecord.create.mock.calls[0][0]
      expect(createArg.data.batchId).toBe(BATCH_ID)
      expect(createArg.data.event).toBe('PRODUCTION_STARTED')
      expect(createArg.data.recordedBy).toBe(USER_ID)
    })

    it('persists optional location and details when provided', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      const expected = makeTraceabilityRecord({
        event: 'SHIPPED',
        location: 'Warehouse A',
        details: 'Shipped to Casablanca',
      })
      mockPrisma.traceabilityRecord.create.mockResolvedValueOnce(expected)

      await recordEvent(
        {
          ...validInput,
          event: 'SHIPPED',
          location: 'Warehouse A',
          details: 'Shipped to Casablanca',
        },
        USER_ID,
      )

      const createArg = mockPrisma.traceabilityRecord.create.mock.calls[0][0]
      expect(createArg.data.location).toBe('Warehouse A')
      expect(createArg.data.details).toBe('Shipped to Casablanca')
    })

    it('defaults details to empty string when omitted', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      mockPrisma.traceabilityRecord.create.mockResolvedValueOnce(makeTraceabilityRecord())

      await recordEvent(validInput, USER_ID)

      const createArg = mockPrisma.traceabilityRecord.create.mock.calls[0][0]
      expect(createArg.data.details).toBe('')
    })

    it('records a RECALL event', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      const expected = makeTraceabilityRecord({ event: 'RECALL', details: 'Contamination suspected' })
      mockPrisma.traceabilityRecord.create.mockResolvedValueOnce(expected)

      const result = await recordEvent(
        { ...validInput, event: 'RECALL', details: 'Contamination suspected' },
        USER_ID,
      )

      expect(result.event).toBe('RECALL')
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when batch does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(recordEvent(validInput, USER_ID)).rejects.toBeInstanceOf(NotFoundError)
      expect(mockPrisma.traceabilityRecord.create).not.toHaveBeenCalled()
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when batchId is not a CUID', async () => {
      await expect(
        recordEvent({ ...validInput, batchId: 'not-a-cuid' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when event type is invalid', async () => {
      await expect(
        recordEvent(
          {
            ...validInput,
            // @ts-expect-error intentional bad input
            event: 'INVALID_EVENT',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when recordedBy is empty string', async () => {
      await expect(
        recordEvent({ ...validInput, recordedBy: '' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when location exceeds 100 characters', async () => {
      await expect(
        recordEvent({ ...validInput, location: 'x'.repeat(101) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when details exceeds 500 characters', async () => {
      await expect(
        recordEvent({ ...validInput, details: 'x'.repeat(501) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getBatchTraceability
// ============================================================================

describe('getBatchTraceability', () => {
  describe('happy path', () => {
    it('returns batch with events and allocations when all raw materials', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([
        makeTraceabilityRecord({ event: 'PRODUCTION_COMPLETED' }),
        makeTraceabilityRecord({ event: 'PRODUCTION_STARTED' }),
      ])
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeAllocation()])

      const result = await getBatchTraceability(BATCH_ID)

      expect(result.batch.id).toBe(BATCH_ID)
      expect(result.batch.recipe.name).toBe('Croissant')
      expect(result.events).toHaveLength(2)
      expect(result.sourceAllocations).toHaveLength(1)
      // Recipe dependency always added
      expect(result.dependencies.some((d) => d.type === 'recipe')).toBe(true)
    })

    it('adds batch dependency for intermediate material with productionRecipeId', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeIntermediateAllocation()])
      // Source batch found
      mockBatch.findFirst.mockResolvedValueOnce({ id: SOURCE_BATCH_ID, batchNumber: 'BATCH-2026-000' })

      const result = await getBatchTraceability(BATCH_ID)

      expect(result.dependencies.some((d) => d.type === 'batch')).toBe(true)
      const batchDep = result.dependencies.find((d) => d.type === 'batch')
      expect(batchDep?.id).toBe(SOURCE_BATCH_ID)
      expect(batchDep?.name).toBe('BATCH-2026-000')
    })

    it('does not add batch dependency when no completed source batch is found', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeIntermediateAllocation()])
      mockBatch.findFirst.mockResolvedValueOnce(null) // no source batch

      const result = await getBatchTraceability(BATCH_ID)

      expect(result.dependencies.filter((d) => d.type === 'batch')).toHaveLength(0)
    })

    it('deduplicates batch dependencies when multiple allocations share the same source batch', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])
      // Two intermediate allocations both sourced from the same batch
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([
        makeIntermediateAllocation(),
        makeIntermediateAllocation({ id: 'clhalloc0003', materialId: INT_MATERIAL_ID }),
      ])
      mockBatch.findFirst.mockResolvedValue({ id: SOURCE_BATCH_ID, batchNumber: 'BATCH-2026-000' })

      const result = await getBatchTraceability(BATCH_ID)

      const batchDeps = result.dependencies.filter((d) => d.type === 'batch')
      expect(batchDeps).toHaveLength(1)
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when batch does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(getBatchTraceability(BATCH_ID)).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})

// ============================================================================
// getRecallHistory
// ============================================================================

describe('getRecallHistory', () => {
  it('returns recalls and total count', async () => {
    const recalls = [makeTraceabilityRecord({ event: 'RECALL' })]
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(1)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce(recalls)

    const result = await getRecallHistory()

    expect(result.total).toBe(1)
    expect(result.recalls).toHaveLength(1)
    // Verify that the query targets RECALL events only
    const countArg = mockPrisma.traceabilityRecord.count.mock.calls[0][0]
    expect(countArg.where.event).toBe('RECALL')
  })

  it('returns empty recalls when none exist', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(0)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    const result = await getRecallHistory()

    expect(result.total).toBe(0)
    expect(result.recalls).toHaveLength(0)
  })

  it('passes pagination parameters to Prisma', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(100)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    await getRecallHistory(10, 20)

    const findManyArg = mockPrisma.traceabilityRecord.findMany.mock.calls[0][0]
    expect(findManyArg.take).toBe(10)
    expect(findManyArg.skip).toBe(20)
  })

  it('orders results by timestamp DESC', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(0)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    await getRecallHistory()

    const findManyArg = mockPrisma.traceabilityRecord.findMany.mock.calls[0][0]
    expect(findManyArg.orderBy).toEqual({ timestamp: 'desc' })
  })
})

// ============================================================================
// traceBatchOrigins
// ============================================================================

describe('traceBatchOrigins', () => {
  describe('happy path', () => {
    it('returns batch, origins, and timeline with production events', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(makeBatch())
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeAllocation()])
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([
        makeTraceabilityRecord({ event: 'PRODUCTION_STARTED', timestamp: new Date('2026-04-10T08:30:00Z') }),
        makeTraceabilityRecord({ event: 'PRODUCTION_COMPLETED', timestamp: new Date('2026-04-10T16:00:00Z') }),
      ])

      const result = await traceBatchOrigins(BATCH_ID)

      expect(result.batch.id).toBe(BATCH_ID)
      expect(result.immediateOrigins).toHaveLength(1)
      expect(result.sourceAllocations).toHaveLength(1)
      expect(result.sourceAllocations[0].source.materialId).toBe(MATERIAL_ID)
      expect(result.sourceAllocations[0].batch).toBeUndefined()
      expect(result.timeline.length).toBeGreaterThanOrEqual(2)
    })

    it('resolves the producing batch for an intermediate material', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(makeBatch())
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeIntermediateAllocation()])
      mockBatch.findFirst.mockResolvedValueOnce(makeBatch({ id: SOURCE_BATCH_ID, batchNumber: 'BATCH-2026-000' }))
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

      const result = await traceBatchOrigins(BATCH_ID)

      expect(result.sourceAllocations[0].batch?.id).toBe(SOURCE_BATCH_ID)
    })

    it('returns undefined batch for a raw material (not intermediate)', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(makeBatch())
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([makeAllocation()])
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

      const result = await traceBatchOrigins(BATCH_ID)

      expect(result.sourceAllocations[0].batch).toBeUndefined()
    })

    it('supplements timeline from batch timestamps when no event records exist', async () => {
      const batchWithDates = makeBatch({
        actualStartTime: new Date('2026-04-10T08:30:00Z'),
        actualCompletionTime: new Date('2026-04-10T16:00:00Z'),
      })
      mockBatch.findUnique.mockResolvedValueOnce(batchWithDates)
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([]) // no events

      const result = await traceBatchOrigins(BATCH_ID)

      // Timeline should contain synthesised events from batch timestamps
      expect(result.timeline.some((t) => t.event === 'PRODUCTION_STARTED')).toBe(true)
      expect(result.timeline.some((t) => t.event === 'PRODUCTION_COMPLETED')).toBe(true)
    })

    it('timeline is sorted chronologically', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(makeBatch())
      mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([
        makeTraceabilityRecord({ event: 'SHIPPED', timestamp: new Date('2026-04-11T10:00:00Z') }),
        makeTraceabilityRecord({ event: 'PRODUCTION_STARTED', timestamp: new Date('2026-04-10T08:00:00Z') }),
      ])

      const result = await traceBatchOrigins(BATCH_ID)

      const timestamps = result.timeline.map((t) => t.timestamp.getTime())
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
      }
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when batch does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(traceBatchOrigins(BATCH_ID)).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})

// ============================================================================
// searchEvents
// ============================================================================

describe('searchEvents', () => {
  it('returns events and total with empty filters (applies defaults)', async () => {
    const events = [makeTraceabilityRecord()]
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(1)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce(events)

    const result = await searchEvents({})

    expect(result.total).toBe(1)
    expect(result.events).toHaveLength(1)
  })

  it('passes batchId filter to Prisma', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(0)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    await searchEvents({ batchId: BATCH_ID })

    const whereArg = mockPrisma.traceabilityRecord.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ batchId: BATCH_ID })
  })

  it('passes event type filter to Prisma', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(0)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    await searchEvents({ event: 'RECALL' })

    const whereArg = mockPrisma.traceabilityRecord.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ event: 'RECALL' })
  })

  it('passes date range filter as timestamp gte/lte to Prisma', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(0)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    const fromDate = new Date('2026-01-01T00:00:00.000Z')
    const toDate   = new Date('2026-12-31T23:59:59.000Z')
    await searchEvents({ fromDate, toDate })

    const whereArg = mockPrisma.traceabilityRecord.count.mock.calls[0][0]?.where
    expect(whereArg?.timestamp).toMatchObject({ gte: fromDate, lte: toDate })
  })

  it('passes pagination (take / skip) to Prisma', async () => {
    mockPrisma.traceabilityRecord.count.mockResolvedValueOnce(200)
    mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])

    await searchEvents({ limit: 20, offset: 40 })

    const findManyArg = mockPrisma.traceabilityRecord.findMany.mock.calls[0][0]
    expect(findManyArg.take).toBe(20)
    expect(findManyArg.skip).toBe(40)
  })

  it('throws ValidationError for limit > 100', async () => {
    await expect(searchEvents({ limit: 101 })).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for negative offset', async () => {
    await expect(searchEvents({ offset: -1 })).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for invalid event type', async () => {
    await expect(
      // @ts-expect-error intentional bad input
      searchEvents({ event: 'NOT_AN_EVENT' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// getBatchesForRecall
// ============================================================================

describe('getBatchesForRecall', () => {
  const FROM = new Date('2026-04-01T00:00:00.000Z')
  const TO   = new Date('2026-04-30T23:59:59.000Z')

  it('returns batches that consumed the affected material within the date range', async () => {
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([
      { batchId: BATCH_ID },
    ])
    const batches = [makeBatch()]
    mockBatch.findMany.mockResolvedValueOnce(batches)

    const result = await getBatchesForRecall('Contamination', MATERIAL_ID, FROM, TO)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(BATCH_ID)

    const batchWhereArg = mockBatch.findMany.mock.calls[0][0]?.where
    expect(batchWhereArg?.id).toEqual({ in: [BATCH_ID] })
    expect(batchWhereArg?.plannedStartTime).toMatchObject({ gte: FROM, lte: TO })
  })

  it('returns empty array when no allocations reference the affected material', async () => {
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])

    const result = await getBatchesForRecall('Contamination', MATERIAL_ID, FROM, TO)

    expect(result).toHaveLength(0)
    // Should short-circuit without querying batches
    expect(mockBatch.findMany).not.toHaveBeenCalled()
  })

  it('returns empty array when allocations exist but no batches fall in the date range', async () => {
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([{ batchId: BATCH_ID }])
    mockBatch.findMany.mockResolvedValueOnce([])

    const result = await getBatchesForRecall('Contamination', MATERIAL_ID, FROM, TO)

    expect(result).toHaveLength(0)
  })
})

// ============================================================================
// getComplianceTimeline
// ============================================================================

describe('getComplianceTimeline', () => {
  describe('happy path', () => {
    it('returns full compliance timeline with all timestamps', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([
        makeTraceabilityRecord({
          event: 'PRODUCTION_STARTED',
          timestamp: new Date('2026-04-10T08:30:00Z'),
        }),
        makeTraceabilityRecord({
          event: 'PRODUCTION_COMPLETED',
          timestamp: new Date('2026-04-10T16:00:00Z'),
        }),
        makeTraceabilityRecord({
          event: 'SHIPPED',
          timestamp: new Date('2026-04-11T10:00:00Z'),
          location: 'Warehouse B',
        }),
      ])
      mockQualityInspection.findFirst.mockResolvedValueOnce({
        actualDate: new Date('2026-04-10T17:00:00Z'),
        status: 'PASSED',
      })

      const result = await getComplianceTimeline(BATCH_ID)

      expect(result.batchId).toBe(BATCH_ID)
      expect(result.batchNumber).toBe('BATCH-2026-001')
      expect(result.recipe).toBe('Croissant')
      expect(result.productionStart).toEqual(new Date('2026-04-10T08:30:00Z'))
      expect(result.productionEnd).toEqual(new Date('2026-04-10T16:00:00Z'))
      expect(result.shipped).toEqual(new Date('2026-04-11T10:00:00Z'))
      expect(result.qualityStatus).toBe('PASSED')
      expect(result.qualityCheckDate).toEqual(new Date('2026-04-10T17:00:00Z'))
      expect(result.events).toHaveLength(3)
    })

    it('uses batch-level timestamps when event records are absent', async () => {
      const batchWithRecipe = {
        ...makeBatch({
          actualStartTime: new Date('2026-04-10T09:00:00Z'),
          actualCompletionTime: new Date('2026-04-10T17:00:00Z'),
        }),
        recipe: makeRecipe(),
      }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([]) // no events
      mockQualityInspection.findFirst.mockResolvedValueOnce(null)

      const result = await getComplianceTimeline(BATCH_ID)

      expect(result.productionStart).toEqual(new Date('2026-04-10T09:00:00Z'))
      expect(result.productionEnd).toEqual(new Date('2026-04-10T17:00:00Z'))
      expect(result.qualityStatus).toBeUndefined()
      expect(result.shipped).toBeUndefined()
    })

    it('returns undefined quality fields when no inspection exists', async () => {
      const batchWithRecipe = { ...makeBatch(), recipe: makeRecipe() }
      mockBatch.findUnique.mockResolvedValueOnce(batchWithRecipe)
      mockPrisma.traceabilityRecord.findMany.mockResolvedValueOnce([])
      mockQualityInspection.findFirst.mockResolvedValueOnce(null)

      const result = await getComplianceTimeline(BATCH_ID)

      expect(result.qualityStatus).toBeUndefined()
      expect(result.qualityCheckDate).toBeUndefined()
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when batch does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(getComplianceTimeline(BATCH_ID)).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})

// ============================================================================
// generateTraceabilityReport
// ============================================================================

describe('generateTraceabilityReport', () => {
  function setupFullMocks() {
    // getBatchTraceability calls: findUnique (batch+recipe), tr().findMany, ma().findMany
    mockBatch.findUnique
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })  // getBatchTraceability
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })  // getComplianceTimeline
    mockPrisma.traceabilityRecord.findMany
      .mockResolvedValueOnce([
        makeTraceabilityRecord({ event: 'PRODUCTION_STARTED', timestamp: new Date('2026-04-10T08:30:00Z') }),
        makeTraceabilityRecord({ event: 'SHIPPED', timestamp: new Date('2026-04-11T10:00:00Z'), location: 'Depot', details: 'Sent to Casablanca' }),
      ])
      .mockResolvedValueOnce([
        makeTraceabilityRecord({ event: 'PRODUCTION_STARTED', timestamp: new Date('2026-04-10T08:30:00Z') }),
        makeTraceabilityRecord({ event: 'SHIPPED', timestamp: new Date('2026-04-11T10:00:00Z'), location: 'Depot', details: 'Sent to Casablanca' }),
      ])
    mockPrisma.materialAllocation.findMany.mockResolvedValue([makeAllocation()])
    mockQualityInspection.findFirst.mockResolvedValueOnce({
      actualDate: new Date('2026-04-10T17:00:00Z'),
      status: 'PASSED',
    })
  }

  it('returns a non-empty string', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(typeof report).toBe('string')
    expect(report.length).toBeGreaterThan(0)
  })

  it('includes the batch number in the report', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('BATCH-2026-001')
  })

  it('includes the recipe name in the report', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('Croissant')
  })

  it('includes MATERIAL ORIGINS section', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('MATERIAL ORIGINS')
    expect(report).toContain('Flour')
  })

  it('includes PRODUCTION EVENTS section', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('PRODUCTION EVENTS')
    expect(report).toContain('PRODUCTION_STARTED')
  })

  it('includes QUALITY RECORDS section', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('QUALITY RECORDS')
    expect(report).toContain('PASSED')
  })

  it('includes SHIPPING INFORMATION section with location and notes', async () => {
    setupFullMocks()
    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('SHIPPING INFORMATION')
    expect(report).toContain('Depot')
    expect(report).toContain('Sent to Casablanca')
  })

  it('indicates batch not yet shipped when no SHIPPED event exists', async () => {
    mockBatch.findUnique
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })
    mockPrisma.traceabilityRecord.findMany
      .mockResolvedValueOnce([makeTraceabilityRecord({ event: 'PRODUCTION_STARTED' })])
      .mockResolvedValueOnce([makeTraceabilityRecord({ event: 'PRODUCTION_STARTED' })])
    mockPrisma.materialAllocation.findMany.mockResolvedValue([])
    mockQualityInspection.findFirst.mockResolvedValueOnce(null)

    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('has not been shipped')
  })

  it('indicates no quality inspection when none exists', async () => {
    mockBatch.findUnique
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })
      .mockResolvedValueOnce({ ...makeBatch(), recipe: makeRecipe() })
    mockPrisma.traceabilityRecord.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockPrisma.materialAllocation.findMany.mockResolvedValue([])
    mockQualityInspection.findFirst.mockResolvedValueOnce(null)

    const report = await generateTraceabilityReport(BATCH_ID)
    expect(report).toContain('No quality inspection')
  })

  it('throws NotFoundError when batch does not exist', async () => {
    mockBatch.findUnique.mockResolvedValue(null)

    await expect(generateTraceabilityReport(BATCH_ID)).rejects.toBeInstanceOf(NotFoundError)
  })
})
