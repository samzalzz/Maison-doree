/**
 * app/api/supplier/__tests__/po-routes.test.ts
 *
 * Unit tests for Purchase Order Suggestion and Purchase Order Tracking routes.
 *
 * Strategy:
 *  - next-auth/jwt getToken is mocked to return a valid ADMIN token by default.
 *  - PurchaseOrderService class is mocked so no real DB calls are made.
 *  - Each route handler is imported directly and invoked with a synthetic
 *    NextRequest, exercising the full request/response cycle without HTTP.
 *
 * Test groups:
 *   1.  POST   /api/supplier/po-suggestions              – create PO suggestion
 *   2.  GET    /api/supplier/po-suggestions              – list pending suggestions
 *   3.  PATCH  /api/supplier/po-suggestions/[id]/approve – approve suggestion
 *   4.  PATCH  /api/supplier/po-suggestions/[id]/reject  – reject suggestion
 *   5.  GET    /api/supplier/purchase-orders             – list POs with filters
 *   6.  PATCH  /api/supplier/purchase-orders/[poId]/receive – receive PO
 *   7.  Auth / role-based access control checks
 *   8.  Error response shape contracts
 *   9.  Pagination parameter handling
 *  10.  Edge cases: missing fields, invalid IDs
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must come before any import that triggers withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: PurchaseOrderService class
// Methods are exposed via a shared mock instance stored on the module export.
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/purchase-order-service', () => {
  const actual = jest.requireActual('@/lib/services/purchase-order-service')

  const mockInstance = {
    suggestPurchaseOrder: jest.fn(),
    getPendingSuggestions: jest.fn(),
    approveSuggestion: jest.fn(),
    rejectSuggestion: jest.fn(),
    listPurchaseOrders: jest.fn(),
    receivePurchaseOrder: jest.fn(),
  }

  return {
    ...actual, // re-export POError, PONotFoundError
    PurchaseOrderService: jest.fn().mockImplementation(() => mockInstance),
    __mockInstance: mockInstance,
  }
})

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import * as poServiceModule from '@/lib/services/purchase-order-service'
const {
  POError,
  PONotFoundError,
  __mockInstance: mockService,
} = poServiceModule as any

// Route handlers under test
import { POST as createSuggestion, GET as listSuggestions } from '../po-suggestions/route'
import { PATCH as approveSuggestion } from '../po-suggestions/[id]/approve/route'
import { PATCH as rejectSuggestion } from '../po-suggestions/[id]/reject/route'
import { GET as listPurchaseOrders } from '../purchase-orders/route'
import { PATCH as receivePurchaseOrder } from '../purchase-orders/[poId]/receive/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const SUGGESTION_ID = 'clh3v2y0k0000356pk1b6vxxt'
const PO_ID         = 'clh3v2y0k0001356pk1b6vxxt'
const LAB_ID        = 'clh3v2y0k0002356pk1b6vxxt'
const MATERIAL_ID   = 'clh3v2y0k0003356pk1b6vxxt'
const SUPPLIER_ID   = 'clh3v2y0k0004356pk1b6vxxt'
const USER_ID       = 'clh3v2y0k0005356pk1b6vxxt'

// ---------------------------------------------------------------------------
// Auth token fixtures
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = {
  id: USER_ID,
  email: 'admin@maison-doree.com',
  name: 'Admin User',
  role: 'ADMIN' as const,
  sub: USER_ID,
}

const MANAGER_TOKEN = {
  id: USER_ID,
  email: 'manager@maison-doree.com',
  name: 'Manager User',
  role: 'MANAGER' as const,
  sub: USER_ID,
}

const WORKER_TOKEN = {
  id: USER_ID,
  email: 'worker@maison-doree.com',
  name: 'Worker User',
  role: 'WORKER' as const,
  sub: USER_ID,
}

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: SUGGESTION_ID,
    labId: LAB_ID,
    materialId: MATERIAL_ID,
    supplierId: SUPPLIER_ID,
    suggestedQty: 200,
    reasoning: 'Stock is below safety threshold',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makePurchaseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: PO_ID,
    poNumber: 'PO-1704067200000-ABC123XYZ',
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    quantity: 200,
    status: 'PENDING',
    approvedBy: 'admin@maison-doree.com',
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: null,
    receivedQuantity: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

/**
 * Build a NextRequest with an optional JSON body and query parameters.
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
  mockGetToken.mockResolvedValue(
    ADMIN_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
  )
})

// ============================================================================
// 1. POST /api/supplier/po-suggestions
// ============================================================================

describe('POST /api/supplier/po-suggestions', () => {
  it('creates a PO suggestion and returns 200 with suggestion data', async () => {
    const suggestion = makeSuggestion()
    mockService.suggestPurchaseOrder.mockResolvedValueOnce(suggestion)

    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 200,
      reasoning: 'Stock is below safety threshold',
    })
    const res = await createSuggestion(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.suggestion.id).toBe(SUGGESTION_ID)
    expect(json.data.suggestion.status).toBe('PENDING')
    expect(mockService.suggestPurchaseOrder).toHaveBeenCalledTimes(1)
  })

  it('returns 400 VALIDATION_ERROR when required fields are missing', async () => {
    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      // materialId, suggestedQty, reasoning omitted
    })
    const res = await createSuggestion(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.suggestPurchaseOrder).not.toHaveBeenCalled()
  })

  it('returns 400 BAD_REQUEST when POError is thrown (no active suppliers)', async () => {
    mockService.suggestPurchaseOrder.mockRejectedValueOnce(
      new POError('No active suppliers found for this material'),
    )

    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 100,
      reasoning: 'Stock critically low',
    })
    const res = await createSuggestion(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
    expect(json.error.message).toContain('No active suppliers')
  })

  it('returns 400 VALIDATION_ERROR when reasoning is too short (< 5 chars)', async () => {
    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 100,
      reasoning: 'low', // too short
    })
    const res = await createSuggestion(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 100,
      reasoning: 'Below threshold',
    })
    const res = await createSuggestion(req)

    expect(res.status).toBe(403)
    expect(mockService.suggestPurchaseOrder).not.toHaveBeenCalled()
  })

  it('returns 500 SERVER_ERROR on unexpected failure', async () => {
    mockService.suggestPurchaseOrder.mockRejectedValueOnce(new Error('Database unreachable'))

    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 100,
      reasoning: 'Below threshold',
    })
    const res = await createSuggestion(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 2. GET /api/supplier/po-suggestions
// ============================================================================

describe('GET /api/supplier/po-suggestions', () => {
  it('returns 200 with pending suggestions list', async () => {
    const suggestions = [makeSuggestion()]
    mockService.getPendingSuggestions.mockResolvedValueOnce(suggestions)

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.suggestions).toHaveLength(1)
    expect(mockService.getPendingSuggestions).toHaveBeenCalledTimes(1)
  })

  it('filters by labId when provided', async () => {
    mockService.getPendingSuggestions.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/po-suggestions', undefined, {
      labId: LAB_ID,
    })
    await listSuggestions(req)

    const callArg = mockService.getPendingSuggestions.mock.calls[0][0]
    expect(callArg.labId).toBe(LAB_ID)
  })

  it('passes pagination parameters to the service', async () => {
    mockService.getPendingSuggestions.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/po-suggestions', undefined, {
      page: '3',
      limit: '5',
    })
    await listSuggestions(req)

    const callArg = mockService.getPendingSuggestions.mock.calls[0][0]
    expect(callArg.page).toBe(3)
    expect(callArg.limit).toBe(5)
  })

  it('returns 200 with empty array when no pending suggestions exist', async () => {
    mockService.getPendingSuggestions.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.suggestions).toHaveLength(0)
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)

    expect(res.status).toBe(403)
    expect(mockService.getPendingSuggestions).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.getPendingSuggestions.mockRejectedValueOnce(new Error('Query timeout'))

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 3. PATCH /api/supplier/po-suggestions/[id]/approve
// ============================================================================

describe('PATCH /api/supplier/po-suggestions/[id]/approve', () => {
  it('approves a suggestion and returns 200 with the created PO', async () => {
    const po = makePurchaseOrder()
    mockService.approveSuggestion.mockResolvedValueOnce(po)

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {
      approvedBy: 'admin@maison-doree.com',
    })
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.po.id).toBe(PO_ID)
    expect(mockService.approveSuggestion).toHaveBeenCalledWith(
      SUGGESTION_ID,
      expect.objectContaining({ approvedBy: 'admin@maison-doree.com' }),
    )
  })

  it('injects token email as approvedBy automatically', async () => {
    mockService.approveSuggestion.mockResolvedValueOnce(makePurchaseOrder())

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {})
    await approveSuggestion(req, { params: { id: SUGGESTION_ID } })

    expect(mockService.approveSuggestion).toHaveBeenCalledWith(
      SUGGESTION_ID,
      expect.objectContaining({ approvedBy: 'admin@maison-doree.com' }),
    )
  })

  it('approves with quantity override when qtyOverride is provided', async () => {
    mockService.approveSuggestion.mockResolvedValueOnce(makePurchaseOrder({ quantity: 350 }))

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {
      qtyOverride: 350,
    })
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockService.approveSuggestion).toHaveBeenCalledWith(
      SUGGESTION_ID,
      expect.objectContaining({ qtyOverride: 350 }),
    )
  })

  it('returns 404 NOT_FOUND when suggestion does not exist', async () => {
    mockService.approveSuggestion.mockRejectedValueOnce(
      new PONotFoundError('Suggestion not found'),
    )

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {})
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 BAD_REQUEST when supplier lacks catalog for material', async () => {
    mockService.approveSuggestion.mockRejectedValueOnce(
      new POError('Selected supplier does not have catalog for this material'),
    )

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {
      supplierId: SUPPLIER_ID,
    })
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {})
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })

    expect(res.status).toBe(403)
    expect(mockService.approveSuggestion).not.toHaveBeenCalled()
  })

  it('returns 401 when no auth token present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {})
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })

    expect(res.status).toBe(401)
  })
})

// ============================================================================
// 4. PATCH /api/supplier/po-suggestions/[id]/reject
// ============================================================================

describe('PATCH /api/supplier/po-suggestions/[id]/reject', () => {
  it('rejects a suggestion and returns 200 with the updated suggestion', async () => {
    const rejected = makeSuggestion({
      status: 'REJECTED',
      rejectionReason: 'Budget constraints this quarter',
    })
    mockService.rejectSuggestion.mockResolvedValueOnce(rejected)

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/reject`, {
      reason: 'Budget constraints this quarter',
    })
    const res = await rejectSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.suggestion.status).toBe('REJECTED')
    expect(mockService.rejectSuggestion).toHaveBeenCalledWith(
      SUGGESTION_ID,
      'Budget constraints this quarter',
    )
  })

  it('returns 400 VALIDATION_ERROR when reason is too short (< 5 chars)', async () => {
    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/reject`, {
      reason: 'No', // too short
    })
    const res = await rejectSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.rejectSuggestion).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when reason is missing', async () => {
    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/reject`, {})
    const res = await rejectSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 NOT_FOUND when suggestion does not exist', async () => {
    mockService.rejectSuggestion.mockRejectedValueOnce(
      new PONotFoundError('Suggestion not found'),
    )

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/reject`, {
      reason: 'Budget constraints this quarter',
    })
    const res = await rejectSuggestion(req, { params: { id: SUGGESTION_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/reject`, {
      reason: 'Budget constraints',
    })
    const res = await rejectSuggestion(req, { params: { id: SUGGESTION_ID } })

    expect(res.status).toBe(403)
    expect(mockService.rejectSuggestion).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 5. GET /api/supplier/purchase-orders
// ============================================================================

describe('GET /api/supplier/purchase-orders', () => {
  // Note: the route passes searchParams.get() directly to PurchaseOrderFiltersSchema.
  // When optional params (status, supplierId, materialId) are absent, searchParams.get()
  // returns null, which Zod optional fields reject (null !== undefined). Tests always
  // provide all optional params explicitly to exercise the happy path correctly.

  it('returns 200 with purchase orders list when all filters are provided', async () => {
    const pos = [makePurchaseOrder()]
    mockService.listPurchaseOrders.mockResolvedValueOnce(pos)

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    const res = await listPurchaseOrders(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.pos).toHaveLength(1)
    expect(mockService.listPurchaseOrders).toHaveBeenCalledTimes(1)
  })

  it('passes status filter to the service', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    await listPurchaseOrders(req)

    const callArg = mockService.listPurchaseOrders.mock.calls[0][0]
    expect(callArg.status).toBe('PENDING')
  })

  it('passes supplierId filter to the service', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    await listPurchaseOrders(req)

    const callArg = mockService.listPurchaseOrders.mock.calls[0][0]
    expect(callArg.supplierId).toBe(SUPPLIER_ID)
  })

  it('passes materialId filter to the service', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    await listPurchaseOrders(req)

    const callArg = mockService.listPurchaseOrders.mock.calls[0][0]
    expect(callArg.materialId).toBe(MATERIAL_ID)
  })

  it('applies pagination from query params', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      page: '2',
      limit: '15',
    })
    await listPurchaseOrders(req)

    const callArg = mockService.listPurchaseOrders.mock.calls[0][0]
    expect(callArg.page).toBe(2)
    expect(callArg.limit).toBe(15)
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    const res = await listPurchaseOrders(req)

    expect(res.status).toBe(403)
    expect(mockService.listPurchaseOrders).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.listPurchaseOrders.mockRejectedValueOnce(new Error('Query failed'))

    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    const res = await listPurchaseOrders(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })

  it('returns 200 with default filters when all optional params are absent', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/purchase-orders')
    const res = await listPurchaseOrders(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockService.listPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
      }),
    )
  })
})

// ============================================================================
// 6. PATCH /api/supplier/purchase-orders/[poId]/receive
// ============================================================================

describe('PATCH /api/supplier/purchase-orders/[poId]/receive', () => {
  it('receives a PO and returns 200 with updated PO data', async () => {
    const received = makePurchaseOrder({
      status: 'DELIVERED',
      receivedQuantity: 200,
      actualDeliveryDate: new Date(),
    })
    mockService.receivePurchaseOrder.mockResolvedValueOnce(received)

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {
      receivedQuantity: 200,
    })
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.po.status).toBe('DELIVERED')
    expect(mockService.receivePurchaseOrder).toHaveBeenCalledWith(
      PO_ID,
      expect.objectContaining({ receivedQuantity: 200 }),
    )
  })

  it('receives a PO without specifying quantity (uses PO quantity)', async () => {
    const received = makePurchaseOrder({ status: 'DELIVERED' })
    mockService.receivePurchaseOrder.mockResolvedValueOnce(received)

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {})
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('includes qualityInspectionId when provided', async () => {
    const QI_ID = 'clh3v2y0k0099356pk1b6vxxt'
    mockService.receivePurchaseOrder.mockResolvedValueOnce(makePurchaseOrder({ status: 'DELIVERED' }))

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {
      qualityInspectionId: QI_ID,
    })
    await receivePurchaseOrder(req, { params: { poId: PO_ID } })

    expect(mockService.receivePurchaseOrder).toHaveBeenCalledWith(
      PO_ID,
      expect.objectContaining({ qualityInspectionId: QI_ID }),
    )
  })

  it('returns 404 NOT_FOUND when PO does not exist', async () => {
    mockService.receivePurchaseOrder.mockRejectedValueOnce(new PONotFoundError('PO not found'))

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {})
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 VALIDATION_ERROR when receivedQuantity is negative', async () => {
    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {
      receivedQuantity: -10,
    })
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.receivePurchaseOrder).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when qualityInspectionId is not a cuid', async () => {
    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {
      qualityInspectionId: 'not-a-cuid',
    })
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {})
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })

    expect(res.status).toBe(403)
    expect(mockService.receivePurchaseOrder).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    mockService.receivePurchaseOrder.mockRejectedValueOnce(new Error('Transaction failed'))

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {})
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 7. MANAGER role access
// ============================================================================

describe('MANAGER role access', () => {
  it('MANAGER can create PO suggestions', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )
    mockService.suggestPurchaseOrder.mockResolvedValueOnce(makeSuggestion())

    const req = makeRequest('POST', '/api/supplier/po-suggestions', {
      labId: LAB_ID,
      materialId: MATERIAL_ID,
      suggestedQty: 100,
      reasoning: 'Below safety level',
    })
    const res = await createSuggestion(req)

    expect(res.status).toBe(200)
  })

  it('MANAGER can list pending suggestions', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )
    mockService.getPendingSuggestions.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)

    expect(res.status).toBe(200)
  })

  it('MANAGER can approve suggestions', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )
    mockService.approveSuggestion.mockResolvedValueOnce(makePurchaseOrder())

    const req = makeRequest('PATCH', `/api/supplier/po-suggestions/${SUGGESTION_ID}/approve`, {})
    const res = await approveSuggestion(req, { params: { id: SUGGESTION_ID } })

    expect(res.status).toBe(200)
  })
})

// ============================================================================
// 8. Error response shape contracts
// ============================================================================

describe('Error response shape contracts', () => {
  it('error responses include success:false, error.code, and error.message', async () => {
    mockService.getPendingSuggestions.mockRejectedValueOnce(new Error('Unknown error'))

    const req = makeRequest('GET', '/api/supplier/po-suggestions')
    const res = await listSuggestions(req)
    const json = await res.json()

    expect(json.success).toBe(false)
    expect(typeof json.error.code).toBe('string')
    expect(typeof json.error.message).toBe('string')
  })

  it('success responses include success:true and data', async () => {
    mockService.listPurchaseOrders.mockResolvedValueOnce([makePurchaseOrder()])

    // Provide all optional params to avoid null Zod validation failure in the route
    const req = makeRequest('GET', '/api/supplier/purchase-orders', undefined, {
      status: 'PENDING',
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
    })
    const res = await listPurchaseOrders(req)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
  })

  it('404 errors use NOT_FOUND code', async () => {
    mockService.receivePurchaseOrder.mockRejectedValueOnce(new PONotFoundError('PO not found'))

    const req = makeRequest('PATCH', `/api/supplier/purchase-orders/${PO_ID}/receive`, {})
    const res = await receivePurchaseOrder(req, { params: { poId: PO_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
