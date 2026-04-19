/**
 * app/api/admin/quality/__tests__/routes.test.ts
 *
 * Integration-style tests for all Quality Management API routes.
 *
 * Strategy:
 *  - The quality service is fully mocked so no real DB or auth is required.
 *  - next-auth/jwt getToken is mocked to return a valid admin token by default.
 *  - Each route handler is imported directly and called with a synthetic
 *    NextRequest, allowing full request/response cycle coverage.
 *  - Test groups mirror the route file structure:
 *      1. POST   /inspections
 *      2. GET    /inspections
 *      3. GET    /inspections/[id]
 *      4. PATCH  /inspections/[id]
 *      5. POST   /inspections/[id]/checkpoints
 *      6. GET    /inspections/[id]/checkpoints
 *      7. GET    /inspections/[id]/result
 *      8. PATCH  /checkpoints/[id]
 *      9. DELETE /checkpoints/[id]
 *     10. GET    /summary
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must come before any import that triggers withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: quality service
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/quality-service', () => {
  const actual = jest.requireActual('@/lib/services/quality-service')
  return {
    ...actual, // re-export error classes (ValidationError, NotFoundError)
    createQualityInspection: jest.fn(),
    getQualityInspection: jest.fn(),
    listQualityInspections: jest.fn(),
    updateQualityInspection: jest.fn(),
    createInspectionCheckpoint: jest.fn(),
    getInspectionCheckpoints: jest.fn(),
    updateInspectionCheckpoint: jest.fn(),
    calculateInspectionResult: jest.fn(),
    getInspectionSummary: jest.fn(),
  }
})

// ---------------------------------------------------------------------------
// Mock: prisma (used directly in checkpoints/[id] DELETE route)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    inspectionCheckpoint: {
      findUnique: jest.fn(),
      delete: jest.fn(),
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
} from '@/lib/services/quality-service'

// Route handlers under test
import { POST as postInspections, GET as getInspections } from '../inspections/route'
import { GET as getInspectionById, PATCH as patchInspection } from '../inspections/[id]/route'
import {
  POST as postCheckpoint,
  GET as getCheckpoints,
} from '../inspections/[id]/checkpoints/route'
import { GET as getResult } from '../inspections/[id]/result/route'
import { PATCH as patchCheckpoint, DELETE as deleteCheckpoint } from '../checkpoints/[id]/route'
import { GET as getSummary } from '../summary/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockCreateInspection = createQualityInspection as jest.MockedFunction<
  typeof createQualityInspection
>
const mockGetInspection = getQualityInspection as jest.MockedFunction<typeof getQualityInspection>
const mockListInspections = listQualityInspections as jest.MockedFunction<
  typeof listQualityInspections
>
const mockUpdateInspection = updateQualityInspection as jest.MockedFunction<
  typeof updateQualityInspection
>
const mockCreateCheckpoint = createInspectionCheckpoint as jest.MockedFunction<
  typeof createInspectionCheckpoint
>
const mockGetCheckpoints = getInspectionCheckpoints as jest.MockedFunction<
  typeof getInspectionCheckpoints
>
const mockUpdateCheckpoint = updateInspectionCheckpoint as jest.MockedFunction<
  typeof updateInspectionCheckpoint
>
const mockCalculateResult = calculateInspectionResult as jest.MockedFunction<
  typeof calculateInspectionResult
>
const mockGetSummary = getInspectionSummary as jest.MockedFunction<typeof getInspectionSummary>
const mockPrismaCheckpoint = prisma.inspectionCheckpoint as jest.Mocked<
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

/** A valid admin token returned by the mocked getToken */
const ADMIN_TOKEN = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN' as const,
  sub: USER_ID,
}

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
  } as ReturnType<typeof makeInspection>
}

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
  } as ReturnType<typeof makeCheckpoint>
}

