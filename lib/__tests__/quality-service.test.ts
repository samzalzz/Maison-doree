/**
 * lib/__tests__/quality-service.test.ts
 *
 * Unit / integration tests for lib/services/quality-service.ts.
 *
 * Strategy:
 *  - The Prisma client is fully mocked via jest.mock so no real database is
 *    required.  Every prisma.* call is replaced with a jest.fn() whose return
 *    value is configured per-test.
 *  - Business-logic validators (validateInspectionContext,
 *    validateInspectionTransition) are imported from the real validators-qm
 *    module so their behaviour is covered transitively.
 *  - The test suite is grouped by service function, with sub-groups for the
 *    happy path, validation failures, and not-found scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: Prisma client
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    rawMaterial: {
      findUnique: jest.fn(),
    },
    productionBatch: {
      findUnique: jest.fn(),
    },
    supplier: {
      findUnique: jest.fn(),
    },
    qualityInspection: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    inspectionCheckpoint: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import {
  createQualityInspection,
  getQualityInspection,
  listQualityInspections,
  updateQualityInspection,
  createInspectionCheckpoint,
  getInspectionCheckpoints,
  updateInspectionCheckpoint,
  calculateInspectionResult,
  getInspectionSummary,
  ValidationError,
  NotFoundError,
  QualityServiceError,
} from '@/lib/services/quality-service'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

// Cast each prisma model mock to give TypeScript access to mockResolvedValue etc.
const mockRawMaterial = prisma.rawMaterial as jest.Mocked<typeof prisma.rawMaterial>
const mockBatch = prisma.productionBatch as jest.Mocked<typeof prisma.productionBatch>
const mockSupplier = prisma.supplier as jest.Mocked<typeof prisma.supplier>
const mockInspection = prisma.qualityInspection as jest.Mocked<typeof prisma.qualityInspection>
const mockCheckpoint = prisma.inspectionCheckpoint as jest.Mocked<
  typeof prisma.inspectionCheckpoint
>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MATERIAL_ID = 'clh3v2y0k0000356pk1b6vxxt'
const BATCH_ID = 'clh3v2y0k0001356pk1b6vxxt'
const SUPPLIER_ID = 'clh3v2y0k0002356pk1b6vxxt'
const INSPECTION_ID = 'clh3v2y0k0003356pk1b6vxxt'
const CHECKPOINT_ID = 'clh3v2y0k0004356pk1b6vxxt'
const USER_ID = 'clh3v2y0k0005356pk1b6vxxt'
const SCHEDULED_DATE = new Date('2026-06-01T10:00:00.000Z')

/** Minimal QualityInspection record returned by mocked Prisma queries. */
function makeInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: INSPECTION_ID,
    inspectionType: 'INCOMING',
    status: 'PLANNED',
    rawMaterialId: MATERIAL_ID,
    productionBatchId: null,
    supplierId: SUPPLIER_ID,
    inspectedBy: USER_ID,
    scheduledDate: SCHEDULED_DATE,
    actualDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    checkpoints: [],
    ...overrides,
  }
}

