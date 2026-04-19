/**
 * app/api/supplier/__tests__/supplier-routes.test.ts
 *
 * Unit tests for Supplier CRUD API routes and Catalog routes.
 *
 * Strategy:
 *  - next-auth/jwt getToken is mocked to return a valid ADMIN token by default.
 *  - SupplierService class is mocked so no real DB calls are made.
 *  - lib/db is mocked to handle the catalog GET route's direct prisma usage.
 *  - Each route handler is imported directly and invoked with a synthetic
 *    NextRequest, exercising the full request/response cycle without HTTP.
 *
 * Test groups:
 *   1.  POST   /api/supplier/suppliers             – create supplier
 *   2.  GET    /api/supplier/suppliers             – list suppliers with filters
 *   3.  GET    /api/supplier/suppliers/[id]        – get single supplier
 *   4.  PATCH  /api/supplier/suppliers/[id]        – update supplier
 *   5.  DELETE /api/supplier/suppliers/[id]        – deactivate supplier (ADMIN only)
 *   6.  POST   /api/supplier/catalogs              – add catalog entry
 *   7.  GET    /api/supplier/catalogs              – list catalog entries
 *   8.  PATCH  /api/supplier/catalogs/[catalogId]  – update catalog entry
 *   9.  DELETE /api/supplier/catalogs/[catalogId]  – remove catalog entry
 *  10.  Auth / role-based access control checks
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must come before any import that triggers withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: SupplierService class
// Methods are exposed on the mock instance via a shared object so tests can
// call .mockResolvedValueOnce() etc. after import.
// ---------------------------------------------------------------------------

jest.mock('@/lib/services/supplier-service', () => {
  const actual = jest.requireActual('@/lib/services/supplier-service')

  const mockInstance = {
    createSupplier: jest.fn(),
    getSupplier: jest.fn(),
    listSuppliers: jest.fn(),
    updateSupplier: jest.fn(),
    deactivateSupplier: jest.fn(),
    addToSupplierCatalog: jest.fn(),
    updateCatalogEntry: jest.fn(),
    removeCatalogEntry: jest.fn(),
  }

  return {
    ...actual, // re-export SupplierError, SupplierNotFoundError, CatalogEntryAlreadyExistsError
    SupplierService: jest.fn().mockImplementation(() => mockInstance),
    __mockInstance: mockInstance,
  }
})

// ---------------------------------------------------------------------------
// Mock: lib/db  (used by the catalog GET route directly via prisma.supplierCatalog)
// ---------------------------------------------------------------------------

jest.mock('@/lib/db', () => ({
  db: {
    supplierCatalog: {
      findMany: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { db } from '@/lib/db'
import * as supplierServiceModule from '@/lib/services/supplier-service'
const {
  SupplierError,
  SupplierNotFoundError,
  CatalogEntryAlreadyExistsError,
  __mockInstance: mockService,
} = supplierServiceModule as any

// Route handlers under test
import { POST as createSupplier, GET as listSuppliers } from '../suppliers/route'
import {
  GET as getSupplierById,
  PATCH as updateSupplier,
  DELETE as deactivateSupplier,
} from '../suppliers/[id]/route'
import { POST as addCatalogEntry, GET as listCatalogEntries } from '../catalogs/route'
import {
  PATCH as updateCatalogEntry,
  DELETE as removeCatalogEntry,
} from '../catalogs/[catalogId]/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
const mockPrismaCatalog = (db.supplierCatalog as unknown) as { findMany: jest.Mock }

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const SUPPLIER_ID = 'clh3v2y0k0000356pk1b6vxxt'
const MATERIAL_ID = 'clh3v2y0k0001356pk1b6vxxt'
const CATALOG_ID  = 'clh3v2y0k0002356pk1b6vxxt'
const USER_ID     = 'clh3v2y0k0003356pk1b6vxxt'

// ---------------------------------------------------------------------------
// Auth token fixtures
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = {
  id: USER_ID,
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN' as const,
  sub: USER_ID,
}

const MANAGER_TOKEN = {
  id: USER_ID,
  email: 'manager@example.com',
  name: 'Manager User',
  role: 'MANAGER' as const,
  sub: USER_ID,
}

const WORKER_TOKEN = {
  id: USER_ID,
  email: 'worker@example.com',
  name: 'Worker User',
  role: 'WORKER' as const,
  sub: USER_ID,
}

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id: SUPPLIER_ID,
    name: 'Best Ingredients Co.',
    email: 'contact@bestingredients.com',
    phone: '+1-555-0100',
    address: '123 Supply Lane',
    city: 'Casablanca',
    contactPerson: 'Hassan Alami',
    categories: ['FLOUR', 'SUGAR'],
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function makeCatalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: CATALOG_ID,
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    unitPrice: 12.5,
    minOrderQty: 50,
    leadTimeDays: 7,
    isActive: true,
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
  // Default: authenticated as ADMIN
  mockGetToken.mockResolvedValue(
    ADMIN_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
  )
})

// ============================================================================
// 1. POST /api/supplier/suppliers
// ============================================================================

describe('POST /api/supplier/suppliers', () => {
  it('creates a supplier and returns 200 with supplier data', async () => {
    const supplier = makeSupplier()
    mockService.createSupplier.mockResolvedValueOnce(supplier)

    const req = makeRequest('POST', '/api/supplier/suppliers', {
      name: 'Best Ingredients Co.',
      email: 'contact@bestingredients.com',
      phone: '+1-555-0100',
      categories: ['FLOUR', 'SUGAR'],
    })
    const res = await createSupplier(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.supplier.id).toBe(SUPPLIER_ID)
    expect(json.data.supplier.name).toBe('Best Ingredients Co.')
    expect(mockService.createSupplier).toHaveBeenCalledTimes(1)
  })

  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const req = makeRequest('POST', '/api/supplier/suppliers', {
      email: 'test@example.com',
    })
    const res = await createSupplier(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.createSupplier).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when email is malformed', async () => {
    const req = makeRequest('POST', '/api/supplier/suppliers', {
      name: 'Valid Supplier',
      email: 'not-an-email',
    })
    const res = await createSupplier(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 Unauthorized when user is a WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('POST', '/api/supplier/suppliers', {
      name: 'Test Supplier',
    })
    const res = await createSupplier(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(mockService.createSupplier).not.toHaveBeenCalled()
  })

  it('returns 401 when no auth token is present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeRequest('POST', '/api/supplier/suppliers', { name: 'Supplier' })
    const res = await createSupplier(req)

    expect(res.status).toBe(401)
    expect(mockService.createSupplier).not.toHaveBeenCalled()
  })

  it('returns 500 SERVER_ERROR on unexpected service failure', async () => {
    mockService.createSupplier.mockRejectedValueOnce(new Error('DB connection lost'))

    const req = makeRequest('POST', '/api/supplier/suppliers', {
      name: 'Test Supplier',
    })
    const res = await createSupplier(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 2. GET /api/supplier/suppliers
// ============================================================================

describe('GET /api/supplier/suppliers', () => {
  // Note: the route passes searchParams.get('status') directly to SupplierFiltersSchema.
  // When no status param is provided, searchParams.get() returns null, which Zod's
  // optional enum rejects (null !== undefined). Always provide status to exercise the
  // happy path; the null-omission case is tested separately.

  it('returns 200 with paginated supplier list when status and search are provided', async () => {
    const suppliers = [makeSupplier()]
    mockService.listSuppliers.mockResolvedValueOnce({ suppliers, total: 1, page: 1, limit: 20 })

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'ACTIVE',
      search: 'ingredients',
    })
    const res = await listSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.suppliers).toHaveLength(1)
    expect(json.data.total).toBe(1)
    expect(mockService.listSuppliers).toHaveBeenCalledTimes(1)
  })

  // All tests explicitly pass both 'status' and 'search' params because the route passes
  // searchParams.get() directly into Zod; absent params become null which optional fields reject.

  it('passes status filter to the service', async () => {
    mockService.listSuppliers.mockResolvedValueOnce({ suppliers: [], total: 0, page: 1, limit: 20 })

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'ACTIVE',
      search: 'flour',
    })
    await listSuppliers(req)

    const callArg = mockService.listSuppliers.mock.calls[0][0]
    expect(callArg.status).toBe('ACTIVE')
  })

  it('passes search filter alongside status to the service', async () => {
    mockService.listSuppliers.mockResolvedValueOnce({ suppliers: [], total: 0, page: 1, limit: 20 })

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'ACTIVE',
      search: 'flour',
    })
    await listSuppliers(req)

    const callArg = mockService.listSuppliers.mock.calls[0][0]
    expect(callArg.search).toBe('flour')
  })

  it('applies pagination from query params', async () => {
    mockService.listSuppliers.mockResolvedValueOnce({ suppliers: [], total: 0, page: 2, limit: 10 })

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'ACTIVE',
      search: 'test',
      page: '2',
      limit: '10',
    })
    await listSuppliers(req)

    const callArg = mockService.listSuppliers.mock.calls[0][0]
    expect(callArg.page).toBe(2)
    expect(callArg.limit).toBe(10)
  })

  it('returns 403 when user is a WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'ACTIVE',
      search: 'test',
    })
    const res = await listSuppliers(req)

    expect(res.status).toBe(403)
    expect(mockService.listSuppliers).not.toHaveBeenCalled()
  })

  it('returns 200 with empty list when no suppliers match the BLOCKED filter', async () => {
    mockService.listSuppliers.mockResolvedValueOnce({ suppliers: [], total: 0, page: 1, limit: 20 })

    const req = makeRequest('GET', '/api/supplier/suppliers', undefined, {
      status: 'BLOCKED',
      search: 'test',
    })
    const res = await listSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.suppliers).toHaveLength(0)
  })
})

// ============================================================================
// 3. GET /api/supplier/suppliers/[id]
// ============================================================================

describe('GET /api/supplier/suppliers/[id]', () => {
  it('returns 200 with supplier data when found', async () => {
    const supplier = makeSupplier()
    mockService.getSupplier.mockResolvedValueOnce(supplier)

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.supplier.id).toBe(SUPPLIER_ID)
    expect(mockService.getSupplier).toHaveBeenCalledWith(SUPPLIER_ID)
  })

  it('returns 404 NOT_FOUND when supplier does not exist', async () => {
    mockService.getSupplier.mockRejectedValueOnce(new SupplierNotFoundError(SUPPLIER_ID))

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 500 on unexpected service error', async () => {
    mockService.getSupplier.mockRejectedValueOnce(new Error('Unexpected DB failure'))

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })

  it('returns 403 when user role is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })

    expect(res.status).toBe(403)
    expect(mockService.getSupplier).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 4. PATCH /api/supplier/suppliers/[id]
// ============================================================================

describe('PATCH /api/supplier/suppliers/[id]', () => {
  it('returns 200 with updated supplier on success', async () => {
    const updated = makeSupplier({ name: 'Updated Name', status: 'INACTIVE' })
    mockService.updateSupplier.mockResolvedValueOnce(updated)

    const req = makeRequest('PATCH', `/api/supplier/suppliers/${SUPPLIER_ID}`, {
      name: 'Updated Name',
      status: 'INACTIVE',
    })
    const res = await updateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.supplier.name).toBe('Updated Name')
    expect(mockService.updateSupplier).toHaveBeenCalledWith(
      SUPPLIER_ID,
      expect.objectContaining({ name: 'Updated Name', status: 'INACTIVE' }),
    )
  })

  it('returns 404 when supplier does not exist', async () => {
    mockService.updateSupplier.mockRejectedValueOnce(new SupplierNotFoundError(SUPPLIER_ID))

    const req = makeRequest('PATCH', `/api/supplier/suppliers/${SUPPLIER_ID}`, {
      name: 'New Name',
    })
    const res = await updateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 VALIDATION_ERROR for invalid status enum value', async () => {
    const req = makeRequest('PATCH', `/api/supplier/suppliers/${SUPPLIER_ID}`, {
      status: 'DELETED', // not a valid SupplierStatus
    })
    const res = await updateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.updateSupplier).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR for strict schema extra fields', async () => {
    const req = makeRequest('PATCH', `/api/supplier/suppliers/${SUPPLIER_ID}`, {
      unknownField: 'value',
    })
    const res = await updateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('MANAGER can update a supplier', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )
    const updated = makeSupplier({ notes: 'Trusted partner' })
    mockService.updateSupplier.mockResolvedValueOnce(updated)

    const req = makeRequest('PATCH', `/api/supplier/suppliers/${SUPPLIER_ID}`, {
      notes: 'Trusted partner',
    })
    const res = await updateSupplier(req, { params: { id: SUPPLIER_ID } })

    expect(res.status).toBe(200)
  })
})

// ============================================================================
// 5. DELETE /api/supplier/suppliers/[id]
// ============================================================================

describe('DELETE /api/supplier/suppliers/[id]', () => {
  it('returns 200 with deactivation message on success', async () => {
    mockService.deactivateSupplier.mockResolvedValueOnce(undefined)

    const req = makeRequest('DELETE', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await deactivateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('Supplier deactivated')
    expect(mockService.deactivateSupplier).toHaveBeenCalledWith(SUPPLIER_ID)
  })

  it('returns 404 when supplier does not exist', async () => {
    mockService.deactivateSupplier.mockRejectedValueOnce(new SupplierNotFoundError(SUPPLIER_ID))

    const req = makeRequest('DELETE', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await deactivateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when user is MANAGER (ADMIN only endpoint)', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('DELETE', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await deactivateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(mockService.deactivateSupplier).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    mockService.deactivateSupplier.mockRejectedValueOnce(new Error('DB failure'))

    const req = makeRequest('DELETE', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await deactivateSupplier(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 6. POST /api/supplier/catalogs
// ============================================================================

describe('POST /api/supplier/catalogs', () => {
  it('adds catalog entry and returns 200 with entry data', async () => {
    const entry = makeCatalogEntry()
    mockService.addToSupplierCatalog.mockResolvedValueOnce(entry)

    const req = makeRequest('POST', '/api/supplier/catalogs', {
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      unitPrice: 12.5,
      minOrderQty: 50,
      leadTimeDays: 7,
    })
    const res = await addCatalogEntry(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.catalog.id).toBe(CATALOG_ID)
    expect(mockService.addToSupplierCatalog).toHaveBeenCalledTimes(1)
  })

  it('returns 409 CONFLICT when catalog entry already exists', async () => {
    mockService.addToSupplierCatalog.mockRejectedValueOnce(
      new CatalogEntryAlreadyExistsError(SUPPLIER_ID, MATERIAL_ID),
    )

    const req = makeRequest('POST', '/api/supplier/catalogs', {
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      unitPrice: 10,
      minOrderQty: 10,
      leadTimeDays: 5,
    })
    const res = await addCatalogEntry(req)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe('CONFLICT')
  })

  it('returns 404 NOT_FOUND when supplier is not found', async () => {
    mockService.addToSupplierCatalog.mockRejectedValueOnce(
      new SupplierError('Supplier not found'),
    )

    const req = makeRequest('POST', '/api/supplier/catalogs', {
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      unitPrice: 10,
      minOrderQty: 10,
      leadTimeDays: 5,
    })
    const res = await addCatalogEntry(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 VALIDATION_ERROR when unitPrice is missing', async () => {
    const req = makeRequest('POST', '/api/supplier/catalogs', {
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      minOrderQty: 50,
      leadTimeDays: 7,
      // unitPrice omitted
    })
    const res = await addCatalogEntry(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.addToSupplierCatalog).not.toHaveBeenCalled()
  })

  it('returns 400 VALIDATION_ERROR when supplierId is not a cuid', async () => {
    const req = makeRequest('POST', '/api/supplier/catalogs', {
      supplierId: 'not-a-cuid',
      materialId: MATERIAL_ID,
      unitPrice: 10,
      minOrderQty: 10,
      leadTimeDays: 5,
    })
    const res = await addCatalogEntry(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

// ============================================================================
// 7. GET /api/supplier/catalogs
// ============================================================================

describe('GET /api/supplier/catalogs', () => {
  it('returns 200 with all catalog entries when no supplierId filter', async () => {
    const entries = [makeCatalogEntry()]
    mockPrismaCatalog.findMany.mockResolvedValueOnce(entries)

    const req = makeRequest('GET', '/api/supplier/catalogs')
    const res = await listCatalogEntries(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.catalogs).toHaveLength(1)
    expect(mockPrismaCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    )
  })

  it('filters by supplierId when provided', async () => {
    mockPrismaCatalog.findMany.mockResolvedValueOnce([])

    const req = makeRequest('GET', '/api/supplier/catalogs', undefined, {
      supplierId: SUPPLIER_ID,
    })
    await listCatalogEntries(req)

    expect(mockPrismaCatalog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: SUPPLIER_ID } }),
    )
  })

  it('returns 403 when user is a WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('GET', '/api/supplier/catalogs')
    const res = await listCatalogEntries(req)

    expect(res.status).toBe(403)
    expect(mockPrismaCatalog.findMany).not.toHaveBeenCalled()
  })

  it('returns 500 on database error', async () => {
    mockPrismaCatalog.findMany.mockRejectedValueOnce(new Error('DB timeout'))

    const req = makeRequest('GET', '/api/supplier/catalogs')
    const res = await listCatalogEntries(req)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })
})

// ============================================================================
// 8. PATCH /api/supplier/catalogs/[catalogId]
// ============================================================================

describe('PATCH /api/supplier/catalogs/[catalogId]', () => {
  it('returns 200 with updated catalog entry on success', async () => {
    const updated = makeCatalogEntry({ unitPrice: 15.0, leadTimeDays: 5 })
    mockService.updateCatalogEntry.mockResolvedValueOnce(updated)

    const req = makeRequest('PATCH', `/api/supplier/catalogs/${CATALOG_ID}`, {
      unitPrice: 15.0,
      leadTimeDays: 5,
    })
    const res = await updateCatalogEntry(req, { params: { catalogId: CATALOG_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.catalog.unitPrice).toBe(15.0)
    expect(mockService.updateCatalogEntry).toHaveBeenCalledWith(
      CATALOG_ID,
      expect.objectContaining({ unitPrice: 15.0, leadTimeDays: 5 }),
    )
  })

  it('returns 400 VALIDATION_ERROR when unitPrice is negative', async () => {
    const req = makeRequest('PATCH', `/api/supplier/catalogs/${CATALOG_ID}`, {
      unitPrice: -5,
    })
    const res = await updateCatalogEntry(req, { params: { catalogId: CATALOG_ID } })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockService.updateCatalogEntry).not.toHaveBeenCalled()
  })

  it('returns 500 on service error (catalog not found)', async () => {
    mockService.updateCatalogEntry.mockRejectedValueOnce(new Error('Record not found'))

    const req = makeRequest('PATCH', `/api/supplier/catalogs/${CATALOG_ID}`, {
      unitPrice: 20,
    })
    const res = await updateCatalogEntry(req, { params: { catalogId: CATALOG_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('PATCH', `/api/supplier/catalogs/${CATALOG_ID}`, {
      unitPrice: 50.00,
    })
    const res = await updateCatalogEntry(req, { params: { catalogId: CATALOG_ID } })

    expect(res.status).toBe(403)
    expect(mockService.updateCatalogEntry).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 9. DELETE /api/supplier/catalogs/[catalogId]
// ============================================================================

describe('DELETE /api/supplier/catalogs/[catalogId]', () => {
  it('returns 200 with deletion message on success', async () => {
    mockService.removeCatalogEntry.mockResolvedValueOnce(undefined)

    const req = makeRequest('DELETE', `/api/supplier/catalogs/${CATALOG_ID}`)
    const res = await removeCatalogEntry(req, { params: { catalogId: CATALOG_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.message).toBe('Catalog entry deleted')
    expect(mockService.removeCatalogEntry).toHaveBeenCalledWith(CATALOG_ID)
  })

  it('returns 500 on service error', async () => {
    mockService.removeCatalogEntry.mockRejectedValueOnce(new Error('Record not found'))

    const req = makeRequest('DELETE', `/api/supplier/catalogs/${CATALOG_ID}`)
    const res = await removeCatalogEntry(req, { params: { catalogId: CATALOG_ID } })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe('SERVER_ERROR')
  })

  it('returns 403 when user is WORKER', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeRequest('DELETE', `/api/supplier/catalogs/${CATALOG_ID}`)
    const res = await removeCatalogEntry(req, { params: { catalogId: CATALOG_ID } })

    expect(res.status).toBe(403)
    expect(mockService.removeCatalogEntry).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 10. Cross-cutting: auth and response shape contracts
// ============================================================================

describe('Auth and response shape contracts', () => {
  it('MANAGER can create a supplier', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )
    mockService.createSupplier.mockResolvedValueOnce(makeSupplier())

    const req = makeRequest('POST', '/api/supplier/suppliers', { name: 'Supplier' })
    const res = await createSupplier(req)

    expect(res.status).toBe(200)
  })

  it('success responses always include success:true and data', async () => {
    const supplier = makeSupplier()
    mockService.getSupplier.mockResolvedValueOnce(supplier)

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
  })

  it('error responses always include success:false, error.code, and error.message', async () => {
    mockService.getSupplier.mockRejectedValueOnce(new SupplierNotFoundError(SUPPLIER_ID))

    const req = makeRequest('GET', `/api/supplier/suppliers/${SUPPLIER_ID}`)
    const res = await getSupplierById(req, { params: { id: SUPPLIER_ID } })
    const json = await res.json()

    expect(json.success).toBe(false)
    expect(typeof json.error.code).toBe('string')
    expect(typeof json.error.message).toBe('string')
  })
})