/**
 * Builds a NextRequest with optional JSON body and query string.
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
  // Default: return a valid admin token for every test
  mockGetToken.mockResolvedValue(ADMIN_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never)
})

// ============================================================================
// 1. POST /api/admin/quality/inspections
// ============================================================================

describe('POST /api/admin/quality/inspections', () => {
  it('returns 201 with inspection on success', async () => {
    const inspection = makeInspection()
    mockCreateInspection.mockResolvedValueOnce(inspection)

    const req = makeRequest('POST', '/api/admin/quality/inspections', {
      inspectionType: 'INCOMING',
      materialId: MATERIAL_ID,
      supplierId: SUPPLIER_ID,
      scheduledDate: SCHEDULED_DATE.toISOString(),
    })

    const res = await postInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(INSPECTION_ID)
    expect(mockCreateInspection).toHaveBeenCalledTimes(1)
  })

  it('returns 400 with errors array when ValidationError is thrown', async () => {
    mockCreateInspection.mockRejectedValueOnce(
      new ValidationError('Invalid input', ['materialId: required']),
    )

    const req = makeRequest('POST', '/api/admin/quality/inspections', {})
    const res = await postInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.errors).toContain('materialId: required')
  })

  it('returns 404 when NotFoundError is thrown', async () => {
    mockCreateInspection.mockRejectedValueOnce(
      new NotFoundError('RawMaterial', MATERIAL_ID),
    )

    const req = makeRequest('POST', '/api/admin/quality/inspections', {
      inspectionType: 'INCOMING',
      materialId: MATERIAL_ID,
      supplierId: SUPPLIER_ID,
      scheduledDate: SCHEDULED_DATE.toISOString(),
    })

    const res = await postInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/admin/quality/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })

    const res = await postInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 401 when no auth token is present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeRequest('POST', '/api/admin/quality/inspections', {})
    const res = await postInspections(req, { params: {} })

    expect(res.status).toBe(401)
  })

  it('returns 500 on unexpected service error', async () => {
    mockCreateInspection.mockRejectedValueOnce(new Error('DB connection lost'))

    const req = makeRequest('POST', '/api/admin/quality/inspections', {
      inspectionType: 'INCOMING',
      materialId: MATERIAL_ID,
      supplierId: SUPPLIER_ID,
      scheduledDate: SCHEDULED_DATE.toISOString(),
    })

    const res = await postInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// 2. GET /api/admin/quality/inspections
// ============================================================================

describe('GET /api/admin/quality/inspections', () => {
  it('returns 200 with inspections and total', async () => {
    const inspections = [makeInspection()]
    mockListInspections.mockResolvedValueOnce({ inspections, total: 1 })

    const req = makeRequest('GET', '/api/admin/quality/inspections')
    const res = await getInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.total).toBe(1)
    expect(json.data.inspections).toHaveLength(1)
  })

  it('passes inspectionType filter from query params', async () => {
    mockListInspections.mockResolvedValueOnce({ inspections: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/quality/inspections', undefined, {
      inspectionType: 'FINAL',
    })
    await getInspections(req, { params: {} })

    const callArg = mockListInspections.mock.calls[0][0]
    expect(callArg.inspectionType).toBe('FINAL')
  })

  it('passes limit and offset from query params', async () => {
    mockListInspections.mockResolvedValueOnce({ inspections: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/quality/inspections', undefined, {
      limit: '10',
      offset: '20',
    })
    await getInspections(req, { params: {} })

    const callArg = mockListInspections.mock.calls[0][0]
    expect(callArg.limit).toBe(10)
    expect(callArg.offset).toBe(20)
  })

  it('passes date range filters from query params', async () => {
    mockListInspections.mockResolvedValueOnce({ inspections: [], total: 0 })

    const req = makeRequest('GET', '/api/admin/quality/inspections', undefined, {
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
    await getInspections(req, { params: {} })

    const callArg = mockListInspections.mock.calls[0][0]
    expect(callArg.fromDate).toBeInstanceOf(Date)
    expect(callArg.toDate).toBeInstanceOf(Date)
  })

  it('returns 400 when ValidationError is thrown', async () => {
    mockListInspections.mockRejectedValueOnce(
      new ValidationError('Invalid filters', ['limit: must be <= 100']),
    )

    const req = makeRequest('GET', '/api/admin/quality/inspections', undefined, { limit: '999' })
    const res = await getInspections(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('includes pagination metadata in response', async () => {
    mockListInspections.mockResolvedValueOnce({ inspections: [], total: 100 })

    const req = makeRequest('GET', '/api/admin/quality/inspections', undefined, {
      limit: '10',
      offset: '40',
    })
    const res = await getInspections(req, { params: {} })
    const json = await res.json()

    expect(json.pagination.limit).toBe(10)
    expect(json.pagination.offset).toBe(40)
    expect(json.pagination.total).toBe(100)
  })
})

// ============================================================================
// 3. GET /api/admin/quality/inspections/[id]
// ============================================================================

describe('GET /api/admin/quality/inspections/[id]', () => {
  it('returns 200 with inspection when found', async () => {
    const inspection = makeInspection()
    mockGetInspection.mockResolvedValueOnce(inspection)

    const req = makeRequest('GET', `/api/admin/quality/inspections/${INSPECTION_ID}`)
    const res = await getInspectionById(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(INSPECTION_ID)
  })

  it('returns 404 when inspection is not found', async () => {
    mockGetInspection.mockResolvedValueOnce(null)

    const req = makeRequest('GET', `/api/admin/quality/inspections/nonexistent`)
    const res = await getInspectionById(req, { params: { id: 'nonexistent' } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetInspection.mockRejectedValueOnce(new Error('Unexpected'))

    const req = makeRequest('GET', `/api/admin/quality/inspections/${INSPECTION_ID}`)
    const res = await getInspectionById(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// 4. PATCH /api/admin/quality/inspections/[id]
// ============================================================================

describe('PATCH /api/admin/quality/inspections/[id]', () => {
  it('returns 200 with updated inspection on success', async () => {
    const updated = makeInspection({ status: 'IN_PROGRESS' })
    mockUpdateInspection.mockResolvedValueOnce(updated)

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/inspections/${INSPECTION_ID}`,
      { inspectionStatus: 'IN_PROGRESS' },
    )
    const res = await patchInspection(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('IN_PROGRESS')
    expect(mockUpdateInspection).toHaveBeenCalledWith(
      INSPECTION_ID,
      { inspectionStatus: 'IN_PROGRESS' },
      USER_ID,
    )
  })

  it('returns 400 with errors array on ValidationError', async () => {
    mockUpdateInspection.mockRejectedValueOnce(
      new ValidationError('Invalid transition', [
        'Cannot transition from PLANNED to PASSED',
      ]),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/inspections/${INSPECTION_ID}`,
      { inspectionStatus: 'PASSED' },
    )
    const res = await patchInspection(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
  })

  it('returns 404 when inspection does not exist', async () => {
    mockUpdateInspection.mockRejectedValueOnce(
      new NotFoundError('QualityInspection', INSPECTION_ID),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/inspections/${INSPECTION_ID}`,
      { notes: 'test' },
    )
    const res = await patchInspection(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/quality/inspections/${INSPECTION_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid',
      },
    )
    const res = await patchInspection(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 5. POST /api/admin/quality/inspections/[id]/checkpoints
// ============================================================================

describe('POST /api/admin/quality/inspections/[id]/checkpoints', () => {
  it('returns 201 with created checkpoint', async () => {
    const checkpoint = makeCheckpoint()
    mockCreateCheckpoint.mockResolvedValueOnce(checkpoint)

    const req = makeRequest(
      'POST',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
      { checkpointName: 'Appearance Check', passed: true },
    )
    const res = await postCheckpoint(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(CHECKPOINT_ID)
    expect(mockCreateCheckpoint).toHaveBeenCalledWith(
      INSPECTION_ID,
      { checkpointName: 'Appearance Check', passed: true },
      USER_ID,
    )
  })

  it('returns 404 when parent inspection does not exist', async () => {
    mockCreateCheckpoint.mockRejectedValueOnce(
      new NotFoundError('QualityInspection', INSPECTION_ID),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
      { checkpointName: 'Check', passed: false },
    )
    const res = await postCheckpoint(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 on ValidationError', async () => {
    mockCreateCheckpoint.mockRejectedValueOnce(
      new ValidationError('Invalid checkpoint', ['checkpointName: required']),
    )

    const req = makeRequest(
      'POST',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
      { passed: true },
    )
    const res = await postCheckpoint(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.errors).toContain('checkpointName: required')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{{bad' },
    )
    const res = await postCheckpoint(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 6. GET /api/admin/quality/inspections/[id]/checkpoints
// ============================================================================

describe('GET /api/admin/quality/inspections/[id]/checkpoints', () => {
  it('returns 200 with array of checkpoints', async () => {
    const checkpoints = [makeCheckpoint(), makeCheckpoint({ id: 'other-id', passed: false })]
    mockGetCheckpoints.mockResolvedValueOnce(checkpoints)

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
    )
    const res = await getCheckpoints(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(2)
  })

  it('returns 200 with empty array when no checkpoints exist', async () => {
    mockGetCheckpoints.mockResolvedValueOnce([])

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
    )
    const res = await getCheckpoints(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
  })

  it('returns 500 on unexpected error', async () => {
    mockGetCheckpoints.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/${INSPECTION_ID}/checkpoints`,
    )
    const res = await getCheckpoints(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// 7. GET /api/admin/quality/inspections/[id]/result
// ============================================================================

describe('GET /api/admin/quality/inspections/[id]/result', () => {
  it('returns 200 with result when inspection exists', async () => {
    mockGetInspection.mockResolvedValueOnce(makeInspection())
    mockCalculateResult.mockResolvedValueOnce({
      allPassed: true,
      passedCount: 3,
      totalCount: 3,
    })

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/${INSPECTION_ID}/result`,
    )
    const res = await getResult(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.allPassed).toBe(true)
    expect(json.data.passedCount).toBe(3)
    expect(json.data.totalCount).toBe(3)
  })

  it('returns 404 when inspection does not exist', async () => {
    mockGetInspection.mockResolvedValueOnce(null)

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/nonexistent/result`,
    )
    const res = await getResult(req, { params: { id: 'nonexistent' } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetInspection.mockResolvedValueOnce(makeInspection())
    mockCalculateResult.mockRejectedValueOnce(new Error('Unexpected'))

    const req = makeRequest(
      'GET',
      `/api/admin/quality/inspections/${INSPECTION_ID}/result`,
    )
    const res = await getResult(req, { params: { id: INSPECTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// 8. PATCH /api/admin/quality/checkpoints/[id]
// ============================================================================

describe('PATCH /api/admin/quality/checkpoints/[id]', () => {
  it('returns 200 with updated checkpoint on success', async () => {
    const updated = makeCheckpoint({ passed: false, notes: 'Out of spec' })
    mockUpdateCheckpoint.mockResolvedValueOnce(updated)

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/checkpoints/${CHECKPOINT_ID}`,
      { passed: false, notes: 'Out of spec' },
    )
    const res = await patchCheckpoint(req, { params: { id: CHECKPOINT_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.passed).toBe(false)
    expect(json.data.notes).toBe('Out of spec')
    expect(mockUpdateCheckpoint).toHaveBeenCalledWith(
      CHECKPOINT_ID,
      { passed: false, notes: 'Out of spec' },
      USER_ID,
    )
  })

  it('returns 400 on ValidationError', async () => {
    mockUpdateCheckpoint.mockRejectedValueOnce(
      new ValidationError('Invalid update', ['notes: must not exceed 500 characters']),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/checkpoints/${CHECKPOINT_ID}`,
      { notes: 'x'.repeat(501) },
    )
    const res = await patchCheckpoint(req, { params: { id: CHECKPOINT_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(json.error.errors)).toBe(true)
  })

  it('returns 404 when checkpoint does not exist', async () => {
    mockUpdateCheckpoint.mockRejectedValueOnce(
      new NotFoundError('InspectionCheckpoint', CHECKPOINT_ID),
    )

    const req = makeRequest(
      'PATCH',
      `/api/admin/quality/checkpoints/${CHECKPOINT_ID}`,
      { passed: true },
    )
    const res = await patchCheckpoint(req, { params: { id: CHECKPOINT_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest(
      `http://localhost/api/admin/quality/checkpoints/${CHECKPOINT_ID}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: 'bad' },
    )
    const res = await patchCheckpoint(req, { params: { id: CHECKPOINT_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })
})

// ============================================================================
// 9. DELETE /api/admin/quality/checkpoints/[id]
// ============================================================================

describe('DELETE /api/admin/quality/checkpoints/[id]', () => {
  it('returns 204 No Content on successful deletion', async () => {
    mockPrismaCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })
    mockPrismaCheckpoint.delete.mockResolvedValueOnce(makeCheckpoint())

    const req = makeRequest('DELETE', `/api/admin/quality/checkpoints/${CHECKPOINT_ID}`)
    const res = await deleteCheckpoint(req, { params: { id: CHECKPOINT_ID } })

    expect(res.status).toBe(204)
    expect(mockPrismaCheckpoint.delete).toHaveBeenCalledWith({ where: { id: CHECKPOINT_ID } })
  })

  it('returns 404 when checkpoint does not exist', async () => {
    mockPrismaCheckpoint.findUnique.mockResolvedValueOnce(null)

    const req = makeRequest('DELETE', `/api/admin/quality/checkpoints/nonexistent`)
    const res = await deleteCheckpoint(req, { params: { id: 'nonexistent' } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
    expect(mockPrismaCheckpoint.delete).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    mockPrismaCheckpoint.findUnique.mockResolvedValueOnce({ id: CHECKPOINT_ID })
    mockPrismaCheckpoint.delete.mockRejectedValueOnce(new Error('DB error'))

    const req = makeRequest('DELETE', `/api/admin/quality/checkpoints/${CHECKPOINT_ID}`)
    const res = await deleteCheckpoint(req, { params: { id: CHECKPOINT_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

// ============================================================================
// 10. GET /api/admin/quality/summary
// ============================================================================

describe('GET /api/admin/quality/summary', () => {
  const baseSummary = {
    totalInspections: 10,
    byStatus: {
      PLANNED: 2,
      IN_PROGRESS: 3,
      PASSED: 3,
      FAILED: 1,
      CONDITIONAL: 1,
    },
    byType: {
      INCOMING: 4,
      IN_PROCESS: 3,
      FINAL: 3,
    },
    averageCheckpointsPerInspection: 2.5,
  }

  it('returns 200 with summary data', async () => {
    mockGetSummary.mockResolvedValueOnce(baseSummary)

    const req = makeRequest('GET', '/api/admin/quality/summary')
    const res = await getSummary(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.totalInspections).toBe(10)
    expect(json.data.byStatus.PASSED).toBe(3)
    expect(json.data.byType.INCOMING).toBe(4)
    expect(json.data.averageCheckpointsPerInspection).toBe(2.5)
  })

  it('passes fromDate and toDate to the service', async () => {
    mockGetSummary.mockResolvedValueOnce(baseSummary)

    const req = makeRequest('GET', '/api/admin/quality/summary', undefined, {
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
    })
    await getSummary(req, { params: {} })

    const [calledFrom, calledTo] = mockGetSummary.mock.calls[0]
    expect(calledFrom).toBeInstanceOf(Date)
    expect(calledTo).toBeInstanceOf(Date)
    expect(calledFrom!.getFullYear()).toBe(2026)
  })

  it('returns 400 for malformed fromDate', async () => {
    const req = makeRequest('GET', '/api/admin/quality/summary', undefined, {
      fromDate: 'not-a-date',
    })
    const res = await getSummary(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for malformed toDate', async () => {
    const req = makeRequest('GET', '/api/admin/quality/summary', undefined, {
      toDate: 'bad-date',
    })
    const res = await getSummary(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('calls service with undefined dates when no query params given', async () => {
    mockGetSummary.mockResolvedValueOnce(baseSummary)

    const req = makeRequest('GET', '/api/admin/quality/summary')
    await getSummary(req, { params: {} })

    expect(mockGetSummary).toHaveBeenCalledWith(undefined, undefined)
  })

  it('returns 500 on unexpected service error', async () => {
    mockGetSummary.mockRejectedValueOnce(new Error('DB unreachable'))

    const req = makeRequest('GET', '/api/admin/quality/summary')
    const res = await getSummary(req, { params: {} })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
