/**
 * lib/__tests__/purchase-order-service.test.ts
 *
 * Unit tests for lib/services/purchase-order-service.ts
 *
 * Strategy:
 *  - Mock @/lib/db at the module level so every Prisma call used by
 *    PurchaseOrderService becomes a jest.fn() under our control.
 *  - db.$transaction is mocked to execute the callback with a tx object
 *    that has the same fake methods, allowing atomic block tests without
 *    a real database.
 *  - Tests verify happy-path shapes AND that the correct custom error class
 *    (PONotFoundError, POError) is thrown in negative scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: @/lib/db
// ---------------------------------------------------------------------------

// tx is the transactional client used inside db.$transaction callbacks.
const mockTx = {
  purchaseOrder: {
    update: jest.fn(),
  },
  labStock: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  supplierPerformanceMetric: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/db', () => ({
  db: {
    productionLab: {
      findUnique: jest.fn(),
    },
    rawMaterial: {
      findUnique: jest.fn(),
    },
    supplierCatalog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    purchaseOrderSuggestion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    purchaseOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    // $transaction executes the callback with mockTx
    $transaction: jest.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from '@/lib/db'
import {
  PurchaseOrderService,
  POError,
  PONotFoundError,
} from '@/lib/services/purchase-order-service'
import { Decimal } from '@prisma/client/runtime/library'

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------

const mockLab         = db.productionLab   as jest.Mocked<typeof db.productionLab>
const mockMaterial    = db.rawMaterial     as jest.Mocked<typeof db.rawMaterial>
const mockCatalog     = db.supplierCatalog as jest.Mocked<typeof db.supplierCatalog>
const mockSuggestion  = db.purchaseOrderSuggestion as jest.Mocked<typeof db.purchaseOrderSuggestion>
const mockPO          = db.purchaseOrder   as jest.Mocked<typeof db.purchaseOrder>
const mockTransaction = db.$transaction    as jest.MockedFunction<typeof db.$transaction>

// ---------------------------------------------------------------------------
// Shared CUIDs
// ---------------------------------------------------------------------------

const LAB_ID         = 'clh3v2y0k0000bbb0000000001'
const MATERIAL_ID    = 'clh3v2y0k0000bbb0000000002'
const SUPPLIER_ID    = 'clh3v2y0k0000bbb0000000003'
const SUGGESTION_ID  = 'clh3v2y0k0000bbb0000000004'
const CATALOG_ID     = 'clh3v2y0k0000bbb0000000005'
const PO_ID          = 'clh3v2y0k0000bbb0000000006'
const LAB_STOCK_ID   = 'clh3v2y0k0000bbb0000000007'
const APPROVED_BY    = 'user-admin-001'

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeLab(overrides: Record<string, unknown> = {}) {
  return { id: LAB_ID, name: 'Lab Alpha', capacity: 10, ...overrides }
}

function makeMaterial(overrides: Record<string, unknown> = {}) {
  return { id: MATERIAL_ID, name: 'Rose Oil', type: 'FRAGRANCE', unit: 'ml', ...overrides }
}

function makeCatalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: CATALOG_ID,
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    unitPrice: 30.0,
    minOrderQty: 5,
    leadTimeDays: 10,
    isActive: true,
    supplier: { id: SUPPLIER_ID, name: 'Acme', performanceMetric: { reliabilityScore: 85 } },
    ...overrides,
  }
}

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: SUGGESTION_ID,
    labId: LAB_ID,
    materialId: MATERIAL_ID,
    supplierId: SUPPLIER_ID,
    suggestedQty: new Decimal('50'),
    reasoning: 'Stock below minimum threshold',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-04-01'),
    supplier: { id: SUPPLIER_ID, name: 'Acme', catalogs: [makeCatalogEntry()] },
    material: makeMaterial(),
    lab: makeLab(),
    ...overrides,
  }
}

function makePO(overrides: Record<string, unknown> = {}) {
  return {
    id: PO_ID,
    poNumber: 'PO-1234567890-ABC',
    supplierId: SUPPLIER_ID,
    materialId: MATERIAL_ID,
    quantity: new Decimal('50'),
    status: 'PENDING',
    approvedBy: APPROVED_BY,
    expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    actualDeliveryDate: null,
    receivedQuantity: null,
    qualityInspectionId: null,
    createdAt: new Date('2026-04-01'),
    supplier: { id: SUPPLIER_ID, name: 'Acme' },
    material: makeMaterial(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()

  // Default: $transaction runs the callback immediately with mockTx
  mockTransaction.mockImplementation(async (fn: any) => fn(mockTx))
})

// ============================================================================
// Service instance
// ============================================================================

const service = new PurchaseOrderService()

// ============================================================================
// suggestPurchaseOrder
// ============================================================================

describe('suggestPurchaseOrder', () => {
  const validInput = {
    labId: LAB_ID,
    materialId: MATERIAL_ID,
    suggestedQty: 50,
    reasoning: 'Stock below minimum threshold',
  }

  it('creates and returns a PO suggestion when lab, material, and active supplier exist', async () => {
    mockLab.findUnique.mockResolvedValueOnce(makeLab() as any)
    mockMaterial.findUnique.mockResolvedValueOnce(makeMaterial() as any)
    mockCatalog.findMany.mockResolvedValueOnce([makeCatalogEntry()] as any)
    const created = makeSuggestion()
    mockSuggestion.create.mockResolvedValueOnce(created as any)

    const result = await service.suggestPurchaseOrder(validInput)

    expect(result).toEqual(created)
    expect(mockSuggestion.create).toHaveBeenCalledTimes(1)
    const createArg = mockSuggestion.create.mock.calls[0][0] as any
    expect(createArg.data.status).toBe('PENDING')
    expect(createArg.data.labId).toBe(LAB_ID)
    expect(createArg.data.materialId).toBe(MATERIAL_ID)
    expect(createArg.data.supplierId).toBe(SUPPLIER_ID)
  })

  it('throws POError when lab does not exist', async () => {
    mockLab.findUnique.mockResolvedValueOnce(null)

    await expect(service.suggestPurchaseOrder(validInput)).rejects.toBeInstanceOf(POError)
    expect(mockMaterial.findUnique).not.toHaveBeenCalled()
    expect(mockSuggestion.create).not.toHaveBeenCalled()
  })

  it('throws POError when material does not exist', async () => {
    mockLab.findUnique.mockResolvedValueOnce(makeLab() as any)
    mockMaterial.findUnique.mockResolvedValueOnce(null)

    await expect(service.suggestPurchaseOrder(validInput)).rejects.toBeInstanceOf(POError)
    expect(mockSuggestion.create).not.toHaveBeenCalled()
  })

  it('throws POError when no active suppliers exist for the material', async () => {
    mockLab.findUnique.mockResolvedValueOnce(makeLab() as any)
    mockMaterial.findUnique.mockResolvedValueOnce(makeMaterial() as any)
    mockCatalog.findMany.mockResolvedValueOnce([] as any) // no active catalogs

    await expect(service.suggestPurchaseOrder(validInput)).rejects.toBeInstanceOf(POError)
    expect(mockSuggestion.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// getPendingSuggestions
// ============================================================================

describe('getPendingSuggestions', () => {
  it('returns paginated pending suggestions using defaults when no filters provided', async () => {
    const suggestions = [makeSuggestion()]
    mockSuggestion.findMany.mockResolvedValueOnce(suggestions as any)

    const result = await service.getPendingSuggestions()

    expect(result).toHaveLength(1)
    const callArg = mockSuggestion.findMany.mock.calls[0][0] as any
    expect(callArg.where.status).toBe('PENDING')
    expect(callArg.take).toBe(20) // default limit
    expect(callArg.skip).toBe(0)  // page 1
  })

  it('applies labId filter when provided', async () => {
    mockSuggestion.findMany.mockResolvedValueOnce([] as any)

    await service.getPendingSuggestions({ labId: LAB_ID })

    const callArg = mockSuggestion.findMany.mock.calls[0][0] as any
    expect(callArg.where.labId).toBe(LAB_ID)
  })

  it('respects custom page and limit', async () => {
    mockSuggestion.findMany.mockResolvedValueOnce([] as any)

    await service.getPendingSuggestions({ page: 3, limit: 5 })

    const callArg = mockSuggestion.findMany.mock.calls[0][0] as any
    expect(callArg.take).toBe(5)
    expect(callArg.skip).toBe(10) // (3 - 1) * 5
  })
})

// ============================================================================
// approveSuggestion
// ============================================================================

describe('approveSuggestion', () => {
  it('creates a PO using suggestion defaults and marks suggestion as APPROVED', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(makeSuggestion() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(makeCatalogEntry() as any)
    const po = makePO()
    mockPO.create.mockResolvedValueOnce(po as any)
    mockSuggestion.update.mockResolvedValueOnce({} as any)

    const result = await service.approveSuggestion(SUGGESTION_ID, { approvedBy: APPROVED_BY })

    expect(result).toEqual(po)
    // Suggestion marked APPROVED
    const updateArg = mockSuggestion.update.mock.calls[0][0] as any
    expect(updateArg.data.status).toBe('APPROVED')
    expect(updateArg.data.approvedAt).toBeDefined()
  })

  it('uses qtyOverride when provided', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(makeSuggestion() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(makeCatalogEntry() as any)
    mockPO.create.mockResolvedValueOnce(makePO() as any)
    mockSuggestion.update.mockResolvedValueOnce({} as any)

    await service.approveSuggestion(SUGGESTION_ID, { approvedBy: APPROVED_BY, qtyOverride: 75 })

    const createArg = mockPO.create.mock.calls[0][0] as any
    expect(createArg.data.quantity.toString()).toBe('75')
  })

  it('uses supplierId override when provided and validates catalog exists', async () => {
    const altSupplierId = 'clh3v2y0k0000alt0000000001'
    mockSuggestion.findUnique.mockResolvedValueOnce(makeSuggestion() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(
      makeCatalogEntry({ supplierId: altSupplierId }) as any,
    )
    mockPO.create.mockResolvedValueOnce(makePO({ supplierId: altSupplierId }) as any)
    mockSuggestion.update.mockResolvedValueOnce({} as any)

    const result = await service.approveSuggestion(SUGGESTION_ID, {
      approvedBy: APPROVED_BY,
      supplierId: altSupplierId,
    })

    const createArg = mockPO.create.mock.calls[0][0] as any
    expect(createArg.data.supplierId).toBe(altSupplierId)
  })

  it('throws PONotFoundError when suggestion does not exist', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(null)

    await expect(
      service.approveSuggestion('ghost-id', { approvedBy: APPROVED_BY }),
    ).rejects.toBeInstanceOf(PONotFoundError)

    expect(mockPO.create).not.toHaveBeenCalled()
  })

  it('throws POError when selected supplier has no catalog for the material', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(makeSuggestion() as any)
    mockCatalog.findUnique.mockResolvedValueOnce(null) // no catalog

    await expect(
      service.approveSuggestion(SUGGESTION_ID, { approvedBy: APPROVED_BY }),
    ).rejects.toBeInstanceOf(POError)

    expect(mockPO.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// rejectSuggestion
// ============================================================================

describe('rejectSuggestion', () => {
  it('marks suggestion as REJECTED with rejectionReason', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(makeSuggestion() as any)
    const rejected = makeSuggestion({ status: 'REJECTED', rejectionReason: 'Budget freeze' })
    mockSuggestion.update.mockResolvedValueOnce(rejected as any)

    const result = await service.rejectSuggestion(SUGGESTION_ID, 'Budget freeze')

    expect(result.status).toBe('REJECTED')
    const callArg = mockSuggestion.update.mock.calls[0][0] as any
    expect(callArg.data.status).toBe('REJECTED')
    expect(callArg.data.rejectionReason).toBe('Budget freeze')
    expect(callArg.data.rejectedAt).toBeDefined()
  })

  it('throws PONotFoundError when suggestion does not exist', async () => {
    mockSuggestion.findUnique.mockResolvedValueOnce(null)

    await expect(
      service.rejectSuggestion('ghost-id', 'Not needed'),
    ).rejects.toBeInstanceOf(PONotFoundError)

    expect(mockSuggestion.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// receivePurchaseOrder
// ============================================================================

describe('receivePurchaseOrder', () => {
  it('marks PO as DELIVERED, updates lab stock, and updates performance metrics atomically', async () => {
    const pastDelivery = new Date(Date.now() - 1000) // already past — on-time
    const po = makePO({
      expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // future deadline
      material: makeMaterial(),
    })
    mockPO.findUnique.mockResolvedValueOnce(po as any)

    // tx mocks
    const deliveredPO = makePO({ status: 'DELIVERED', actualDeliveryDate: new Date() })
    mockTx.purchaseOrder.update.mockResolvedValueOnce(deliveredPO as any)
    mockTx.labStock.findFirst.mockResolvedValueOnce({
      id: LAB_STOCK_ID,
      materialId: MATERIAL_ID,
      quantity: new Decimal('100'),
    } as any)
    mockTx.labStock.update.mockResolvedValueOnce({} as any)
    mockTx.supplierPerformanceMetric.findUnique.mockResolvedValueOnce({
      supplierId: SUPPLIER_ID,
      totalDelivered: 9,
      onTimeCount: 8,
      onTimePercent: 89,
    } as any)
    mockTx.supplierPerformanceMetric.update.mockResolvedValueOnce({} as any)

    const result = await service.receivePurchaseOrder(PO_ID, {})

    expect(result.status).toBe('DELIVERED')
    // Verify lab stock was updated
    expect(mockTx.labStock.update).toHaveBeenCalledTimes(1)
    // Verify performance metric was updated
    expect(mockTx.supplierPerformanceMetric.update).toHaveBeenCalledTimes(1)
  })

  it('uses provided receivedQuantity over PO quantity', async () => {
    const po = makePO({
      quantity: new Decimal('50'),
      expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    mockPO.findUnique.mockResolvedValueOnce(po as any)

    const deliveredPO = makePO({ status: 'DELIVERED', receivedQuantity: new Decimal('40') })
    mockTx.purchaseOrder.update.mockResolvedValueOnce(deliveredPO as any)
    mockTx.labStock.findFirst.mockResolvedValueOnce(null) // no stock record — no update
    mockTx.supplierPerformanceMetric.findUnique.mockResolvedValueOnce(null) // no metric — no update

    await service.receivePurchaseOrder(PO_ID, { receivedQuantity: 40 })

    const updateArg = mockTx.purchaseOrder.update.mock.calls[0][0] as any
    expect(updateArg.data.receivedQuantity.toString()).toBe('40')
  })

  it('skips lab stock update when no matching LabStock record exists', async () => {
    const po = makePO({ expectedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    mockPO.findUnique.mockResolvedValueOnce(po as any)

    mockTx.purchaseOrder.update.mockResolvedValueOnce(makePO({ status: 'DELIVERED' }) as any)
    mockTx.labStock.findFirst.mockResolvedValueOnce(null) // no stock entry
    mockTx.supplierPerformanceMetric.findUnique.mockResolvedValueOnce(null)

    await service.receivePurchaseOrder(PO_ID, {})

    expect(mockTx.labStock.update).not.toHaveBeenCalled()
  })

  it('throws PONotFoundError when PO does not exist', async () => {
    mockPO.findUnique.mockResolvedValueOnce(null)

    await expect(service.receivePurchaseOrder('ghost-po', {})).rejects.toBeInstanceOf(
      PONotFoundError,
    )

    // $transaction should never be entered
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