/** Minimal InspectionCheckpoint record. */
function makeCheckpoint(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECKPOINT_ID,
    inspectionId: INSPECTION_ID,
    checkName: 'Appearance Check',
    expectedValue: null,
    actualValue: null,
    passed: true,
    notes: null,
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
  it('QualityServiceError carries code and name', () => {
    const err = new QualityServiceError('something failed', 'SOME_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(QualityServiceError)
    expect(err.code).toBe('SOME_CODE')
    expect(err.name).toBe('QualityServiceError')
    expect(err.message).toBe('something failed')
  })

  it('ValidationError is a QualityServiceError with VALIDATION_ERROR code', () => {
    const err = new ValidationError('bad input', ['field: required'])
    expect(err).toBeInstanceOf(QualityServiceError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err.errors).toEqual(['field: required'])
  })

  it('NotFoundError formats message correctly', () => {
    const err = new NotFoundError('QualityInspection', 'abc123')
    expect(err).toBeInstanceOf(QualityServiceError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe('QualityInspection not found: abc123')
  })
})

// ============================================================================
// createQualityInspection
// ============================================================================

describe('createQualityInspection', () => {
  describe('happy path — INCOMING', () => {
    it('creates an INCOMING inspection when material + supplier exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID })
      const expected = makeInspection()
      mockInspection.create.mockResolvedValueOnce(expected)

      const result = await createQualityInspection(
        {
          inspectionType: 'INCOMING',
          materialId: MATERIAL_ID,
          supplierId: SUPPLIER_ID,
          scheduledDate: SCHEDULED_DATE,
        },
        USER_ID,
      )

      expect(result).toEqual(expected)
      expect(mockInspection.create).toHaveBeenCalledTimes(1)
      const createCall = mockInspection.create.mock.calls[0][0]
      expect(createCall.data.status).toBe('PLANNED')
      expect(createCall.data.inspectedBy).toBe(USER_ID)
      expect(createCall.data.rawMaterialId).toBe(MATERIAL_ID)
      expect(createCall.data.supplierId).toBe(SUPPLIER_ID)
      expect(createCall.data.productionBatchId).toBeNull()
    })
  })

  describe('happy path — IN_PROCESS', () => {
    it('creates an IN_PROCESS inspection when material + batch exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      const expected = makeInspection({
        inspectionType: 'IN_PROCESS',
        productionBatchId: BATCH_ID,
        supplierId: null,
      })
      mockInspection.create.mockResolvedValueOnce(expected)

      const result = await createQualityInspection(
        {
          inspectionType: 'IN_PROCESS',
          materialId: MATERIAL_ID,
          batchId: BATCH_ID,
          scheduledDate: SCHEDULED_DATE,
        },
        USER_ID,
      )

      expect(result.inspectionType).toBe('IN_PROCESS')
      expect(result.productionBatchId).toBe(BATCH_ID)
    })
  })

  describe('happy path — FINAL', () => {
    it('creates a FINAL inspection with optional notes', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockBatch.findUnique.mockResolvedValueOnce({ id: BATCH_ID })
      const expected = makeInspection({
        inspectionType: 'FINAL',
        productionBatchId: BATCH_ID,
        supplierId: null,
        notes: 'Final product check',
      })
      mockInspection.create.mockResolvedValueOnce(expected)

      const result = await createQualityInspection(
        {
          inspectionType: 'FINAL',
          materialId: MATERIAL_ID,
          batchId: BATCH_ID,
          scheduledDate: SCHEDULED_DATE,
          notes: 'Final product check',
        },
        USER_ID,
      )

      expect(result.notes).toBe('Final product check')
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when materialId is not a CUID', async () => {
      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: 'not-a-cuid',
            supplierId: SUPPLIER_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when inspectionType is missing', async () => {
      await expect(
        createQualityInspection(
          // @ts-expect-error intentional bad input
          { materialId: MATERIAL_ID, scheduledDate: SCHEDULED_DATE },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when notes exceed 500 characters', async () => {
      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: MATERIAL_ID,
            supplierId: SUPPLIER_ID,
            scheduledDate: SCHEDULED_DATE,
            notes: 'x'.repeat(501),
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('context validation failures', () => {
    it('throws ValidationError for INCOMING without supplierId', async () => {
      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: MATERIAL_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for INCOMING with batchId present', async () => {
      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: MATERIAL_ID,
            supplierId: SUPPLIER_ID,
            batchId: BATCH_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for IN_PROCESS without batchId', async () => {
      await expect(
        createQualityInspection(
          {
            inspectionType: 'IN_PROCESS',
            materialId: MATERIAL_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('referential existence failures', () => {
    it('throws ValidationError when material does not exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce(null)

      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: MATERIAL_ID,
            supplierId: SUPPLIER_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when batch does not exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockBatch.findUnique.mockResolvedValueOnce(null)

      await expect(
        createQualityInspection(
          {
            inspectionType: 'IN_PROCESS',
            materialId: MATERIAL_ID,
            batchId: BATCH_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when supplier does not exist', async () => {
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      mockSupplier.findUnique.mockResolvedValueOnce(null)

      await expect(
        createQualityInspection(
          {
            inspectionType: 'INCOMING',
            materialId: MATERIAL_ID,
            supplierId: SUPPLIER_ID,
            scheduledDate: SCHEDULED_DATE,
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getQualityInspection
// ============================================================================

describe('getQualityInspection', () => {
  it('returns inspection with checkpoints when found', async () => {
    const inspection = makeInspection()
    mockInspection.findUnique.mockResolvedValueOnce(inspection)

    const result = await getQualityInspection(INSPECTION_ID)
    expect(result).toEqual(inspection)
    expect(mockInspection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INSPECTION_ID } }),
    )
  })

  it('returns null when inspection does not exist', async () => {
    mockInspection.findUnique.mockResolvedValueOnce(null)

    const result = await getQualityInspection('nonexistent-id')
    expect(result).toBeNull()
  })
})

// ============================================================================
// listQualityInspections
// ============================================================================

describe('listQualityInspections', () => {
  it('returns inspections and total for empty filters (applies defaults)', async () => {
    const inspections = [makeInspection()]
    mockInspection.count.mockResolvedValueOnce(1)
    mockInspection.findMany.mockResolvedValueOnce(inspections)

    const result = await listQualityInspections({})
    expect(result.total).toBe(1)
    expect(result.inspections).toHaveLength(1)
  })

  it('passes inspectionType filter to Prisma', async () => {
    mockInspection.count.mockResolvedValueOnce(0)
    mockInspection.findMany.mockResolvedValueOnce([])

    await listQualityInspections({ inspectionType: 'FINAL' })

    const whereArg = (mockInspection.count.mock.calls[0][0] as { where?: unknown })?.where
    expect(whereArg).toMatchObject({ inspectionType: 'FINAL' })
  })

  it('passes date range filter to Prisma', async () => {
    mockInspection.count.mockResolvedValueOnce(0)
    mockInspection.findMany.mockResolvedValueOnce([])

    const fromDate = new Date('2026-01-01')
    const toDate = new Date('2026-12-31')
    await listQualityInspections({ fromDate, toDate })

    const whereArg = (mockInspection.count.mock.calls[0][0] as { where?: unknown })?.where as Record<string, unknown>
    expect(whereArg?.scheduledDate).toMatchObject({ gte: fromDate, lte: toDate })
  })

  it('passes pagination (limit / skip) to Prisma', async () => {
    mockInspection.count.mockResolvedValueOnce(100)
    mockInspection.findMany.mockResolvedValueOnce([])

    await listQualityInspections({ limit: 10, offset: 20 })

    const findManyCall = mockInspection.findMany.mock.calls[0][0] as {
      take?: number
      skip?: number
    }
    expect(findManyCall.take).toBe(10)
    expect(findManyCall.skip).toBe(20)
  })

  it('throws ValidationError for invalid filter (limit > 100)', async () => {
    await expect(listQualityInspections({ limit: 999 })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('throws ValidationError for negative offset', async () => {
    await expect(listQualityInspections({ offset: -5 })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })
})

// ============================================================================
// updateQualityInspection
// ============================================================================

describe('updateQualityInspection', () => {
  describe('happy path — status transitions', () => {
    it('transitions PLANNED → IN_PROGRESS', async () => {
      const existing = makeInspection({ status: 'PLANNED' })
      const updated = makeInspection({ status: 'IN_PROGRESS' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      const result = await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'IN_PROGRESS' },
        USER_ID,
      )

      expect(result.status).toBe('IN_PROGRESS')
    })

    it('transitions IN_PROGRESS → PASSED and auto-sets actualDate', async () => {
      const existing = makeInspection({ status: 'IN_PROGRESS', actualDate: null })
      const updated = makeInspection({ status: 'PASSED', actualDate: new Date() })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      const result = await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'PASSED' },
        USER_ID,
      )

      expect(result.status).toBe('PASSED')
      // Verify that update was called with an actualDate
      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.actualDate).toBeDefined()
    })

    it('transitions IN_PROGRESS → FAILED and auto-sets actualDate', async () => {
      const existing = makeInspection({ status: 'IN_PROGRESS', actualDate: null })
      const updated = makeInspection({ status: 'FAILED', actualDate: new Date() })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'FAILED' },
        USER_ID,
      )

      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.actualDate).toBeDefined()
    })

    it('transitions IN_PROGRESS → CONDITIONAL and auto-sets actualDate', async () => {
      const existing = makeInspection({ status: 'IN_PROGRESS', actualDate: null })
      const updated = makeInspection({ status: 'CONDITIONAL', actualDate: new Date() })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'CONDITIONAL' },
        USER_ID,
      )

      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.actualDate).toBeDefined()
    })

    it('preserves an existing actualDate when transitioning to terminal status', async () => {
      const existingDate = new Date('2026-05-01')
      const existing = makeInspection({ status: 'IN_PROGRESS', actualDate: existingDate })
      const updated = makeInspection({ status: 'PASSED', actualDate: existingDate })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'PASSED' },
        USER_ID,
      )

      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.actualDate).toEqual(existingDate)
    })

    it('honours an explicit completedDate override', async () => {
      const existing = makeInspection({ status: 'IN_PROGRESS' })
      const explicitDate = new Date('2026-07-01')
      const updated = makeInspection({ status: 'PASSED', actualDate: explicitDate })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      await updateQualityInspection(
        INSPECTION_ID,
        { inspectionStatus: 'PASSED', completedDate: explicitDate },
        USER_ID,
      )

      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.actualDate).toEqual(explicitDate)
    })

    it('updates notes only without changing status', async () => {
      const existing = makeInspection({ status: 'PLANNED' })
      const updated = makeInspection({ notes: 'Updated notes' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)
      mockInspection.update.mockResolvedValueOnce(updated)

      const result = await updateQualityInspection(
        INSPECTION_ID,
        { notes: 'Updated notes' },
        USER_ID,
      )

      expect(result.notes).toBe('Updated notes')
      const updateCall = mockInspection.update.mock.calls[0][0]
      expect(updateCall.data.status).toBeUndefined()
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when inspection does not exist', async () => {
      mockInspection.findUnique.mockResolvedValueOnce(null)

      await expect(
        updateQualityInspection(INSPECTION_ID, { notes: 'test' }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('invalid transition', () => {
    it('throws ValidationError for PLANNED → PASSED (skip IN_PROGRESS)', async () => {
      const existing = makeInspection({ status: 'PLANNED' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)

      await expect(
        updateQualityInspection(
          INSPECTION_ID,
          { inspectionStatus: 'PASSED' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for IN_PROGRESS → PLANNED (backward)', async () => {
      const existing = makeInspection({ status: 'IN_PROGRESS' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)

      await expect(
        updateQualityInspection(
          INSPECTION_ID,
          { inspectionStatus: 'PLANNED' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for PASSED → IN_PROGRESS (terminal → active)', async () => {
      const existing = makeInspection({ status: 'PASSED' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)

      await expect(
        updateQualityInspection(
          INSPECTION_ID,
          { inspectionStatus: 'IN_PROGRESS' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('schema validation', () => {
    it('throws ValidationError for invalid status value', async () => {
      const existing = makeInspection({ status: 'PLANNED' })
      mockInspection.findUnique.mockResolvedValueOnce(existing)

      await expect(
        updateQualityInspection(
          INSPECTION_ID,
          // @ts-expect-error intentional bad input
          { inspectionStatus: 'DONE' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for notes exceeding 500 chars', async () => {
      const existing = makeInspection()
      mockInspection.findUnique.mockResolvedValueOnce(existing)

      await expect(
        updateQualityInspection(
          INSPECTION_ID,
          { notes: 'a'.repeat(501) },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// createInspectionCheckpoint
// ============================================================================

describe('createInspectionCheckpoint', () => {
  it('creates a checkpoint when parent inspection exists', async () => {
    mockInspection.findUnique.mockResolvedValueOnce({ id: INSPECTION_ID })
    const expected = makeCheckpoint()
    mockCheckpoint.create.mockResolvedValueOnce(expected)

    const result = await createInspectionCheckpoint(
      INSPECTION_ID,
      {
        inspectionId: INSPECTION_ID,
        checkpointName: 'Appearance Check',
        passed: true,
      },
      USER_ID,
    )

    expect(result).toEqual(expected)
    const createCall = mockCheckpoint.create.mock.calls[0][0]
    expect(createCall.data.checkName).toBe('Appearance Check')
    expect(createCall.data.passed).toBe(true)
  })

  it('creates a checkpoint with passed=false and notes', async () => {
    mockInspection.findUnique.mockResolvedValueOnce({ id: INSPECTION_ID })
    const expected = makeCheckpoint({ passed: false, notes: 'Colour off-spec' })
    mockCheckpoint.create.mockResolvedValueOnce(expected)

    const result = await createInspectionCheckpoint(
      INSPECTION_ID,
      {
        inspectionId: INSPECTION_ID,
        checkpointName: 'Colour Check',
        passed: false,
        notes: 'Colour off-spec',
      },
      USER_ID,
    )

    expect(result.passed).toBe(false)
    expect(result.notes).toBe('Colour off-spec')
  })

  it('throws NotFoundError when parent inspection does not exist', async () => {
    mockInspection.findUnique.mockResolvedValueOnce(null)

    await expect(
      createInspectionCheckpoint(
        INSPECTION_ID,
        {
          inspectionId: INSPECTION_ID,
          checkpointName: 'Weight Check',
          passed: true,
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for empty checkpointName', async () => {
    mockInspection.findUnique.mockResolvedValueOnce({ id: INSPECTION_ID })

    await expect(
      createInspectionCheckpoint(
        INSPECTION_ID,
        {
          inspectionId: INSPECTION_ID,
          checkpointName: '',
          passed: true,
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for checkpointName exceeding 100 characters', async () => {
    mockInspection.findUnique.mockResolvedValueOnce({ id: INSPECTION_ID })

    await expect(
      createInspectionCheckpoint(
        INSPECTION_ID,
        {
          inspectionId: INSPECTION_ID,
          checkpointName: 'x'.repeat(101),
          passed: true,
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// getInspectionCheckpoints
// ============================================================================

describe('getInspectionCheckpoints', () => {
  it('returns all checkpoints for an inspection ordered by id', async () => {
    const checkpoints = [makeCheckpoint(), makeCheckpoint({ id: 'another-id', passed: false })]
    mockCheckpoint.findMany.mockResolvedValueOnce(checkpoints)

    const result = await getInspectionCheckpoints(INSPECTION_ID)

    expect(result).toHaveLength(2)
    expect(mockCheckpoint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inspectionId: INSPECTION_ID },
        orderBy: { id: 'asc' },
      }),
    )
  })

  it('returns an empty array when no checkpoints exist', async () => {
    mockCheckpoint.findMany.mockResolvedValueOnce([])

    const result = await getInspectionCheckpoints(INSPECTION_ID)
    expect(result).toEqual([])
  })
})

// ============================================================================
// updateInspectionCheckpoint
// ============================================================================

describe('updateInspectionCheckpoint', () => {
  it('updates passed and notes fields', async () => {
    mockCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })
    const updated = makeCheckpoint({ passed: false, notes: 'Corrected' })
    mockCheckpoint.update.mockResolvedValueOnce(updated)

    const result = await updateInspectionCheckpoint(
      CHECKPOINT_ID,
      { passed: false, notes: 'Corrected' },
      USER_ID,
    )

    expect(result.passed).toBe(false)
    expect(result.notes).toBe('Corrected')
  })

  it('updates only the notes field when passed is omitted', async () => {
    mockCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })
    const updated = makeCheckpoint({ notes: 'Re-checked' })
    mockCheckpoint.update.mockResolvedValueOnce(updated)

    await updateInspectionCheckpoint(
      CHECKPOINT_ID,
      { notes: 'Re-checked' },
      USER_ID,
    )

    const updateCall = mockCheckpoint.update.mock.calls[0][0]
    expect(updateCall.data.passed).toBeUndefined()
    expect(updateCall.data.notes).toBe('Re-checked')
  })

  it('throws NotFoundError when checkpoint does not exist', async () => {
    mockCheckpoint.findUnique.mockResolvedValueOnce(null)

    await expect(
      updateInspectionCheckpoint(CHECKPOINT_ID, { passed: false }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for notes exceeding 500 chars', async () => {
    mockCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })

    await expect(
      updateInspectionCheckpoint(
        CHECKPOINT_ID,
        { notes: 'n'.repeat(501) },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for a non-boolean passed value', async () => {
    mockCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })

    await expect(
      updateInspectionCheckpoint(
        CHECKPOINT_ID,
        // @ts-expect-error intentional bad input
        { passed: 'yes' },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// calculateInspectionResult
// ============================================================================

describe('calculateInspectionResult', () => {
  it('returns allPassed=true when all checkpoints passed', async () => {
    mockCheckpoint.findMany.mockResolvedValueOnce([
      { passed: true },
      { passed: true },
      { passed: true },
    ])

    const result = await calculateInspectionResult(INSPECTION_ID)
    expect(result.allPassed).toBe(true)
    expect(result.passedCount).toBe(3)
    expect(result.totalCount).toBe(3)
  })

  it('returns allPassed=false when some checkpoints failed', async () => {
    mockCheckpoint.findMany.mockResolvedValueOnce([
      { passed: true },
      { passed: false },
      { passed: true },
    ])

    const result = await calculateInspectionResult(INSPECTION_ID)
    expect(result.allPassed).toBe(false)
    expect(result.passedCount).toBe(2)
    expect(result.totalCount).toBe(3)
  })

  it('returns allPassed=false when no checkpoints exist', async () => {
    mockCheckpoint.findMany.mockResolvedValueOnce([])

    const result = await calculateInspectionResult(INSPECTION_ID)
    expect(result.allPassed).toBe(false)
    expect(result.passedCount).toBe(0)
    expect(result.totalCount).toBe(0)
  })

  it('returns allPassed=false when every checkpoint failed', async () => {
    mockCheckpoint.findMany.mockResolvedValueOnce([{ passed: false }, { passed: false }])

    const result = await calculateInspectionResult(INSPECTION_ID)
    expect(result.allPassed).toBe(false)
    expect(result.passedCount).toBe(0)
    expect(result.totalCount).toBe(2)
  })
})

// ============================================================================
// getInspectionSummary
// ============================================================================

describe('getInspectionSummary', () => {
  it('returns zeroed counters when no inspections exist', async () => {
    mockInspection.findMany.mockResolvedValueOnce([])

    const result = await getInspectionSummary()
    expect(result.totalInspections).toBe(0)
    expect(result.byStatus.PLANNED).toBe(0)
    expect(result.byType.INCOMING).toBe(0)
    expect(result.averageCheckpointsPerInspection).toBe(0)
  })

  it('correctly groups by status and type', async () => {
    mockInspection.findMany.mockResolvedValueOnce([
      { id: '1', status: 'PLANNED',     inspectionType: 'INCOMING',   _count: { checkpoints: 2 } },
      { id: '2', status: 'IN_PROGRESS', inspectionType: 'IN_PROCESS', _count: { checkpoints: 3 } },
      { id: '3', status: 'PASSED',      inspectionType: 'FINAL',      _count: { checkpoints: 4 } },
      { id: '4', status: 'FAILED',      inspectionType: 'INCOMING',   _count: { checkpoints: 1 } },
      { id: '5', status: 'CONDITIONAL', inspectionType: 'IN_PROCESS', _count: { checkpoints: 0 } },
    ])

    const result = await getInspectionSummary()

    expect(result.totalInspections).toBe(5)
    expect(result.byStatus.PLANNED).toBe(1)
    expect(result.byStatus.IN_PROGRESS).toBe(1)
    expect(result.byStatus.PASSED).toBe(1)
    expect(result.byStatus.FAILED).toBe(1)
    expect(result.byStatus.CONDITIONAL).toBe(1)
    expect(result.byType.INCOMING).toBe(2)
    expect(result.byType.IN_PROCESS).toBe(2)
    expect(result.byType.FINAL).toBe(1)
    // (2+3+4+1+0) / 5 = 10 / 5 = 2
    expect(result.averageCheckpointsPerInspection).toBe(2)
  })

  it('applies date range filter in the Prisma query', async () => {
    mockInspection.findMany.mockResolvedValueOnce([])

    const from = new Date('2026-01-01')
    const to = new Date('2026-06-30')
    await getInspectionSummary(from, to)

    const whereArg = (mockInspection.findMany.mock.calls[0][0] as { where?: unknown })
      ?.where as Record<string, unknown>
    expect(whereArg?.scheduledDate).toMatchObject({ gte: from, lte: to })
  })

  it('calculates averageCheckpointsPerInspection rounded to 2 decimal places', async () => {
    mockInspection.findMany.mockResolvedValueOnce([
      { id: '1', status: 'PASSED', inspectionType: 'FINAL', _count: { checkpoints: 1 } },
      { id: '2', status: 'PASSED', inspectionType: 'FINAL', _count: { checkpoints: 2 } },
    ])

    const result = await getInspectionSummary()
    // (1 + 2) / 2 = 1.5
    expect(result.averageCheckpointsPerInspection).toBe(1.5)
  })
})
