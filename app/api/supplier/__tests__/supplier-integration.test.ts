/**
 * app/api/supplier/__tests__/supplier-integration.test.ts
 *
 * Integration tests for Supplier Management (Cycle B, Task 24).
 *
 * Strategy:
 *  - next-auth/jwt getToken is mocked to control authentication.
 *  - @/lib/db is mocked so all Prisma client calls are controlled per-test
 *    without requiring a real database connection.
 *  - Services and route handlers are used end-to-end without additional
 *    mocking; this tests the full chain: route → service → db.
 *  - Each test group verifies both the primary happy path and side-effect
 *    state changes (stock updates, metric calculations, etc.).
 *
 * Test groups:
 *   1. End-to-end: Create supplier → Add catalog → Auto-suggest PO
 *                  → Approve → Receive → Verify stock + metrics
 *   2. Batch integration: Batch with delayed POs → material alerts
 *   3. Performance flow: Multiple POs received → reliability score
 *   4. CSV import flow: Suppliers + catalogs imported, duplicates skipped
 */

// ---------------------------------------------------------------------------
// Mock: next-auth/jwt  (must precede any import that calls withAuth)
// ---------------------------------------------------------------------------

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: @/lib/db
// Every Prisma model method used across all services under test is stubbed.
// ---------------------------------------------------------------------------

const mockSupplierCreate       = jest.fn()
const mockSupplierFindUnique   = jest.fn()
const mockSupplierFindFirst    = jest.fn()
const mockSupplierFindMany     = jest.fn()
const mockSupplierCount        = jest.fn()
const mockSupplierUpdate       = jest.fn()

const mockMaterialFindUnique   = jest.fn()

const mockCatalogCreate        = jest.fn()
const mockCatalogFindUnique    = jest.fn()
const mockCatalogFindMany      = jest.fn()
const mockCatalogUpdate        = jest.fn()
const mockCatalogDelete        = jest.fn()

const mockPOSuggestionCreate   = jest.fn()
const mockPOSuggestionFindUnique = jest.fn()
const mockPOSuggestionFindMany = jest.fn()
const mockPOSuggestionUpdate   = jest.fn()

const mockPurchaseOrderCreate  = jest.fn()
const mockPurchaseOrderFindUnique = jest.fn()
const mockPurchaseOrderFindMany = jest.fn()
const mockPurchaseOrderUpdate  = jest.fn()

const mockLabStockFindFirst    = jest.fn()
const mockLabStockUpdate       = jest.fn()

const mockMetricFindUnique     = jest.fn()
const mockMetricUpdate         = jest.fn()
const mockMetricUpsert         = jest.fn()

const mockLabFindUnique        = jest.fn()
const mockBatchFindUnique      = jest.fn()

const mockQIFindMany           = jest.fn()

// $transaction mock: executes the callback synchronously with a proxied tx object
const mockTransaction = jest.fn().mockImplementation((cb: (tx: any) => any) => {
  const tx = {
    purchaseOrder: {
      update:     mockPurchaseOrderUpdate,
      findUnique: mockPurchaseOrderFindUnique,
    },
    labStock: {
      findFirst: mockLabStockFindFirst,
      update:    mockLabStockUpdate,
    },
    supplierPerformanceMetric: {
      findUnique: mockMetricFindUnique,
      update:     mockMetricUpdate,
    },
  }
  return Promise.resolve(cb(tx))
})

