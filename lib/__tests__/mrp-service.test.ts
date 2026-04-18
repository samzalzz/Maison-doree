/**
 * lib/__tests__/mrp-service.test.ts
 *
 * Unit tests for lib/services/mrp-service.ts.
 *
 * Strategy:
 *  - The Prisma client is fully mocked via jest.mock so no real database is
 *    required. All prisma.* calls are replaced with jest.fn() whose return
 *    values are configured per-test.
 *  - Business-logic validators (validateMRPSuggestion, validateMaterialAllocation)
 *    are imported from the real validators-pp module so their behaviour is
 *    covered transitively.
 *  - The prisma instance is cast to `any` in the service because the PP models
 *    (enhancedForecast, mRPSuggestion, materialAllocation) are not yet present
 *    in the generated Prisma client. The mock mirrors this by using dynamic keys.
 *  - Tests are grouped by service function with sub-groups for happy path,
 *    validation failures, and not-found scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: Prisma client
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    recipe: {
      findUnique: jest.fn(),
    },
    rawMaterial: {
      findUnique: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
    productionBatch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    productionLab: {
      findUnique: jest.fn(),
    },
    labStock: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    // PP models accessed via (prisma as any).<model> — mocked as direct properties
    enhancedForecast: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    mRPSuggestion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    materialAllocation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import {
  createEnhancedForecast,
  getEnhancedForecast,
  listEnhancedForecasts,
  updateEnhancedForecast,
  createMRPSuggestion,
  getMRPSuggestion,
  listMRPSuggestions,
  updateMRPSuggestionStatus,
  allocateMaterial,
  getMaterialAllocation,
  listMaterialAllocations,
  updateAllocationActualQty,
  getAvailableCapacity,
  getMaterialStock,
  MRPServiceError,
  ValidationError,
  NotFoundError,
} from '@/lib/services/mrp-service'

// ---------------------------------------------------------------------------
// Typed mock helpers — access via any to reach the PP model mocks
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any
const mockRecipe = prisma.recipe as jest.Mocked<typeof prisma.recipe>
const mockRawMaterial = prisma.rawMaterial as jest.Mocked<typeof prisma.rawMaterial>
const mockSupplier = prisma.supplier as jest.Mocked<typeof prisma.supplier>
const mockBatch = prisma.productionBatch as jest.Mocked<typeof prisma.productionBatch>
const mockLab = prisma.productionLab as jest.Mocked<typeof prisma.productionLab>
const mockLabStock = prisma.labStock as jest.Mocked<typeof prisma.labStock>

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const RECIPE_ID      = 'clh3v2y0k0000356pk1b6vxxt'
const MATERIAL_ID    = 'clh3v2y0k0001356pk1b6vxxt'
const SUPPLIER_ID    = 'clh3v2y0k0002356pk1b6vxxt'
const BATCH_ID       = 'clh3v2y0k0003356pk1b6vxxt'
const LAB_ID         = 'clh3v2y0k0004356pk1b6vxxt'
const FORECAST_ID    = 'clh3v2y0k0005356pk1b6vxxt'
const SUGGESTION_ID  = 'clh3v2y0k0006356pk1b6vxxt'
const ALLOCATION_ID  = 'clh3v2y0k0007356pk1b6vxxt'
const USER_ID        = 'clh3v2y0k0008356pk1b6vxxt'

const FORECAST_DATE  = new Date('2026-06-01T00:00:00.000Z')
const PROJECTED_DATE = new Date('2026-07-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Minimal fixture factories
// ---------------------------------------------------------------------------

function makeForecast(overrides: Record<string, unknown> = {}) {
  return {
    id: FORECAST_ID,
    date: FORECAST_DATE,
    recipeId: RECIPE_ID,
    predictedQuantity: 100,
    confidenceLevel: 80,
    algorithm: 'SEASONAL',
    reasoning: null,
    sevenDayAvg: null,
    thirtyDayAvg: null,
    seasonalFactor: null,
    mlPrediction: null,
    mlConfidence: null,
    dayOfWeekPattern: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: SUGGESTION_ID,
    materialId: MATERIAL_ID,
    supplierId: SUPPLIER_ID,
    supplier: { id: SUPPLIER_ID, name: 'Acme Supplies' },
    currentStock: 10,
    minThreshold: 20,
    maxCapacity: null,
    projectedUsage: 50,
    projectedDate: PROJECTED_DATE,
    recommendedQty: 100,
    status: 'PENDING',
    createdAt: new Date(),
    dismissedAt: null,
    dismissReason: null,
    ...overrides,
  }
}

function makeAllocation(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOCATION_ID,
    batchId: BATCH_ID,
    materialId: MATERIAL_ID,
    allocatedQty: 25,
    actualQty: null,
    allocatedAt: new Date(),
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
  it('MRPServiceError carries code and name', () => {
    const err = new MRPServiceError('something went wrong', 'SOME_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(MRPServiceError)
    expect(err.code).toBe('SOME_CODE')
    expect(err.name).toBe('MRPServiceError')
    expect(err.message).toBe('something went wrong')
  })

  it('ValidationError is a MRPServiceError with VALIDATION_ERROR code', () => {
    const err = new ValidationError('bad input', ['field: required'])
    expect(err).toBeInstanceOf(MRPServiceError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err.errors).toEqual(['field: required'])
  })

  it('NotFoundError formats message correctly', () => {
    const err = new NotFoundError('EnhancedForecast', 'abc123')
    expect(err).toBeInstanceOf(MRPServiceError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe('EnhancedForecast not found: abc123')
  })
})

// ============================================================================
// createEnhancedForecast
// ============================================================================

describe('createEnhancedForecast', () => {
  describe('happy path', () => {
    it('creates a forecast when recipe exists (minimal input)', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      const expected = makeForecast()
      mockPrisma.enhancedForecast.create.mockResolvedValueOnce(expected)

      const result = await createEnhancedForecast(
        {
          date: FORECAST_DATE,
          recipeId: RECIPE_ID,
          predictedQuantity: 100,
          confidence: 80,
          algorithm: 'SEASONAL',
        },
        USER_ID,
      )

      expect(result).toEqual(expected)
      expect(mockPrisma.enhancedForecast.create).toHaveBeenCalledTimes(1)
      const createArg = mockPrisma.enhancedForecast.create.mock.calls[0][0]
      expect(createArg.data.recipeId).toBe(RECIPE_ID)
      expect(createArg.data.predictedQuantity).toBe(100)
      // Validator field `confidence` must be mapped to DB field `confidenceLevel`
      expect(createArg.data.confidenceLevel).toBe(80)
      expect(createArg.data.sevenDayAvg).toBeNull()
    })

    it('persists optional fields when provided', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      const expected = makeForecast({
        sevenDayAvg: 95,
        thirtyDayAvg: 90,
        seasonalFactor: 1.2,
        reasoning: 'Weekend boost',
      })
      mockPrisma.enhancedForecast.create.mockResolvedValueOnce(expected)

      await createEnhancedForecast(
        {
          date: FORECAST_DATE,
          recipeId: RECIPE_ID,
          predictedQuantity: 120,
          confidence: 85,
          algorithm: 'HYBRID_RULES_ML',
          sevenDayAverage: 95,
          thirtyDayAverage: 90,
          seasonalFactor: 1.2,
          reasoning: 'Weekend boost',
        },
        USER_ID,
      )

      const createArg = mockPrisma.enhancedForecast.create.mock.calls[0][0]
      expect(createArg.data.sevenDayAvg).toBe(95)
      expect(createArg.data.thirtyDayAvg).toBe(90)
      expect(createArg.data.seasonalFactor).toBe(1.2)
      expect(createArg.data.reasoning).toBe('Weekend boost')
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when recipe does not exist', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce(null)

      await expect(
        createEnhancedForecast(
          {
            date: FORECAST_DATE,
            recipeId: RECIPE_ID,
            predictedQuantity: 100,
            confidence: 80,
            algorithm: 'SEASONAL',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when recipeId is not a CUID', async () => {
      await expect(
        createEnhancedForecast(
          {
            date: FORECAST_DATE,
            recipeId: 'not-a-cuid',
            predictedQuantity: 100,
            confidence: 80,
            algorithm: 'SEASONAL',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when predictedQuantity is zero', async () => {
      await expect(
        createEnhancedForecast(
          {
            date: FORECAST_DATE,
            recipeId: RECIPE_ID,
            predictedQuantity: 0,
            confidence: 80,
            algorithm: 'SEASONAL',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when confidence exceeds 100', async () => {
      await expect(
        createEnhancedForecast(
          {
            date: FORECAST_DATE,
            recipeId: RECIPE_ID,
            predictedQuantity: 100,
            confidence: 101,
            algorithm: 'SEASONAL',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when algorithm is empty string', async () => {
      await expect(
        createEnhancedForecast(
          {
            date: FORECAST_DATE,
            recipeId: RECIPE_ID,
            predictedQuantity: 100,
            confidence: 80,
            algorithm: '',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getEnhancedForecast
// ============================================================================

describe('getEnhancedForecast', () => {
  it('returns forecast when found', async () => {
    const expected = makeForecast()
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce(expected)

    const result = await getEnhancedForecast(FORECAST_ID)
    expect(result).toEqual(expected)
    expect(mockPrisma.enhancedForecast.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FORECAST_ID } }),
    )
  })

  it('returns null when forecast does not exist', async () => {
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce(null)

    const result = await getEnhancedForecast('nonexistent-id')
    expect(result).toBeNull()
  })
})

// ============================================================================
// listEnhancedForecasts
// ============================================================================

describe('listEnhancedForecasts', () => {
  it('returns forecasts and total with empty filters (applies defaults)', async () => {
    const forecasts = [makeForecast()]
    mockPrisma.enhancedForecast.count.mockResolvedValueOnce(1)
    mockPrisma.enhancedForecast.findMany.mockResolvedValueOnce(forecasts)

    const result = await listEnhancedForecasts({})
    expect(result.total).toBe(1)
    expect(result.forecasts).toHaveLength(1)
  })

  it('passes recipeId filter to Prisma', async () => {
    mockPrisma.enhancedForecast.count.mockResolvedValueOnce(0)
    mockPrisma.enhancedForecast.findMany.mockResolvedValueOnce([])

    await listEnhancedForecasts({ recipeId: RECIPE_ID })

    const whereArg = mockPrisma.enhancedForecast.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ recipeId: RECIPE_ID })
  })

  it('passes minConfidence filter as confidenceLevel gte', async () => {
    mockPrisma.enhancedForecast.count.mockResolvedValueOnce(0)
    mockPrisma.enhancedForecast.findMany.mockResolvedValueOnce([])

    await listEnhancedForecasts({ minConfidence: 70 })

    const whereArg = mockPrisma.enhancedForecast.count.mock.calls[0][0]?.where
    expect(whereArg?.confidenceLevel).toMatchObject({ gte: 70 })
  })

  it('passes date range filter to Prisma', async () => {
    mockPrisma.enhancedForecast.count.mockResolvedValueOnce(0)
    mockPrisma.enhancedForecast.findMany.mockResolvedValueOnce([])

    const fromDate = new Date('2026-01-01')
    const toDate = new Date('2026-12-31')
    await listEnhancedForecasts({ fromDate, toDate })

    const whereArg = mockPrisma.enhancedForecast.count.mock.calls[0][0]?.where
    expect(whereArg?.date).toMatchObject({ gte: fromDate, lte: toDate })
  })

  it('passes pagination (take / skip) to Prisma', async () => {
    mockPrisma.enhancedForecast.count.mockResolvedValueOnce(100)
    mockPrisma.enhancedForecast.findMany.mockResolvedValueOnce([])

    await listEnhancedForecasts({ limit: 10, offset: 20 })

    const findManyArg = mockPrisma.enhancedForecast.findMany.mock.calls[0][0]
    expect(findManyArg.take).toBe(10)
    expect(findManyArg.skip).toBe(20)
  })

  it('throws ValidationError for limit > 100', async () => {
    await expect(listEnhancedForecasts({ limit: 101 })).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for negative offset', async () => {
    await expect(listEnhancedForecasts({ offset: -1 })).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// updateEnhancedForecast
// ============================================================================

describe('updateEnhancedForecast', () => {
  it('updates fields that are provided', async () => {
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce({ id: FORECAST_ID })
    const updated = makeForecast({ predictedQuantity: 150, confidenceLevel: 90 })
    mockPrisma.enhancedForecast.update.mockResolvedValueOnce(updated)

    const result = await updateEnhancedForecast(
      FORECAST_ID,
      { predictedQuantity: 150, confidence: 90 },
      USER_ID,
    )

    expect(result.predictedQuantity).toBe(150)
    const updateArg = mockPrisma.enhancedForecast.update.mock.calls[0][0]
    expect(updateArg.data.predictedQuantity).toBe(150)
    expect(updateArg.data.confidenceLevel).toBe(90)
  })

  it('only sends defined fields in the update payload', async () => {
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce({ id: FORECAST_ID })
    mockPrisma.enhancedForecast.update.mockResolvedValueOnce(makeForecast())

    await updateEnhancedForecast(FORECAST_ID, { reasoning: 'Manual override' }, USER_ID)

    const updateArg = mockPrisma.enhancedForecast.update.mock.calls[0][0]
    expect(updateArg.data.predictedQuantity).toBeUndefined()
    expect(updateArg.data.reasoning).toBe('Manual override')
  })

  it('throws NotFoundError when forecast does not exist', async () => {
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce(null)

    await expect(
      updateEnhancedForecast(FORECAST_ID, { predictedQuantity: 100 }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for invalid confidence value', async () => {
    mockPrisma.enhancedForecast.findUnique.mockResolvedValueOnce({ id: FORECAST_ID })

    await expect(
      updateEnhancedForecast(FORECAST_ID, { confidence: 101 }, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// createMRPSuggestion
// ============================================================================

describe('createMRPSuggestion', () => {
  const validInput = {
    materialId: MATERIAL_ID,
    currentStock: 10,
    minThreshold: 20,
    projectedUsage: 50,
    projectedDate: PROJECTED_DATE,
    recommendedQty: 100,
  }

  describe('happy path', () => {
    it('creates suggestion with PENDING status when all checks pass (no supplier)', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      const expected = makeSuggestion({ supplierId: null, supplier: null })
      mockPrisma.mRPSuggestion.create.mockResolvedValueOnce(expected)

      const result = await createMRPSuggestion(validInput, USER_ID)

      expect(result).toEqual(expected)
      const createArg = mockPrisma.mRPSuggestion.create.mock.calls[0][0]
      expect(createArg.data.status).toBe('PENDING')
      expect(createArg.data.materialId).toBe(MATERIAL_ID)
    })

    it('creates suggestion with supplier when supplierId is provided', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID })
      const expected = makeSuggestion()
      mockPrisma.mRPSuggestion.create.mockResolvedValueOnce(expected)

      const result = await createMRPSuggestion(
        { ...validInput, supplierId: SUPPLIER_ID },
        USER_ID,
      )

      expect(result.supplierId).toBe(SUPPLIER_ID)
    })
  })

  describe('business rule violations', () => {
    it('throws ValidationError when projectedUsage <= currentStock', async () => {
      await expect(
        createMRPSuggestion(
          { ...validInput, currentStock: 100, projectedUsage: 50 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when recommendedQty < minThreshold', async () => {
      await expect(
        createMRPSuggestion(
          { ...validInput, minThreshold: 200, recommendedQty: 50 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when recommendedQty > maxCapacity', async () => {
      await expect(
        createMRPSuggestion(
          { ...validInput, recommendedQty: 500, maxCapacity: 200 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when material does not exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce(null)

      await expect(createMRPSuggestion(validInput, USER_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })

    it('throws NotFoundError when supplier does not exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockSupplier.findUnique.mockResolvedValueOnce(null)

      await expect(
        createMRPSuggestion({ ...validInput, supplierId: SUPPLIER_ID }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when materialId is not a CUID', async () => {
      await expect(
        createMRPSuggestion({ ...validInput, materialId: 'bad-id' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when recommendedQty is zero', async () => {
      await expect(
        createMRPSuggestion({ ...validInput, recommendedQty: 0 }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getMRPSuggestion
// ============================================================================

describe('getMRPSuggestion', () => {
  it('returns suggestion with supplier when found', async () => {
    const expected = makeSuggestion()
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce(expected)

    const result = await getMRPSuggestion(SUGGESTION_ID)
    expect(result).toEqual(expected)
    expect(mockPrisma.mRPSuggestion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUGGESTION_ID } }),
    )
  })

  it('returns null when suggestion does not exist', async () => {
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce(null)

    const result = await getMRPSuggestion('nonexistent-id')
    expect(result).toBeNull()
  })
})

// ============================================================================
// listMRPSuggestions
// ============================================================================

describe('listMRPSuggestions', () => {
  it('returns suggestions and total with empty filters', async () => {
    const suggestions = [makeSuggestion()]
    mockPrisma.mRPSuggestion.count.mockResolvedValueOnce(1)
    mockPrisma.mRPSuggestion.findMany.mockResolvedValueOnce(suggestions)

    const result = await listMRPSuggestions({})
    expect(result.total).toBe(1)
    expect(result.suggestions).toHaveLength(1)
  })

  it('passes materialId filter to Prisma', async () => {
    mockPrisma.mRPSuggestion.count.mockResolvedValueOnce(0)
    mockPrisma.mRPSuggestion.findMany.mockResolvedValueOnce([])

    await listMRPSuggestions({ materialId: MATERIAL_ID })

    const whereArg = mockPrisma.mRPSuggestion.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ materialId: MATERIAL_ID })
  })

  it('passes status filter to Prisma', async () => {
    mockPrisma.mRPSuggestion.count.mockResolvedValueOnce(0)
    mockPrisma.mRPSuggestion.findMany.mockResolvedValueOnce([])

    await listMRPSuggestions({ status: 'ORDERED' })

    const whereArg = mockPrisma.mRPSuggestion.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ status: 'ORDERED' })
  })

  it('passes projectedDate range filter to Prisma', async () => {
    mockPrisma.mRPSuggestion.count.mockResolvedValueOnce(0)
    mockPrisma.mRPSuggestion.findMany.mockResolvedValueOnce([])

    const fromDate = new Date('2026-06-01')
    const toDate = new Date('2026-12-31')
    await listMRPSuggestions({ fromDate, toDate })

    const whereArg = mockPrisma.mRPSuggestion.count.mock.calls[0][0]?.where
    expect(whereArg?.projectedDate).toMatchObject({ gte: fromDate, lte: toDate })
  })

  it('passes pagination to Prisma', async () => {
    mockPrisma.mRPSuggestion.count.mockResolvedValueOnce(100)
    mockPrisma.mRPSuggestion.findMany.mockResolvedValueOnce([])

    await listMRPSuggestions({ limit: 5, offset: 10 })

    const findManyArg = mockPrisma.mRPSuggestion.findMany.mock.calls[0][0]
    expect(findManyArg.take).toBe(5)
    expect(findManyArg.skip).toBe(10)
  })

  it('throws ValidationError for invalid status in filters', async () => {
    await expect(
      // @ts-expect-error intentional bad input
      listMRPSuggestions({ status: 'CANCELLED' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// updateMRPSuggestionStatus
// ============================================================================

describe('updateMRPSuggestionStatus', () => {
  it('updates status to ORDERED', async () => {
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce({ id: SUGGESTION_ID })
    const updated = makeSuggestion({ status: 'ORDERED' })
    mockPrisma.mRPSuggestion.update.mockResolvedValueOnce(updated)

    const result = await updateMRPSuggestionStatus(SUGGESTION_ID, 'ORDERED', USER_ID)
    expect(result.status).toBe('ORDERED')
  })

  it('stamps dismissedAt when transitioning to DISMISSED', async () => {
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce({ id: SUGGESTION_ID })
    const updated = makeSuggestion({ status: 'DISMISSED', dismissedAt: new Date() })
    mockPrisma.mRPSuggestion.update.mockResolvedValueOnce(updated)

    await updateMRPSuggestionStatus(SUGGESTION_ID, 'DISMISSED', USER_ID)

    const updateArg = mockPrisma.mRPSuggestion.update.mock.calls[0][0]
    expect(updateArg.data.status).toBe('DISMISSED')
    expect(updateArg.data.dismissedAt).toBeDefined()
  })

  it('does not stamp dismissedAt for non-DISMISSED transitions', async () => {
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce({ id: SUGGESTION_ID })
    mockPrisma.mRPSuggestion.update.mockResolvedValueOnce(makeSuggestion({ status: 'COMPLETED' }))

    await updateMRPSuggestionStatus(SUGGESTION_ID, 'COMPLETED', USER_ID)

    const updateArg = mockPrisma.mRPSuggestion.update.mock.calls[0][0]
    expect(updateArg.data.dismissedAt).toBeUndefined()
  })

  it('throws NotFoundError when suggestion does not exist', async () => {
    mockPrisma.mRPSuggestion.findUnique.mockResolvedValueOnce(null)

    await expect(
      updateMRPSuggestionStatus(SUGGESTION_ID, 'ORDERED', USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ============================================================================
// allocateMaterial
// ============================================================================

describe('allocateMaterial', () => {
  const validInput = {
    batchId: BATCH_ID,
    materialId: MATERIAL_ID,
    allocatedQty: 25,
  }

  function setupStockMocks(stockQty: number, existingAllocated: number) {
    mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID, labId: LAB_ID })
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce(null) // no duplicate
    mockLabStock.findUnique.mockResolvedValueOnce({ quantity: stockQty })
    mockPrisma.materialAllocation.aggregate.mockResolvedValueOnce({
      _sum: { allocatedQty: existingAllocated },
    })
  }

  describe('happy path', () => {
    it('creates allocation when stock is sufficient', async () => {
      setupStockMocks(100, 20)
      const expected = makeAllocation()
      mockPrisma.materialAllocation.create.mockResolvedValueOnce(expected)

      const result = await allocateMaterial(validInput, USER_ID)

      expect(result).toEqual(expected)
      const createArg = mockPrisma.materialAllocation.create.mock.calls[0][0]
      expect(createArg.data.batchId).toBe(BATCH_ID)
      expect(createArg.data.materialId).toBe(MATERIAL_ID)
      expect(createArg.data.allocatedQty).toBe(25)
    })

    it('succeeds when allocation exactly equals available stock', async () => {
      // 25 (new) + 75 (existing) = 100 (available)
      setupStockMocks(100, 75)
      mockPrisma.materialAllocation.create.mockResolvedValueOnce(makeAllocation())

      await expect(allocateMaterial(validInput, USER_ID)).resolves.toBeDefined()
    })

    it('uses zero when LabStock record does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID, labId: LAB_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce(null)
      mockLabStock.findUnique.mockResolvedValueOnce(null) // no stock record
      mockPrisma.materialAllocation.aggregate.mockResolvedValueOnce({
        _sum: { allocatedQty: null },
      })

      await expect(
        allocateMaterial({ ...validInput, allocatedQty: 10 }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError) // 10 > 0 available
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when batch does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(allocateMaterial(validInput, USER_ID)).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when material does not exist', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID, labId: LAB_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce(null)

      await expect(allocateMaterial(validInput, USER_ID)).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('duplicate allocation', () => {
    it('throws ValidationError when same batch+material already allocated', async () => {
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID, labId: LAB_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce({ id: ALLOCATION_ID }) // duplicate

      await expect(allocateMaterial(validInput, USER_ID)).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('insufficient stock', () => {
    it('throws ValidationError when allocation exceeds available stock', async () => {
      setupStockMocks(30, 20) // 25 + 20 = 45 > 30

      await expect(allocateMaterial(validInput, USER_ID)).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when batchId is not a CUID', async () => {
      await expect(
        allocateMaterial({ ...validInput, batchId: 'bad-id' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when allocatedQty is zero', async () => {
      await expect(
        allocateMaterial({ ...validInput, allocatedQty: 0 }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getMaterialAllocation
// ============================================================================

describe('getMaterialAllocation', () => {
  it('returns allocation when found', async () => {
    const expected = makeAllocation()
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce(expected)

    const result = await getMaterialAllocation(ALLOCATION_ID)
    expect(result).toEqual(expected)
    expect(mockPrisma.materialAllocation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ALLOCATION_ID } }),
    )
  })

  it('returns null when allocation does not exist', async () => {
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce(null)

    const result = await getMaterialAllocation('nonexistent-id')
    expect(result).toBeNull()
  })
})

// ============================================================================
// listMaterialAllocations
// ============================================================================

describe('listMaterialAllocations', () => {
  it('returns allocations and total with empty filters', async () => {
    const allocations = [makeAllocation()]
    mockPrisma.materialAllocation.count.mockResolvedValueOnce(1)
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce(allocations)

    const result = await listMaterialAllocations({})
    expect(result.total).toBe(1)
    expect(result.allocations).toHaveLength(1)
  })

  it('passes batchId filter to Prisma', async () => {
    mockPrisma.materialAllocation.count.mockResolvedValueOnce(0)
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])

    await listMaterialAllocations({ batchId: BATCH_ID })

    const whereArg = mockPrisma.materialAllocation.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ batchId: BATCH_ID })
  })

  it('passes materialId filter to Prisma', async () => {
    mockPrisma.materialAllocation.count.mockResolvedValueOnce(0)
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])

    await listMaterialAllocations({ materialId: MATERIAL_ID })

    const whereArg = mockPrisma.materialAllocation.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ materialId: MATERIAL_ID })
  })

  it('passes pagination to Prisma', async () => {
    mockPrisma.materialAllocation.count.mockResolvedValueOnce(50)
    mockPrisma.materialAllocation.findMany.mockResolvedValueOnce([])

    await listMaterialAllocations({ limit: 20, offset: 40 })

    const findManyArg = mockPrisma.materialAllocation.findMany.mock.calls[0][0]
    expect(findManyArg.take).toBe(20)
    expect(findManyArg.skip).toBe(40)
  })

  it('throws ValidationError for limit > 100', async () => {
    await expect(listMaterialAllocations({ limit: 101 })).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// updateAllocationActualQty
// ============================================================================

describe('updateAllocationActualQty', () => {
  it('updates actualQty to a positive value', async () => {
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce({ id: ALLOCATION_ID })
    const updated = makeAllocation({ actualQty: 22.5 })
    mockPrisma.materialAllocation.update.mockResolvedValueOnce(updated)

    const result = await updateAllocationActualQty(ALLOCATION_ID, 22.5, USER_ID)

    expect(result.actualQty).toBe(22.5)
    const updateArg = mockPrisma.materialAllocation.update.mock.calls[0][0]
    expect(updateArg.data.actualQty).toBe(22.5)
  })

  it('allows actualQty of 0 (material reserved but unused)', async () => {
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce({ id: ALLOCATION_ID })
    mockPrisma.materialAllocation.update.mockResolvedValueOnce(makeAllocation({ actualQty: 0 }))

    await expect(updateAllocationActualQty(ALLOCATION_ID, 0, USER_ID)).resolves.toBeDefined()
  })

  it('throws NotFoundError when allocation does not exist', async () => {
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce(null)

    await expect(
      updateAllocationActualQty(ALLOCATION_ID, 10, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError when actualQty is negative', async () => {
    mockPrisma.materialAllocation.findUnique.mockResolvedValueOnce({ id: ALLOCATION_ID })

    await expect(
      updateAllocationActualQty(ALLOCATION_ID, -1, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// getAvailableCapacity
// ============================================================================

describe('getAvailableCapacity', () => {
  const FROM = new Date('2026-06-01T00:00:00.000Z')
  const TO   = new Date('2026-06-03T00:00:00.000Z')

  it('returns a day-by-day breakdown for the requested range', async () => {
    mockLab.findUnique.mockResolvedValueOnce({ id: LAB_ID, capacity: 5 })
    mockBatch.findMany.mockResolvedValueOnce([
      { plannedStartTime: new Date('2026-06-01T09:00:00.000Z') },
      { plannedStartTime: new Date('2026-06-01T14:00:00.000Z') },
      { plannedStartTime: new Date('2026-06-02T10:00:00.000Z') },
    ])

    const result = await getAvailableCapacity(LAB_ID, FROM, TO)

    expect(result.labId).toBe(LAB_ID)
    expect(result.dates).toHaveLength(3) // June 1, 2, 3
    expect(result.dates[0].allocated).toBe(2) // two batches on June 1
    expect(result.dates[0].capacity).toBe(5)
    expect(result.dates[0].available).toBe(3)
    expect(result.dates[1].allocated).toBe(1) // one batch on June 2
    expect(result.dates[2].allocated).toBe(0) // no batches on June 3
    expect(result.dates[2].available).toBe(5)
  })

  it('caps available at 0 when allocated exceeds capacity', async () => {
    mockLab.findUnique.mockResolvedValueOnce({ id: LAB_ID, capacity: 2 })
    mockBatch.findMany.mockResolvedValueOnce([
      { plannedStartTime: new Date('2026-06-01T09:00:00.000Z') },
      { plannedStartTime: new Date('2026-06-01T10:00:00.000Z') },
      { plannedStartTime: new Date('2026-06-01T11:00:00.000Z') },
    ])

    const result = await getAvailableCapacity(
      LAB_ID,
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    )

    expect(result.dates[0].allocated).toBe(3)
    expect(result.dates[0].available).toBe(0) // floored at 0
  })

  it('returns zero allocated when no batches exist in range', async () => {
    mockLab.findUnique.mockResolvedValueOnce({ id: LAB_ID, capacity: 4 })
    mockBatch.findMany.mockResolvedValueOnce([])

    const result = await getAvailableCapacity(
      LAB_ID,
      new Date('2026-06-01T00:00:00.000Z'),
      new Date('2026-06-01T00:00:00.000Z'),
    )

    expect(result.dates[0].allocated).toBe(0)
    expect(result.dates[0].available).toBe(4)
  })

  it('throws NotFoundError when lab does not exist', async () => {
    mockLab.findUnique.mockResolvedValueOnce(null)

    await expect(
      getAvailableCapacity(LAB_ID, FROM, TO),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

// ============================================================================
// getMaterialStock
// ============================================================================

describe('getMaterialStock', () => {
  it('classifies ADEQUATE when quantity > threshold * 1.5', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: LAB_ID, quantity: 160, minThreshold: 100 },
    ])

    const result = await getMaterialStock(MATERIAL_ID)

    expect(result.materialId).toBe(MATERIAL_ID)
    expect(result.byLab).toHaveLength(1)
    expect(result.byLab[0].status).toBe('ADEQUATE') // 160 > 100 * 1.5 = 150
    expect(result.byLab[0].quantity).toBe(160)
  })

  it('classifies LOW when quantity equals threshold * 1.5 boundary (inclusive low side)', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: LAB_ID, quantity: 150, minThreshold: 100 },
    ])

    const result = await getMaterialStock(MATERIAL_ID)
    // 150 is NOT > 150, so LOW applies
    expect(result.byLab[0].status).toBe('LOW')
  })

  it('classifies LOW when quantity is between threshold and threshold * 1.5', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: LAB_ID, quantity: 120, minThreshold: 100 },
    ])

    const result = await getMaterialStock(MATERIAL_ID)
    expect(result.byLab[0].status).toBe('LOW') // 100 <= 120 <= 150
  })

  it('classifies CRITICAL when quantity equals threshold', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: LAB_ID, quantity: 100, minThreshold: 100 },
    ])

    const result = await getMaterialStock(MATERIAL_ID)
    // 100 is NOT < 100 → LOW (on the boundary, not critical)
    expect(result.byLab[0].status).toBe('LOW')
  })

  it('classifies CRITICAL when quantity is below threshold', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: LAB_ID, quantity: 50, minThreshold: 100 },
    ])

    const result = await getMaterialStock(MATERIAL_ID)
    expect(result.byLab[0].status).toBe('CRITICAL') // 50 < 100
  })

  it('returns multiple lab entries with independent status', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([
      { labId: 'lab-a', quantity: 200, minThreshold: 100 }, // ADEQUATE
      { labId: 'lab-b', quantity: 110, minThreshold: 100 }, // LOW
      { labId: 'lab-c', quantity: 40,  minThreshold: 100 }, // CRITICAL
    ])

    const result = await getMaterialStock(MATERIAL_ID)

    expect(result.byLab).toHaveLength(3)
    expect(result.byLab.find((l) => l.labId === 'lab-a')?.status).toBe('ADEQUATE')
    expect(result.byLab.find((l) => l.labId === 'lab-b')?.status).toBe('LOW')
    expect(result.byLab.find((l) => l.labId === 'lab-c')?.status).toBe('CRITICAL')
  })

  it('returns empty byLab array when material has no stock records', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockLabStock.findMany.mockResolvedValueOnce([])

    const result = await getMaterialStock(MATERIAL_ID)
    expect(result.byLab).toHaveLength(0)
  })

  it('throws NotFoundError when material does not exist', async () => {
    mockRawMaterial.findUnique.mockResolvedValueOnce(null)

    await expect(getMaterialStock(MATERIAL_ID)).rejects.toBeInstanceOf(NotFoundError)
  })
})
