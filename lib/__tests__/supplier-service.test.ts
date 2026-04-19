/**
 * lib/__tests__/supplier-service.test.ts
 *
 * Unit tests for lib/services/supplier-service.ts
 *
 * Strategy:
 *  - Mock @/lib/db so the exported `db` object has jest.fn() on every
 *    Prisma model method used by SupplierService.
 *  - No real database is touched; every test controls mock return values.
 *  - Tests verify happy-path returns AND that the correct custom error
 *    class is thrown on not-found / duplicate / validation scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: @/lib/db
// ---------------------------------------------------------------------------

jest.mock('@/lib/db', () => ({
  db: {
    supplier: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    rawMaterial: {
      findUnique: jest.fn(),
    },
    supplierCatalog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from '@/lib/db'
import {
  SupplierService,
  SupplierNotFoundError,
  SupplierError,
  CatalogEntryAlreadyExistsError,
} from '@/lib/services/supplier-service'

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------

const mockSupplier     = db.supplier     as jest.Mocked<typeof db.supplier>
const mockRawMaterial  = db.rawMaterial  as jest.Mocked<typeof db.rawMaterial>
const mockCatalog      = db.supplierCatalog as jest.Mocked<typeof db.supplierCatalog>

// ---------------------------------------------------------------------------
// Shared CUIDs
// ---------------------------------------------------------------------------

const SUPPLIER_ID  = 'clh3v2y0k0000aaa0000000001'
const MATERIAL_ID  = 'clh3v2y0k0000aaa0000000002'
const CATALOG_ID   = 'clh3v2y0k0000aaa0000000003'

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id: SUPPLIER_ID,
    name: 'Acme Supplies',
    email: 'acme@example.com',
    phone: '+1-800-000-0000',
    address: '1 Supply Lane',
    city: 'Sourceville',
    contactPerson: 'Alice',
    categories: ['FRAGRANCE', 'WAX'],
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    performanceMetric: null,
    catalogs: [],
    categoryPerformance: [],
    ...overrides,
  }
}

function makeCatalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: CATALOG_ID,
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    unitPrice: 25.0,
    minOrderQty: 10,
    leadTimeDays: 7,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    material: { id: MATERIAL_ID, name: 'Rose Essential Oil' },
    ...overrides,
  }
}

function makeMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id: MATERIAL_ID,
    name: 'Rose Essential Oil',
    type: 'FRAGRANCE',
    unit: 'ml',
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
// Service instance
// ============================================================================

const service = new SupplierService()

// ============================================================================
// createSupplier
// ============================================================================

describe('createSupplier', () => {
  it('creates and returns a supplier with ACTIVE status', async () => {
    const input = {
      name: 'Acme Supplies',
      email: 'acme@example.com',
      phone: '+1-800-000-0000',
      address: '1 Supply Lane',
      city: 'Sourceville',
      contactPerson: 'Alice',
      categories: ['FRAGRANCE'],
    }
    const created = makeSupplier()
    mockSupplier.create.mockResolvedValueOnce(created as any)

    const result = await service.createSupplier(input)

    expect(result).toEqual(created)
    expect(mockSupplier.create).toHaveBeenCalledTimes(1)
    const callArg = mockSupplier.create.mock.calls[0][0]
    expect(callArg.data.name).toBe('Acme Supplies')
    expect(callArg.data.status).toBe('ACTIVE')
  })

  it('propagates database errors from prisma.supplier.create', async () => {
    mockSupplier.create.mockRejectedValueOnce(new Error('DB constraint violated'))

    const input = {
      name: 'Duplicate Name',
      categories: [],
    }

    await expect(service.createSupplier(input as any)).rejects.toThrow('DB constraint violated')
  })
})

// ============================================================================
// getSupplier
// ============================================================================

describe('getSupplier', () => {
  it('returns supplier with catalogs and performanceMetric when found', async () => {
    const supplier = makeSupplier({
      catalogs: [makeCatalogEntry()],
      performanceMetric: { reliabilityScore: 90 },
    })
    mockSupplier.findUnique.mockResolvedValueOnce(supplier as any)

    const result = await service.getSupplier(SUPPLIER_ID)

    expect(result).toEqual(supplier)
    expect(mockSupplier.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUPPLIER_ID } }),
    )
    // Must include catalogs and performanceMetric in the include
    const callArg = mockSupplier.findUnique.mock.calls[0][0] as any
    expect(callArg.include).toBeDefined()
    expect(callArg.include.catalogs).toBeDefined()
    expect(callArg.include.performanceMetric).toBe(true)
  })

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(service.getSupplier('nonexistent-id')).rejects.toBeInstanceOf(
      SupplierNotFoundError,
    )
  })

  it('SupplierNotFoundError message contains the requested id', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    try {
      await service.getSupplier('missing-id-xyz')
    } catch (err) {
      expect(err).toBeInstanceOf(SupplierNotFoundError)
      expect((err as Error).message).toContain('missing-id-xyz')
    }
  })
})

// ============================================================================
// listSuppliers
// ============================================================================

describe('listSuppliers', () => {
  it('returns paginated results with correct total', async () => {
    const suppliers = [makeSupplier()]
    mockSupplier.findMany.mockResolvedValueOnce(suppliers as any)
    mockSupplier.count.mockResolvedValueOnce(1)

    const result = await service.listSuppliers({ page: 1, limit: 20 })

    expect(result.suppliers).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('applies status filter to the Prisma where clause', async () => {
    mockSupplier.findMany.mockResolvedValueOnce([] as any)
    mockSupplier.count.mockResolvedValueOnce(0)

    await service.listSuppliers({ page: 1, limit: 20, status: 'INACTIVE' })

    const whereArg = mockSupplier.count.mock.calls[0][0]?.where
    expect(whereArg).toMatchObject({ status: 'INACTIVE' })
  })

  it('applies search filter as OR clause on name and email', async () => {
    mockSupplier.findMany.mockResolvedValueOnce([] as any)
    mockSupplier.count.mockResolvedValueOnce(0)

    await service.listSuppliers({ page: 1, limit: 20, search: 'acme' })

    const whereArg = mockSupplier.count.mock.calls[0][0]?.where
    expect(whereArg.OR).toBeDefined()
    expect(whereArg.OR).toHaveLength(2)
  })

  it('returns empty results without error when no suppliers match', async () => {
    mockSupplier.findMany.mockResolvedValueOnce([] as any)
    mockSupplier.count.mockResolvedValueOnce(0)

    const result = await service.listSuppliers({ page: 1, limit: 20 })

    expect(result.suppliers).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ============================================================================
// updateSupplier
// ============================================================================

describe('updateSupplier', () => {
  it('updates and returns the supplier when found', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    const updated = makeSupplier({ city: 'NewCity' })
    mockSupplier.update.mockResolvedValueOnce(updated as any)

    const result = await service.updateSupplier(SUPPLIER_ID, { city: 'NewCity' })

    expect(result).toEqual(updated)
    expect(mockSupplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUPPLIER_ID },
        data: { city: 'NewCity' },
      }),
    )
  })

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(
      service.updateSupplier('missing-id', { city: 'NewCity' }),
    ).rejects.toBeInstanceOf(SupplierNotFoundError)
  })

  it('handles partial update — only passes provided fields to Prisma', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    const updated = makeSupplier({ phone: '+1-999-999-9999' })
    mockSupplier.update.mockResolvedValueOnce(updated as any)

    await service.updateSupplier(SUPPLIER_ID, { phone: '+1-999-999-9999' })

    const callArg = mockSupplier.update.mock.calls[0][0] as any
    expect(callArg.data).toEqual({ phone: '+1-999-999-9999' })
  })
})

// ============================================================================
// deactivateSupplier
// ============================================================================

describe('deactivateSupplier', () => {
  it('sets status to INACTIVE when supplier exists', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    const deactivated = makeSupplier({ status: 'INACTIVE' })
    mockSupplier.update.mockResolvedValueOnce(deactivated as any)

    const result = await service.deactivateSupplier(SUPPLIER_ID)

    expect(result.status).toBe('INACTIVE')
    const callArg = mockSupplier.update.mock.calls[0][0] as any
    expect(callArg.data).toEqual({ status: 'INACTIVE' })
    expect(callArg.where).toEqual({ id: SUPPLIER_ID })
  })

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(service.deactivateSupplier('ghost-id')).rejects.toBeInstanceOf(
      SupplierNotFoundError,
    )
    // Prisma update must NOT be called
    expect(mockSupplier.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// addToSupplierCatalog
// ============================================================================

describe('addToSupplierCatalog', () => {
  const validCatalogInput = {
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    unitPrice: 25.0,
    minOrderQty: 10,
    leadTimeDays: 7,
  }

  it('creates and returns catalog entry when supplier and material exist and no duplicate', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    mockRawMaterial.findUnique.mockResolvedValueOnce(makeMaterial() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(null) // no duplicate
    const created = makeCatalogEntry()
    mockCatalog.create.mockResolvedValueOnce(created as any)

    const result = await service.addToSupplierCatalog(validCatalogInput)

    expect(result).toEqual(created)
    expect(mockCatalog.create).toHaveBeenCalledTimes(1)
  })

  it('throws SupplierNotFoundError when supplier does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(service.addToSupplierCatalog(validCatalogInput)).rejects.toBeInstanceOf(
      SupplierNotFoundError,
    )
    expect(mockRawMaterial.findUnique).not.toHaveBeenCalled()
    expect(mockCatalog.create).not.toHaveBeenCalled()
  })

  it('throws SupplierError when material does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    mockRawMaterial.findUnique.mockResolvedValueOnce(null)

    await expect(service.addToSupplierCatalog(validCatalogInput)).rejects.toBeInstanceOf(
      SupplierError,
    )
    expect(mockCatalog.create).not.toHaveBeenCalled()
  })

  it('throws CatalogEntryAlreadyExistsError (409) when entry already exists', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(makeSupplier() as any)
    mockRawMaterial.findUnique.mockResolvedValueOnce(makeMaterial() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(makeCatalogEntry() as any) // duplicate

    await expect(service.addToSupplierCatalog(validCatalogInput)).rejects.toBeInstanceOf(
      CatalogEntryAlreadyExistsError,
    )
    expect(mockCatalog.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// removeCatalogEntry
// ============================================================================

describe('removeCatalogEntry', () => {
  it('calls prisma.supplierCatalog.delete with the correct id', async () => {
    const entry = makeCatalogEntry()
    mockCatalog.delete.mockResolvedValueOnce(entry as any)

    const result = await service.removeCatalogEntry(CATALOG_ID)

    expect(result).toEqual(entry)
    expect(mockCatalog.delete).toHaveBeenCalledWith({ where: { id: CATALOG_ID } })
  })

  it('propagates not-found errors thrown by Prisma on delete', async () => {
    mockCatalog.delete.mockRejectedValueOnce(
      Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' }),
    )

    await expect(service.removeCatalogEntry('nonexistent-catalog-id')).rejects.toThrow(
      'Record to delete does not exist',
    )
  })
})