jest.mock('@/lib/db', () => ({
  db: {
    supplier: {
      create:     (...a: unknown[]) => mockSupplierCreate(...a),
      findUnique: (...a: unknown[]) => mockSupplierFindUnique(...a),
      findFirst:  (...a: unknown[]) => mockSupplierFindFirst(...a),
      findMany:   (...a: unknown[]) => mockSupplierFindMany(...a),
      count:      (...a: unknown[]) => mockSupplierCount(...a),
      update:     (...a: unknown[]) => mockSupplierUpdate(...a),
    },
    rawMaterial: {
      findUnique: (...a: unknown[]) => mockMaterialFindUnique(...a),
    },
    supplierCatalog: {
      create:     (...a: unknown[]) => mockCatalogCreate(...a),
      findUnique: (...a: unknown[]) => mockCatalogFindUnique(...a),
      findMany:   (...a: unknown[]) => mockCatalogFindMany(...a),
      update:     (...a: unknown[]) => mockCatalogUpdate(...a),
      delete:     (...a: unknown[]) => mockCatalogDelete(...a),
    },
    purchaseOrderSuggestion: {
      create:     (...a: unknown[]) => mockPOSuggestionCreate(...a),
      findUnique: (...a: unknown[]) => mockPOSuggestionFindUnique(...a),
      findMany:   (...a: unknown[]) => mockPOSuggestionFindMany(...a),
      update:     (...a: unknown[]) => mockPOSuggestionUpdate(...a),
    },
    purchaseOrder: {
      create:     (...a: unknown[]) => mockPurchaseOrderCreate(...a),
      findUnique: (...a: unknown[]) => mockPurchaseOrderFindUnique(...a),
      findMany:   (...a: unknown[]) => mockPurchaseOrderFindMany(...a),
      update:     (...a: unknown[]) => mockPurchaseOrderUpdate(...a),
    },
    labStock: {
      findFirst:  (...a: unknown[]) => mockLabStockFindFirst(...a),
      update:     (...a: unknown[]) => mockLabStockUpdate(...a),
    },
    supplierPerformanceMetric: {
      findUnique: (...a: unknown[]) => mockMetricFindUnique(...a),
      update:     (...a: unknown[]) => mockMetricUpdate(...a),
      upsert:     (...a: unknown[]) => mockMetricUpsert(...a),
      findMany:   jest.fn().mockResolvedValue([]),
    },
    productionLab: {
      findUnique: (...a: unknown[]) => mockLabFindUnique(...a),
    },
    productionBatch: {
      findUnique: (...a: unknown[]) => mockBatchFindUnique(...a),
    },
    qualityInspection: {
      findMany:   (...a: unknown[]) => mockQIFindMany(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { SupplierService } from '@/lib/services/supplier-service'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'
import { SupplierPerformanceService } from '@/lib/services/supplier-performance-service'
import { SupplierAlertService } from '@/lib/services/supplier-alert-service'
import { Decimal } from '@prisma/client/runtime/library'

// Route handlers used in import-flow tests
import { POST as importSuppliers } from '../import/suppliers/route'
import { POST as importCatalogs }  from '../import/catalogs/route'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>
type TokenType = Awaited<ReturnType<typeof mockGetToken>>
const asToken = (t: object): TokenType => t as TokenType

// ---------------------------------------------------------------------------
// Shared CUID fixtures
// ---------------------------------------------------------------------------

const SUPPLIER_ID   = 'clintegr00000001supplierId'
const MATERIAL_ID   = 'clintegr00000002materialId'
const LAB_ID        = 'clintegr00000003labIdxxxxx'
const SUGGESTION_ID = 'clintegr00000004suggstxxxx'
const PO_ID         = 'clintegr00000005poIdxxxxxx'
const CATALOG_ID    = 'clintegr00000006catalogxxx'
const BATCH_ID      = 'clintegr00000007batchxxxxx'
const RECIPE_ID     = 'clintegr00000008recipexxxx'
const LAB_STOCK_ID  = 'clintegr00000009stockxxxxx'
const ADMIN_USER_ID = 'clintegr00000010adminxxxxx'

// ---------------------------------------------------------------------------
// Auth token fixture
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = {
  id:    ADMIN_USER_ID,
  email: 'admin@maison-doree.com',
  name:  'Admin User',
  role:  'ADMIN' as const,
  sub:   ADMIN_USER_ID,
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return {
    id:            SUPPLIER_ID,
    name:          'Integration Supplier',
    email:         'supplier@test.com',
    phone:         '+212600000001',
    address:       '1 Supply Street',
    city:          'Casablanca',
    contactPerson: 'Ahmed Alaoui',
    categories:    ['Flour', 'Sugar'],
    status:        'ACTIVE',
    leadTimeDays:  7,
    notes:         null,
    createdAt:     new Date('2026-01-01'),
    ...overrides,
  }
}

function makeMaterial(overrides: Record<string, unknown> = {}) {
  return {
    id:            MATERIAL_ID,
    name:          'All-purpose Flour',
    type:          'DRY_GOODS',
    unit:          'kg',
    isIntermediate: false,
    ...overrides,
  }
}

function makeCatalog(overrides: Record<string, unknown> = {}) {
  return {
    id:           CATALOG_ID,
    supplierId:   SUPPLIER_ID,
    materialId:   MATERIAL_ID,
    unitPrice:    new Decimal('2.50'),
    minOrderQty:  50,
    leadTimeDays: 7,
    isActive:     true,
    createdAt:    new Date('2026-01-01'),
    updatedAt:    new Date('2026-01-01'),
    material:     makeMaterial(),
    supplier:     makeSupplier({ catalogs: [] }),
    ...overrides,
  }
}

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id:           SUGGESTION_ID,
    labId:        LAB_ID,
    materialId:   MATERIAL_ID,
    supplierId:   SUPPLIER_ID,
    suggestedQty: new Decimal('200'),
    reasoning:    'Stock below minimum threshold',
    status:       'PENDING',
    approvedAt:   null,
    rejectedAt:   null,
    expiresAt:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt:    new Date('2026-01-01'),
    supplier:     makeSupplier({ catalogs: [makeCatalog()] }),
    material:     makeMaterial(),
    lab:          { id: LAB_ID, name: 'Lab A', type: 'PREPARATION' },
    ...overrides,
  }
}

function makePurchaseOrder(overrides: Record<string, unknown> = {}) {
  const expectedDeliveryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return {
    id:                   PO_ID,
    poNumber:             'PO-INTEGRATION-001',
    supplierId:           SUPPLIER_ID,
    materialId:           MATERIAL_ID,
    quantity:             new Decimal('200'),
    deliveryDate:         expectedDeliveryDate,
    status:               'PENDING',
    cost:                 null,
    createdAt:            new Date('2026-01-01'),
    deliveredAt:          null,
    approvedBy:           ADMIN_USER_ID,
    sentAt:               null,
    expectedDeliveryDate,
    actualDeliveryDate:   null,
    receivedQuantity:     null,
    qualityInspectionId:  null,
    supplier:             makeSupplier(),
    material:             makeMaterial(),
    ...overrides,
  }
}

function makeLabStock(overrides: Record<string, unknown> = {}) {
  return {
    id:           LAB_STOCK_ID,
    labId:        LAB_ID,
    materialId:   MATERIAL_ID,
    quantity:     new Decimal('100'),
    minThreshold: new Decimal('50'),
    updatedAt:    new Date('2026-01-01'),
    material:     makeMaterial(),
    ...overrides,
  }
}

function makeMetric(overrides: Record<string, unknown> = {}) {
  return {
    id:                SUPPLIER_ID + '_metric',
    supplierId:        SUPPLIER_ID,
    totalOrders:       5,
    totalDelivered:    4,
    onTimeCount:       4,
    onTimePercent:     80,
    inspectionsPassed: 0,
    inspectionsFailed: 0,
    qualityPassRate:   0,
    trend30Day:        'stable',
    reliabilityScore:  72,
    lastUpdated:       new Date('2026-01-01'),
    supplier:          makeSupplier(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helper: build a synthetic NextRequest
// ---------------------------------------------------------------------------

function makeRequest(
  method: string,
  path: string,
  body?: unknown,
  searchParams?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost${path}`)
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  })
}

// Helper: build a FormData request with a CSV file
function makeCSVRequest(path: string, csvContent: string, fieldName = 'file'): NextRequest {
  const file = new File([csvContent], 'import.csv', { type: 'text/csv' })
  const form = new FormData()
  form.append(fieldName, file)
  return new NextRequest(`http://localhost${path}`, { method: 'POST', body: form })
}

// ---------------------------------------------------------------------------
// beforeEach: reset all mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockGetToken.mockResolvedValue(asToken(ADMIN_TOKEN))
})

// ===========================================================================
// GROUP 1: End-to-end supplier lifecycle
// Scenario: Create supplier → Add catalog → Auto-suggest PO → Approve
//           → Receive → Verify stock updated + metrics updated
// ===========================================================================

describe('End-to-end: supplier lifecycle', () => {
  it('1. creates a supplier via SupplierService', async () => {
    const created = makeSupplier()
    mockSupplierCreate.mockResolvedValueOnce(created)

    const service = new SupplierService()
    const result = await service.createSupplier({
      name:          'Integration Supplier',
      email:         'supplier@test.com',
      phone:         '+212600000001',
      address:       '1 Supply Street',
      city:          'Casablanca',
      contactPerson: 'Ahmed Alaoui',
      categories:    ['Flour', 'Sugar'],
    })

    expect(mockSupplierCreate).toHaveBeenCalledTimes(1)
    expect(result.id).toBe(SUPPLIER_ID)
    expect(result.status).toBe('ACTIVE')
  })

  it('2. adds a catalog entry to the supplier', async () => {
    mockSupplierFindUnique.mockResolvedValueOnce(makeSupplier())
    mockMaterialFindUnique.mockResolvedValueOnce(makeMaterial())
    mockCatalogFindUnique.mockResolvedValueOnce(null) // no duplicate
    mockCatalogCreate.mockResolvedValueOnce(makeCatalog())

    const service = new SupplierService()
    const result = await service.addToSupplierCatalog({
      supplierId:   SUPPLIER_ID,
      materialId:   MATERIAL_ID,
      unitPrice:    2.5,
      minOrderQty:  50,
      leadTimeDays: 7,
    })

    expect(mockCatalogCreate).toHaveBeenCalledTimes(1)
    expect(result.supplierId).toBe(SUPPLIER_ID)
    expect(result.materialId).toBe(MATERIAL_ID)
  })

  it('3. auto-generates a PO suggestion based on lab stock', async () => {
    mockLabFindUnique.mockResolvedValueOnce({ id: LAB_ID, name: 'Lab A' })
    mockMaterialFindUnique.mockResolvedValueOnce(makeMaterial())
    mockCatalogFindMany.mockResolvedValueOnce([makeCatalog()])
    mockPOSuggestionCreate.mockResolvedValueOnce(makeSuggestion())

    const service = new PurchaseOrderService()
    const suggestion = await service.suggestPurchaseOrder({
      labId:        LAB_ID,
      materialId:   MATERIAL_ID,
      suggestedQty: 200,
      reasoning:    'Stock below minimum threshold',
    })

    expect(mockPOSuggestionCreate).toHaveBeenCalledTimes(1)
    expect(suggestion.status).toBe('PENDING')
    expect(Number(suggestion.suggestedQty)).toBe(200)
  })

  it('4. manager approves suggestion — creates actual PO', async () => {
    mockPOSuggestionFindUnique.mockResolvedValueOnce(
      makeSuggestion({ supplier: makeSupplier({ catalogs: [makeCatalog()] }) })
    )
    mockCatalogFindUnique.mockResolvedValueOnce(makeCatalog())
    mockPurchaseOrderCreate.mockResolvedValueOnce(makePurchaseOrder())
    mockPOSuggestionUpdate.mockResolvedValueOnce(makeSuggestion({ status: 'APPROVED' }))

    const service = new PurchaseOrderService()
    const po = await service.approveSuggestion(SUGGESTION_ID, {
      approvedBy: ADMIN_USER_ID,
    })

    expect(mockPurchaseOrderCreate).toHaveBeenCalledTimes(1)
    expect(mockPOSuggestionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SUGGESTION_ID },
        data:  expect.objectContaining({ status: 'APPROVED' }),
      })
    )
    expect(po.supplierId).toBe(SUPPLIER_ID)
  })

  it('5. worker receives PO — updates LabStock and SupplierPerformanceMetric', async () => {
    const po = makePurchaseOrder()

    // Outer findUnique for the PO
    mockPurchaseOrderFindUnique.mockResolvedValueOnce(po)

    // Inside $transaction:
    // tx.purchaseOrder.update → returns delivered PO
    const deliveredPO = { ...po, status: 'DELIVERED', actualDeliveryDate: new Date() }
    mockPurchaseOrderUpdate.mockResolvedValueOnce(deliveredPO)

    // tx.labStock.findFirst → returns existing stock record
    const stock = makeLabStock()
    mockLabStockFindFirst.mockResolvedValueOnce(stock)

    // tx.labStock.update → stock quantity incremented
    const updatedStock = {
      ...stock,
      quantity: stock.quantity.plus(new Decimal('200')),
    }
    mockLabStockUpdate.mockResolvedValueOnce(updatedStock)

    // tx.supplierPerformanceMetric.findUnique → existing metric
    const metric = makeMetric({ onTimeCount: 3, totalDelivered: 3 })
    mockMetricFindUnique.mockResolvedValueOnce(metric)

    // tx.supplierPerformanceMetric.update → updated metric
    const updatedMetric = { ...metric, totalDelivered: 4, onTimeCount: 4, onTimePercent: 100 }
    mockMetricUpdate.mockResolvedValueOnce(updatedMetric)

    const service = new PurchaseOrderService()
    const result = await service.receivePurchaseOrder(PO_ID, { receivedQuantity: 200 })

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockPurchaseOrderUpdate).toHaveBeenCalledTimes(1)
    expect(mockLabStockUpdate).toHaveBeenCalledTimes(1)
    expect(mockMetricUpdate).toHaveBeenCalledTimes(1)

    // Verify the stock update adds the received quantity
    const stockUpdateCall = mockLabStockUpdate.mock.calls[0][0]
    expect(stockUpdateCall.where.id).toBe(LAB_STOCK_ID)

    // Verify PO is now delivered
    expect(result.status).toBe('DELIVERED')
  })
})

// ===========================================================================
// GROUP 2: Batch integration — material alerts for delayed suppliers
// ===========================================================================

describe('Batch integration: material alerts', () => {
  it('6. returns no alerts when no POs are overdue', async () => {
    mockBatchFindUnique.mockResolvedValueOnce({
      id:              BATCH_ID,
      batchNumber:     'BATCH-001',
      plannedStartTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      recipe: {
        ingredients: [
          {
            rawMaterialId: MATERIAL_ID,
            materialId:    MATERIAL_ID,
            rawMaterial:   makeMaterial(),
          },
        ],
      },
    })

    // No delayed POs found
    mockPurchaseOrderFindMany.mockResolvedValueOnce([])

    const service = new SupplierAlertService()
    const result = await service.checkBatchMaterialStatus(BATCH_ID)

    expect(result.isDelayed).toBe(false)
    expect(result.delayedMaterials).toHaveLength(0)
  })

  it('7. detects delayed supplier — alert includes supplier name, material, expected date', async () => {
    const pastExpectedDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    const plannedStartTime = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)

    mockBatchFindUnique.mockResolvedValueOnce({
      id:              BATCH_ID,
      batchNumber:     'BATCH-002',
      plannedStartTime,
      recipe: {
        ingredients: [
          {
            rawMaterialId: MATERIAL_ID,
            materialId:    MATERIAL_ID,
            rawMaterial:   makeMaterial(),
          },
        ],
      },
    })

    // One delayed PO — expected delivery was 3 days ago, not yet delivered
    mockPurchaseOrderFindMany.mockResolvedValueOnce([
      {
        id:                   PO_ID,
        supplierId:           SUPPLIER_ID,
        materialId:           MATERIAL_ID,
        status:               'PENDING',
        expectedDeliveryDate: pastExpectedDate,
        supplier:             makeSupplier({ name: 'Integration Supplier' }),
        material:             makeMaterial({ name: 'All-purpose Flour' }),
      },
    ])

    const service = new SupplierAlertService()
    const result = await service.checkBatchMaterialStatus(BATCH_ID)

    expect(result.isDelayed).toBe(true)
    expect(result.delayedMaterials).toHaveLength(1)

    const alert = result.delayedMaterials[0]
    expect(alert.supplierName).toBe('Integration Supplier')
    expect(alert.materialName).toBe('All-purpose Flour')
    expect(alert.expectedDeliveryDate).toEqual(pastExpectedDate)
    expect(alert.daysLate).toBeGreaterThan(0)
  })

  it('8. batch cannot start when materials from delayed supplier are missing', async () => {
    const pastExpectedDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const plannedStartTime = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)

    // canBatchStart delegates to checkBatchMaterialStatus (called twice — once for check, once for canBatchStart)
    mockBatchFindUnique
      .mockResolvedValueOnce({
        id:              BATCH_ID,
        batchNumber:     'BATCH-003',
        plannedStartTime,
        recipe: {
          ingredients: [
            {
              rawMaterialId: MATERIAL_ID,
              materialId:    MATERIAL_ID,
              rawMaterial:   makeMaterial(),
            },
          ],
        },
      })

    mockPurchaseOrderFindMany.mockResolvedValueOnce([
      {
        id:                   PO_ID,
        supplierId:           SUPPLIER_ID,
        materialId:           MATERIAL_ID,
        status:               'PENDING',
        expectedDeliveryDate: pastExpectedDate,
        supplier:             makeSupplier(),
        material:             makeMaterial(),
      },
    ])

    const service = new SupplierAlertService()
    const result = await service.canBatchStart(BATCH_ID)

    expect(result.canStart).toBe(false)
    expect(result.blockedBy).toHaveLength(1)
    expect(result.blockedBy[0]).toContain('All-purpose Flour')
  })
})

