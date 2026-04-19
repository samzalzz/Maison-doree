/**
 * app/api/supplier/__tests__/import-routes.test.ts
 *
 * Unit tests for CSV import routes (suppliers and catalogs).
 *
 * Strategy:
 *  - next-auth/jwt getToken is mocked to return a valid ADMIN token by default.
 *  - lib/db is mocked so prisma calls (supplier.findFirst, supplier.create,
 *    supplierCatalog.findUnique, etc.) are controlled per-test.
 *  - FormData with a synthetic File object is constructed in memory — no
 *    real files on disk are needed.
 *  - Both import routes are ADMIN-only, so MANAGER/WORKER rejection is tested.
 *
 * Test groups:
 *   1.  POST /api/supplier/import/suppliers  – valid CSV, happy path
 *   2.  POST /api/supplier/import/suppliers  – missing file
 *   3.  POST /api/supplier/import/suppliers  – invalid data (missing name)
 *   4.  POST /api/supplier/import/suppliers  – duplicate supplier name
 *   5.  POST /api/supplier/import/suppliers  – mixed valid/invalid rows
 *   6.  POST /api/supplier/import/suppliers  – role checks
 *   7.  POST /api/supplier/import/catalogs   – valid CSV, happy path
 *   8.  POST /api/supplier/import/catalogs   – missing file
 *   9.  POST /api/supplier/import/catalogs   – supplier not found
 *  10.  POST /api/supplier/import/catalogs   – catalog duplicate handling
 *  11.  POST /api/supplier/import/catalogs   – role checks
 *  12.  POST /api/supplier/import/catalogs   – material not found
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must come before any import that triggers withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: lib/db
// The supplier import route uses: prisma.supplier.findFirst, prisma.supplier.create
// The catalog import route uses:  prisma.supplier.findUnique, prisma.rawMaterial.findUnique,
//                                 prisma.supplierCatalog.findUnique, prisma.supplierCatalog.create
// ---------------------------------------------------------------------------

const mockSupplierFindFirst  = jest.fn()
const mockSupplierFindUnique = jest.fn()
const mockSupplierCreate     = jest.fn()
const mockMaterialFindUnique = jest.fn()
const mockCatalogFindUnique  = jest.fn()
const mockCatalogCreate      = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    supplier: {
      findFirst:  (...args: unknown[]) => mockSupplierFindFirst(...args),
      findUnique: (...args: unknown[]) => mockSupplierFindUnique(...args),
      create:     (...args: unknown[]) => mockSupplierCreate(...args),
    },
    rawMaterial: {
      findUnique: (...args: unknown[]) => mockMaterialFindUnique(...args),
    },
    supplierCatalog: {
      findUnique: (...args: unknown[]) => mockCatalogFindUnique(...args),
      create:     (...args: unknown[]) => mockCatalogCreate(...args),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Route handlers under test
import { POST as importSuppliers } from '../import/suppliers/route'
import { POST as importCatalogs }  from '../import/catalogs/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SUPPLIER_ID = 'clh3v2y0k0000356pk1b6vxxt'
const MATERIAL_ID = 'clh3v2y0k0001356pk1b6vxxt'
const CATALOG_ID  = 'clh3v2y0k0002356pk1b6vxxt'
const USER_ID     = 'clh3v2y0k0003356pk1b6vxxt'

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
// Helper: build a NextRequest with FormData containing a CSV file
// ---------------------------------------------------------------------------

function makeImportRequest(csvContent: string, fileName = 'import.csv'): NextRequest {
  const file = new File([csvContent], fileName, { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)

  return new NextRequest('http://localhost/api/supplier/import/suppliers', {
    method: 'POST',
    body: formData,
  })
}

function makeImportCatalogRequest(csvContent: string, fileName = 'catalog.csv'): NextRequest {
  const file = new File([csvContent], fileName, { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)

  return new NextRequest('http://localhost/api/supplier/import/catalogs', {
    method: 'POST',
    body: formData,
  })
}

function makeRequestWithoutFile(): NextRequest {
  const formData = new FormData()
  // no 'file' field appended

  return new NextRequest('http://localhost/api/supplier/import/suppliers', {
    method: 'POST',
    body: formData,
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
// 1. POST /api/supplier/import/suppliers – valid CSV data
// ============================================================================

describe('POST /api/supplier/import/suppliers – valid data', () => {
  it('imports a single valid supplier row and returns imported count', async () => {
    const csv = [
      'name,email,phone,city,contactPerson,leadTimeDays,categories',
      'Farine du Maroc,contact@farine.ma,+212-600-001,Casablanca,Rachid Alami,5,FLOUR;SUGAR',
    ].join('\n')

    const createdSupplier = {
      id: SUPPLIER_ID,
      name: 'Farine du Maroc',
      email: 'contact@farine.ma',
      status: 'ACTIVE',
    }

    mockSupplierFindFirst.mockResolvedValueOnce(null)   // not a duplicate
    mockSupplierCreate.mockResolvedValueOnce(createdSupplier)

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.imported).toBe(1)
    expect(json.data.failed).toBe(0)
    expect(json.data.errors).toHaveLength(0)
  })

  it('imports multiple valid rows and reports correct counts', async () => {
    const csv = [
      'name,email,city',
      'Supplier Alpha,alpha@test.com,Rabat',
      'Supplier Beta,beta@test.com,Fes',
    ].join('\n')

    mockSupplierFindFirst.mockResolvedValue(null)  // neither is a duplicate
    mockSupplierCreate
      .mockResolvedValueOnce({ id: 'id1', name: 'Supplier Alpha', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'id2', name: 'Supplier Beta', status: 'ACTIVE' })

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(2)
    expect(json.data.failed).toBe(0)
  })

  it('returns 200 even when all rows fail (partial import is allowed)', async () => {
    const csv = [
      'name,email',
      ',invalid-no-name@test.com', // name is empty string
    ].join('\n')

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    // The route returns 200 with errors listed, not a 4xx
    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors).toHaveLength(1)
    expect(json.data.errors[0]).toContain('name required')
  })
})

// ============================================================================
// 2. POST /api/supplier/import/suppliers – missing file
// ============================================================================

describe('POST /api/supplier/import/suppliers – missing file', () => {
  it('returns 400 VALIDATION_ERROR when no file is attached', async () => {
    const req = makeRequestWithoutFile()
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.message).toBe('File required')
  })
})

// ============================================================================
// 3. POST /api/supplier/import/suppliers – invalid row data
// ============================================================================

describe('POST /api/supplier/import/suppliers – invalid data', () => {
  it('skips row and records error when supplier name is empty', async () => {
    const csv = [
      'name,email',
      '  ,empty-name@test.com',  // whitespace-only name
    ].join('\n')

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toMatch(/Row 2/)
  })

  it('records per-row errors with correct row numbers', async () => {
    const csv = [
      'name,email',
      'Valid Supplier,valid@test.com',
      ',no-name@test.com',
      ',another-no-name@test.com',
    ].join('\n')

    mockSupplierFindFirst.mockResolvedValueOnce(null)
    mockSupplierCreate.mockResolvedValueOnce({ id: 'id1', name: 'Valid Supplier' })

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(json.data.imported).toBe(1)
    expect(json.data.failed).toBe(2)
    expect(json.data.errors[0]).toMatch(/Row 3/)
    expect(json.data.errors[1]).toMatch(/Row 4/)
  })
})

// ============================================================================
// 4. POST /api/supplier/import/suppliers – duplicate handling
// ============================================================================

describe('POST /api/supplier/import/suppliers – duplicate handling', () => {
  it('skips duplicate supplier and records error', async () => {
    const csv = [
      'name,email',
      'Farine du Maroc,contact@farine.ma',
    ].join('\n')

    // Simulate existing supplier with same name
    mockSupplierFindFirst.mockResolvedValueOnce({
      id: SUPPLIER_ID,
      name: 'Farine du Maroc',
    })

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toContain("already exists")
    expect(mockSupplierCreate).not.toHaveBeenCalled()
  })

  it('imports unique rows and skips duplicate rows in the same batch', async () => {
    const csv = [
      'name,email',
      'Unique Supplier,unique@test.com',
      'Duplicate Supplier,dup@test.com',
    ].join('\n')

    mockSupplierFindFirst
      .mockResolvedValueOnce(null)                               // Unique: not found
      .mockResolvedValueOnce({ id: 'existing', name: 'Duplicate Supplier' }) // Duplicate: found

    mockSupplierCreate.mockResolvedValueOnce({
      id: 'new-id',
      name: 'Unique Supplier',
      status: 'ACTIVE',
    })

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(json.data.imported).toBe(1)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toContain('already exists')
  })
})

// ============================================================================
// 5. POST /api/supplier/import/suppliers – mixed valid/invalid rows
// ============================================================================

describe('POST /api/supplier/import/suppliers – mixed rows', () => {
  it('reports accurate imported and failed counts for a mixed batch', async () => {
    const csv = [
      'name,email,city',
      'Good Supplier,good@test.com,Casablanca',
      ',bad-no-name@test.com,Rabat',
      'Another Good,another@test.com,Fes',
    ].join('\n')

    mockSupplierFindFirst
      .mockResolvedValueOnce(null)  // Good Supplier: not duplicate
      .mockResolvedValueOnce(null)  // Another Good: not duplicate

    mockSupplierCreate
      .mockResolvedValueOnce({ id: 'id1', name: 'Good Supplier', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'id2', name: 'Another Good', status: 'ACTIVE' })

    const req = makeImportRequest(csv)
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(2)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors).toHaveLength(1)
    expect(json.data.errors[0]).toMatch(/Row 3/)
  })
})

// ============================================================================
// 6. POST /api/supplier/import/suppliers – role checks
// ============================================================================

describe('POST /api/supplier/import/suppliers – role checks', () => {
  it('returns 403 when user is MANAGER (ADMIN only)', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeImportRequest('name\nTest Supplier')
    const res = await importSuppliers(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(mockSupplierCreate).not.toHaveBeenCalled()
  })

  it('returns 403 when user is WORKER (ADMIN only)', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const req = makeImportRequest('name\nTest Supplier')
    const res = await importSuppliers(req)

    expect(res.status).toBe(403)
    expect(mockSupplierCreate).not.toHaveBeenCalled()
  })

  it('returns 401 when no auth token present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const req = makeImportRequest('name\nTest Supplier')
    const res = await importSuppliers(req)

    expect(res.status).toBe(401)
  })
})

// ============================================================================
// 7. POST /api/supplier/import/catalogs – valid CSV data
// ============================================================================

describe('POST /api/supplier/import/catalogs – valid data', () => {
  it('imports a single valid catalog row and returns imported count', async () => {
    const csv = [
      'supplierId,materialId,unitPrice,minOrderQty,leadTimeDays',
      `${SUPPLIER_ID},${MATERIAL_ID},12.50,50,7`,
    ].join('\n')

    const createdEntry = {
      id: CATALOG_ID,
      supplierId: SUPPLIER_ID,
      materialId: MATERIAL_ID,
      unitPrice: 12.5,
      minOrderQty: 50,
      leadTimeDays: 7,
    }

    mockSupplierFindUnique.mockResolvedValueOnce({ id: SUPPLIER_ID, name: 'Test Supplier' })
    mockMaterialFindUnique.mockResolvedValueOnce({ id: MATERIAL_ID, name: 'Flour' })
    mockCatalogFindUnique.mockResolvedValueOnce(null)   // not a duplicate
    mockCatalogCreate.mockResolvedValueOnce(createdEntry)

    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.imported).toBe(1)
    expect(json.data.failed).toBe(0)
    expect(json.data.errors).toHaveLength(0)
  })

  it('imports multiple valid catalog rows', async () => {
    const MATERIAL_ID_2 = 'clh3v2y0k0099356pk1b6vxxt'
    const csv = [
      'supplierId,materialId,unitPrice,minOrderQty,leadTimeDays',
      `${SUPPLIER_ID},${MATERIAL_ID},10.00,25,5`,
      `${SUPPLIER_ID},${MATERIAL_ID_2},8.50,100,3`,
    ].join('\n')

    mockSupplierFindUnique.mockResolvedValue({ id: SUPPLIER_ID })
    mockMaterialFindUnique
      .mockResolvedValueOnce({ id: MATERIAL_ID })
      .mockResolvedValueOnce({ id: MATERIAL_ID_2 })
    mockCatalogFindUnique.mockResolvedValue(null)
    mockCatalogCreate
      .mockResolvedValueOnce({ id: 'cat1' })
      .mockResolvedValueOnce({ id: 'cat2' })

    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(2)
    expect(json.data.failed).toBe(0)
  })
})

// ============================================================================
// 8. POST /api/supplier/import/catalogs – missing file
// ============================================================================

describe('POST /api/supplier/import/catalogs – missing file', () => {
  it('returns 400 VALIDATION_ERROR when no file is attached', async () => {
    const formData = new FormData()
    const req = new NextRequest('http://localhost/api/supplier/import/catalogs', {
      method: 'POST',
      body: formData,
    })

    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.message).toBe('File required')
  })
})

// ============================================================================
// 9. POST /api/supplier/import/catalogs – supplier not found
// ============================================================================

describe('POST /api/supplier/import/catalogs – supplier not found', () => {
  it('skips row and records error when supplier does not exist', async () => {
    const csv = [
      'supplierId,materialId,unitPrice,minOrderQty,leadTimeDays',
      `nonexistent-id,${MATERIAL_ID},10.00,25,5`,
    ].join('\n')

    mockSupplierFindUnique.mockResolvedValueOnce(null) // supplier not found

    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toContain('supplier not found')
    expect(mockCatalogCreate).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 10. POST /api/supplier/import/catalogs – duplicate catalog entry
// ============================================================================

describe('POST /api/supplier/import/catalogs – duplicate handling', () => {
  it('skips row and records error when catalog entry already exists', async () => {
    const csv = [
      'supplierId,materialId,unitPrice,minOrderQty,leadTimeDays',
      `${SUPPLIER_ID},${MATERIAL_ID},12.50,50,7`,
    ].join('\n')

    mockSupplierFindUnique.mockResolvedValueOnce({ id: SUPPLIER_ID })
    mockMaterialFindUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
    mockCatalogFindUnique.mockResolvedValueOnce({ id: CATALOG_ID }) // already exists

    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toContain('already exists')
    expect(mockCatalogCreate).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 11. POST /api/supplier/import/catalogs – role checks
// ============================================================================

describe('POST /api/supplier/import/catalogs – role checks', () => {
  it('returns 403 when user is MANAGER (ADMIN only)', async () => {
    mockGetToken.mockResolvedValueOnce(
      MANAGER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const csv = `supplierId,materialId,unitPrice,minOrderQty,leadTimeDays\n${SUPPLIER_ID},${MATERIAL_ID},10,25,5`
    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(mockCatalogCreate).not.toHaveBeenCalled()
  })

  it('returns 403 when user is WORKER (ADMIN only)', async () => {
    mockGetToken.mockResolvedValueOnce(
      WORKER_TOKEN as ReturnType<typeof mockGetToken> extends Promise<infer T> ? T : never,
    )

    const csv = `supplierId,materialId,unitPrice,minOrderQty,leadTimeDays\n${SUPPLIER_ID},${MATERIAL_ID},10,25,5`
    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)

    expect(res.status).toBe(403)
  })

  it('returns 401 when no auth token present', async () => {
    mockGetToken.mockResolvedValueOnce(null)

    const csv = `supplierId,materialId,unitPrice,minOrderQty,leadTimeDays\n${SUPPLIER_ID},${MATERIAL_ID},10,25,5`
    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)

    expect(res.status).toBe(401)
  })
})

// ============================================================================
// 12. POST /api/supplier/import/catalogs – material not found
// ============================================================================

describe('POST /api/supplier/import/catalogs – material not found', () => {
  it('skips row and records error when raw material does not exist', async () => {
    const csv = [
      'supplierId,materialId,unitPrice,minOrderQty,leadTimeDays',
      `${SUPPLIER_ID},nonexistent-material-id,10.00,25,5`,
    ].join('\n')

    mockSupplierFindUnique.mockResolvedValueOnce({ id: SUPPLIER_ID })
    mockMaterialFindUnique.mockResolvedValueOnce(null) // material not found

    const req = makeImportCatalogRequest(csv)
    const res = await importCatalogs(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.imported).toBe(0)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors[0]).toContain('material not found')
    expect(mockCatalogCreate).not.toHaveBeenCalled()
  })
})