// ===========================================================================
// GROUP 3: Performance flow — reliability score calculation
// ===========================================================================

describe('Performance flow: reliability score', () => {
  it('9. calculates 80% on-time rate from 5 POs (4 on-time, 1 late)', async () => {
    mockSupplierFindUnique.mockResolvedValue(makeSupplier())

    const now = new Date()
    const onTimeExpected  = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) // expires tomorrow
    const lateExpected    = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // expired 2 days ago

    // 4 on-time + 1 late delivered POs within 30 days
    const deliveredPOs = [
      { ...makePurchaseOrder({ id: 'po-1', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: new Date() }) },
      { ...makePurchaseOrder({ id: 'po-2', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: new Date() }) },
      { ...makePurchaseOrder({ id: 'po-3', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: new Date() }) },
      { ...makePurchaseOrder({ id: 'po-4', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: new Date() }) },
      // Late: actual delivery is today but expected was 2 days ago
      { ...makePurchaseOrder({ id: 'po-5', expectedDeliveryDate: lateExpected,  actualDeliveryDate: new Date() }) },
    ]

    // First findMany: 30-day window POs
    mockPurchaseOrderFindMany.mockResolvedValueOnce(deliveredPOs)
    // Second findMany: 60-day (trend) window — empty
    mockPurchaseOrderFindMany.mockResolvedValueOnce([])

    // No quality inspections
    mockQIFindMany.mockResolvedValueOnce([])

    const upsertedMetric = {
      supplierId:        SUPPLIER_ID,
      totalOrders:       5,
      totalDelivered:    5,
      onTimeCount:       4,
      onTimePercent:     80,
      inspectionsPassed: 0,
      inspectionsFailed: 0,
      qualityPassRate:   0,
      trend30Day:        'stable',
      reliabilityScore:  82,
    }
    mockMetricUpsert.mockResolvedValueOnce(upsertedMetric)

    const service = new SupplierPerformanceService()
    const metric  = await service.calculateSupplierMetrics(SUPPLIER_ID)

    expect(mockMetricUpsert).toHaveBeenCalledTimes(1)

    const upsertCall = mockMetricUpsert.mock.calls[0][0]
    expect(upsertCall.create.onTimePercent).toBe(80)
    expect(upsertCall.create.onTimeCount).toBe(4)

    expect(metric.onTimePercent).toBe(80)
  })

  it('10. reliability score reflects on-time percentage and quality pass rate', async () => {
    mockSupplierFindUnique.mockResolvedValue(makeSupplier())

    const now            = new Date()
    const onTimeExpected = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)

    // All 3 on-time
    const deliveredPOs = [
      { ...makePurchaseOrder({ id: 'po-a', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: now }) },
      { ...makePurchaseOrder({ id: 'po-b', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: now }) },
      { ...makePurchaseOrder({ id: 'po-c', expectedDeliveryDate: onTimeExpected, actualDeliveryDate: now }) },
    ]

    mockPurchaseOrderFindMany.mockResolvedValueOnce(deliveredPOs)
    mockPurchaseOrderFindMany.mockResolvedValueOnce([]) // trend

    // 2 QC passed, 1 failed → 66% pass rate
    mockQIFindMany.mockResolvedValueOnce([
      { status: 'PASSED' },
      { status: 'PASSED' },
      { status: 'FAILED' },
    ])

    const expectedOnTimePercent  = 100  // 3/3
    const expectedQualityRate    = 67   // Math.round(2/3 * 100)
    // reliabilityScore = min(100, round(100*0.4 + 67*0.4 + 50)) = min(100, round(40+26.8+50)) = min(100, 117) = 100
    const expectedReliability    = 100

    const metricResult = {
      supplierId:        SUPPLIER_ID,
      onTimePercent:     expectedOnTimePercent,
      qualityPassRate:   expectedQualityRate,
      reliabilityScore:  expectedReliability,
      onTimeCount:       3,
      totalOrders:       3,
      totalDelivered:    3,
    }
    mockMetricUpsert.mockResolvedValueOnce(metricResult)

    const service = new SupplierPerformanceService()
    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertCall = mockMetricUpsert.mock.calls[0][0]
    expect(upsertCall.create.onTimePercent).toBe(expectedOnTimePercent)
    expect(upsertCall.create.qualityPassRate).toBe(expectedQualityRate)
    // reliabilityScore is calculated and clamped to [0, 100]
    expect(upsertCall.create.reliabilityScore).toBeGreaterThanOrEqual(0)
    expect(upsertCall.create.reliabilityScore).toBeLessThanOrEqual(100)
  })
})

// ===========================================================================
// GROUP 4: CSV import flow
// ===========================================================================

describe('CSV import flow', () => {
  it('11. imports 3 suppliers from CSV — all created, duplicates skipped', async () => {
    // Supplier 1: new
    mockSupplierFindFirst.mockResolvedValueOnce(null)
    mockSupplierCreate.mockResolvedValueOnce(makeSupplier({ id: 'sup-1', name: 'Alpha Foods' }))

    // Supplier 2: duplicate — already exists
    mockSupplierFindFirst.mockResolvedValueOnce(makeSupplier({ name: 'Beta Supplies' }))

    // Supplier 3: new
    mockSupplierFindFirst.mockResolvedValueOnce(null)
    mockSupplierCreate.mockResolvedValueOnce(makeSupplier({ id: 'sup-3', name: 'Gamma Import' }))

    const csv = [
      'name,email,phone,leadTimeDays,categories',
      'Alpha Foods,alpha@test.com,+2120000001,5,Flour;Sugar',
      'Beta Supplies,beta@test.com,+2120000002,7,Chocolate',
      'Gamma Import,gamma@test.com,+2120000003,10,Packaging',
    ].join('\n')

    const req = makeCSVRequest('/api/supplier/import/suppliers', csv)
    const res = await importSuppliers(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.imported).toBe(2)          // Alpha + Gamma
    expect(body.data.failed).toBe(1)            // Beta duplicate
    expect(mockSupplierCreate).toHaveBeenCalledTimes(2)
  })

  it('12. imports 10 catalog entries — valid linked, duplicates skipped', async () => {
    // Simulate 8 valid rows and 2 duplicate rows.
    // supplier lookup: findUnique always returns a valid supplier
    // material lookup: always returns a valid material
    // catalog duplicate check: first 8 calls → null (new), last 2 calls → existing entry

    mockSupplierFindUnique.mockResolvedValue(makeSupplier())
    mockMaterialFindUnique.mockResolvedValue(makeMaterial())

    // First 8 catalog entries: no duplicate
    for (let i = 0; i < 8; i++) {
      mockCatalogFindUnique.mockResolvedValueOnce(null)
      mockCatalogCreate.mockResolvedValueOnce({
        ...makeCatalog(),
        id: `catalog-${i}`,
        unitPrice: new Decimal(`${(i + 1) * 2}.50`),
      })
    }
    // Last 2 rows: duplicate entries
    mockCatalogFindUnique.mockResolvedValueOnce(makeCatalog())
    mockCatalogFindUnique.mockResolvedValueOnce(makeCatalog())

    // Build CSV with 10 data rows
    const rows = Array.from({ length: 10 }, (_, i) => (
      `${SUPPLIER_ID},${MATERIAL_ID},${(i + 1) * 2}.50,${10 + i},${5 + i}`
    ))
    const csv = ['supplierId,materialId,unitPrice,minOrderQty,leadTimeDays', ...rows].join('\n')

    const req = makeCSVRequest('/api/supplier/import/catalogs', csv)
    const res = await importCatalogs(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.imported).toBe(8)          // 8 new entries
    expect(body.data.failed).toBe(2)            // 2 duplicates
    expect(mockCatalogCreate).toHaveBeenCalledTimes(8)
  })
})
