/**
 * lib/__tests__/supplier-performance-service.test.ts
 *
 * Unit tests for lib/services/supplier-performance-service.ts
 *
 * Strategy:
 *  - Mock @/lib/db so every Prisma model method becomes a jest.fn().
 *  - Feed concrete sets of PurchaseOrder and QualityInspection objects whose
 *    dates and statuses are fully controlled, then assert on the calculated
 *    numeric metrics (onTimePercent, qualityPassRate, reliabilityScore, trend).
 *  - Two primary methods are tested:
 *      calculateSupplierMetrics — full metrics + upsert
 *      calculateCategoryMetrics — per-category breakdown + upsert
 *  - getPerformanceDashboard is covered for happy-path shape and risk-alert logic.
 *  - Error cases (supplier not found) confirm the plain Error thrown by the service.
 *
 * Formula under test (calculateSupplierMetrics):
 *   onTimePercent   = round(onTimeCount / totalDelivered * 100)
 *   qualityPassRate = round(passedQC    / totalQC       * 100)
 *   trendScore      = +5 if improving, -10 if declining, 0 if stable
 *   reliabilityScore = clamp(0, 100, round(onTimePercent*0.4 + qualityPassRate*0.4 + 50 + trendScore))
 *
 * Formula under test (calculateCategoryMetrics):
 *   reliabilityScore = clamp(0, 100, round(onTimePercent*0.5 + qualityPassRate*0.5))
 */

// ---------------------------------------------------------------------------
// Mock: @/lib/db
// ---------------------------------------------------------------------------

jest.mock('@/lib/db', () => ({
  db: {
    supplier: {
      findUnique: jest.fn(),
    },
    purchaseOrder: {
      findMany: jest.fn(),
    },
    qualityInspection: {
      findMany: jest.fn(),
    },
    supplierPerformanceMetric: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    supplierCategoryPerformance: {
      upsert: jest.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { db } from '@/lib/db'
import { SupplierPerformanceService } from '@/lib/services/supplier-performance-service'

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------

const mockSupplier     = db.supplier     as jest.Mocked<typeof db.supplier>
const mockPO           = db.purchaseOrder as jest.Mocked<typeof db.purchaseOrder>
const mockQC           = db.qualityInspection as jest.Mocked<typeof db.qualityInspection>
const mockPerfMetric   = db.supplierPerformanceMetric as jest.Mocked<typeof db.supplierPerformanceMetric>
const mockCatPerf      = db.supplierCategoryPerformance as jest.Mocked<typeof db.supplierCategoryPerformance>

// ---------------------------------------------------------------------------
// Shared CUIDs
// ---------------------------------------------------------------------------

const SUPPLIER_ID = 'clh3v2y0k0000ccc0000000001'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Creates a delivered-on-time PO: actualDeliveryDate <= expectedDeliveryDate */
function onTimePO(daysAgo: number) {
  const base = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return {
    supplierId: SUPPLIER_ID,
    status: 'DELIVERED',
    actualDeliveryDate: base,
    expectedDeliveryDate: new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000), // deadline 2d later
  }
}

/** Creates a late PO: actualDeliveryDate > expectedDeliveryDate */
function latePO(daysAgo: number) {
  const base = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  return {
    supplierId: SUPPLIER_ID,
    status: 'DELIVERED',
    actualDeliveryDate: base,
    expectedDeliveryDate: new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000), // deadline 2d before
  }
}

function passedQC() {
  return { supplierId: SUPPLIER_ID, status: 'PASSED', actualDate: new Date() }
}

function failedQC() {
  return { supplierId: SUPPLIER_ID, status: 'FAILED', actualDate: new Date() }
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

const service = new SupplierPerformanceService()

// ============================================================================
// calculateSupplierMetrics — onTimePercent
// ============================================================================

describe('calculateSupplierMetrics — onTimePercent', () => {
  it('calculates 100% when all deliveries are on time', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    // 3 on-time POs in the last 30 days
    mockPO.findMany
      .mockResolvedValueOnce([onTimePO(5), onTimePO(10), onTimePO(20)] as any) // recent 30d
      .mockResolvedValueOnce([] as any) // older 30-60d window (trend calc)
    mockQC.findMany.mockResolvedValueOnce([])
    mockPerfMetric.upsert.mockResolvedValueOnce({ supplierId: SUPPLIER_ID, onTimePercent: 100 } as any)

    const result = await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.onTimePercent).toBe(100)
    expect(upsertArg.create.onTimeCount).toBe(3)
  })

  it('calculates correct percentage when some deliveries are late', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    // 3 on-time + 1 late = 75%
    mockPO.findMany
      .mockResolvedValueOnce([onTimePO(2), onTimePO(5), onTimePO(10), latePO(15)] as any)
      .mockResolvedValueOnce([] as any)
    mockQC.findMany.mockResolvedValueOnce([])
    mockPerfMetric.upsert.mockResolvedValueOnce({ onTimePercent: 75 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.onTimePercent).toBe(75)
    expect(upsertArg.create.onTimeCount).toBe(3)
  })

  it('calculates 0% when no deliveries are on time', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany
      .mockResolvedValueOnce([latePO(5), latePO(12)] as any)
      .mockResolvedValueOnce([] as any)
    mockQC.findMany.mockResolvedValueOnce([])
    mockPerfMetric.upsert.mockResolvedValueOnce({ onTimePercent: 0 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.onTimePercent).toBe(0)
    expect(upsertArg.create.onTimeCount).toBe(0)
  })
})

// ============================================================================
// calculateSupplierMetrics — qualityPassRate
// ============================================================================

describe('calculateSupplierMetrics — qualityPassRate', () => {
  it('calculates 100% when all QC inspections passed', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    mockQC.findMany.mockResolvedValueOnce([passedQC(), passedQC(), passedQC()] as any)
    mockPerfMetric.upsert.mockResolvedValueOnce({ qualityPassRate: 100 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.qualityPassRate).toBe(100)
    expect(upsertArg.create.inspectionsPassed).toBe(3)
    expect(upsertArg.create.inspectionsFailed).toBe(0)
  })

  it('calculates 50% when half of QC inspections failed', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    mockQC.findMany.mockResolvedValueOnce([passedQC(), passedQC(), failedQC(), failedQC()] as any)
    mockPerfMetric.upsert.mockResolvedValueOnce({ qualityPassRate: 50 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.qualityPassRate).toBe(50)
  })

  it('calculates 0% when no QC inspections passed', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    mockQC.findMany.mockResolvedValueOnce([failedQC(), failedQC()] as any)
    mockPerfMetric.upsert.mockResolvedValueOnce({ qualityPassRate: 0 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.qualityPassRate).toBe(0)
  })
})

// ============================================================================
// calculateSupplierMetrics — reliabilityScore formula
// ============================================================================

describe('calculateSupplierMetrics — reliabilityScore', () => {
  it('computes reliabilityScore = onTime*0.4 + quality*0.4 + 50 (stable trend)', async () => {
    // onTimePercent = 80, qualityPassRate = 90, trend = stable => score = 32+36+50 = 118 → clamped to 100
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany
      .mockResolvedValueOnce([
        onTimePO(5), onTimePO(6), onTimePO(7), onTimePO(8), latePO(9),
      ] as any) // 4/5 on time = 80%
      .mockResolvedValueOnce([onTimePO(40), onTimePO(41), onTimePO(42), latePO(43)] as any) // older: 3/4 = 75%
    // 9 passed + 1 failed = 90%
    mockQC.findMany.mockResolvedValueOnce([
      passedQC(), passedQC(), passedQC(), passedQC(), passedQC(),
      passedQC(), passedQC(), passedQC(), passedQC(), failedQC(),
    ] as any)
    mockPerfMetric.upsert.mockResolvedValueOnce({ reliabilityScore: 100 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    // 80*0.4=32 + 90*0.4=36 + 50 = 118 → clamped to 100
    expect(upsertArg.create.reliabilityScore).toBe(100)
  })

  it('applies trendScore +5 when recent on-time rate exceeds older by >5 points (improving)', async () => {
    // Recent: 10/10 = 100%, Older: 5/10 = 50% → trend = improving → trendScore = +5
    // reliabilityScore = round(100*0.4 + 0*0.4 + 50 + 5) = round(40+0+55) = 95
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany
      .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => onTimePO(i + 1)) as any)
      .mockResolvedValueOnce([
        ...Array.from({ length: 5 }, (_, i) => onTimePO(i + 31)),
        ...Array.from({ length: 5 }, (_, i) => latePO(i + 36)),
      ] as any) // older 50%
    mockQC.findMany.mockResolvedValueOnce([]) // no QC → qualityPassRate = 0
    mockPerfMetric.upsert.mockResolvedValueOnce({ reliabilityScore: 95 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.trend30Day).toBe('improving')
    expect(upsertArg.create.reliabilityScore).toBe(95) // 40+0+55
  })

  it('applies trendScore -10 when recent on-time rate is >5 points below older (declining)', async () => {
    // Recent: 0/5 = 0%, Older: 10/10 = 100% → trend = declining → trendScore = -10
    // reliabilityScore = round(0*0.4 + 0*0.4 + 50 - 10) = 40
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    mockPO.findMany
      .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => latePO(i + 1)) as any) // all late
      .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => onTimePO(i + 31)) as any) // all on time
    mockQC.findMany.mockResolvedValueOnce([])
    mockPerfMetric.upsert.mockResolvedValueOnce({ reliabilityScore: 40 } as any)

    await service.calculateSupplierMetrics(SUPPLIER_ID)

    const upsertArg = mockPerfMetric.upsert.mock.calls[0][0] as any
    expect(upsertArg.create.trend30Day).toBe('declining')
    expect(upsertArg.create.reliabilityScore).toBe(40)
  })
})

// ============================================================================
// calculateCategoryMetrics — per-category breakdown
// ============================================================================

describe('calculateCategoryMetrics', () => {
  it('calculates per-category metrics and upserts SupplierCategoryPerformance', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce({ id: SUPPLIER_ID } as any)
    // 3 on-time POs in the category
    mockPO.findMany.mockResolvedValueOnce([onTimePO(5), onTimePO(10), latePO(15)] as any)
    // 2 passed, 1 failed = 67% quality
    mockQC.findMany.mockResolvedValueOnce([passedQC(), passedQC(), failedQC()] as any)
    mockCatPerf.upsert.mockResolvedValueOnce({
      supplierId: SUPPLIER_ID,
      category: 'FRAGRANCE',
      onTimePercent: 67,
      qualityPassRate: 67,
      reliabilityScore: 67,
    } as any)

    const result = await service.calculateCategoryMetrics(SUPPLIER_ID, 'FRAGRANCE')

    expect(result.category).toBe('FRAGRANCE')
    const upsertArg = mockCatPerf.upsert.mock.calls[0][0] as any
    expect(upsertArg.where.supplierId_category.supplierId).toBe(SUPPLIER_ID)
    expect(upsertArg.where.supplierId_category.category).toBe('FRAGRANCE')
    // on-time: 2/3 = 67, quality: 2/3 = 67 → reliabilityScore = round(67*0.5 + 67*0.5) = 67
    expect(upsertArg.create.onTimePercent).toBe(67)
    expect(upsertArg.create.qualityPassRate).toBe(67)
    expect(upsertArg.create.reliabilityScore).toBe(67)
  })

  it('throws Error when supplier is not found', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(
      service.calculateCategoryMetrics('ghost-supplier', 'FRAGRANCE'),
    ).rejects.toThrow('Supplier not found')

    expect(mockCatPerf.upsert).not.toHaveBeenCalled()
  })
})

// ============================================================================
// calculateSupplierMetrics — supplier not found
// ============================================================================

describe('calculateSupplierMetrics — error cases', () => {
  it('throws Error when supplier does not exist', async () => {
    mockSupplier.findUnique.mockResolvedValueOnce(null)

    await expect(service.calculateSupplierMetrics('ghost-id')).rejects.toThrow('Supplier not found')

    expect(mockPO.findMany).not.toHaveBeenCalled()
    expect(mockQC.findMany).not.toHaveBeenCalled()
    expect(mockPerfMetric.upsert).not.toHaveBeenCalled()
  })
})

// ============================================================================
// getPerformanceDashboard
// ============================================================================

describe('getPerformanceDashboard', () => {
  it('returns suppliers list, portfolio percentages, and empty risk alerts when all metrics are healthy', async () => {
    const healthyMetric = {
      supplierId: SUPPLIER_ID,
      onTimePercent: 95,
      qualityPassRate: 95,
      reliabilityScore: 95,
      supplier: { id: SUPPLIER_ID, name: 'Acme Supplies' },
    }
    mockPerfMetric.findMany.mockResolvedValueOnce([healthyMetric] as any)
    // All POs on time
    mockPO.findMany.mockResolvedValueOnce([onTimePO(5), onTimePO(10)] as any)
    // All QC passed
    mockQC.findMany.mockResolvedValueOnce([passedQC(), passedQC()] as any)

    const result = await service.getPerformanceDashboard()

    expect(result.suppliers).toHaveLength(1)
    expect(result.portfolioOnTimePercent).toBe(100)
    expect(result.portfolioQualityPassRate).toBe(100)
    expect(result.riskAlerts).toHaveLength(0)
  })

  it('adds risk alerts for suppliers with quality < 85% or on-time < 80%', async () => {
    const badQuality = {
      supplierId: 'sup-bad-quality',
      onTimePercent: 90,
      qualityPassRate: 80, // below 85
      reliabilityScore: 60,
      supplier: { id: 'sup-bad-quality', name: 'BadQual Co' },
    }
    const badOnTime = {
      supplierId: 'sup-bad-ontime',
      onTimePercent: 70, // below 80
      qualityPassRate: 90,
      reliabilityScore: 65,
      supplier: { id: 'sup-bad-ontime', name: 'LateDelivery Inc' },
    }
    mockPerfMetric.findMany.mockResolvedValueOnce([badQuality, badOnTime] as any)
    mockPO.findMany.mockResolvedValueOnce([])
    mockQC.findMany.mockResolvedValueOnce([])

    const result = await service.getPerformanceDashboard()

    expect(result.riskAlerts).toHaveLength(2)
    expect(result.riskAlerts.some((a) => a.includes('BadQual Co'))).toBe(true)
    expect(result.riskAlerts.some((a) => a.includes('LateDelivery Inc'))).toBe(true)
  })

  it('returns zero portfolio percentages when no delivered POs or QC records exist', async () => {
    mockPerfMetric.findMany.mockResolvedValueOnce([])
    mockPO.findMany.mockResolvedValueOnce([]) // no delivered POs
    mockQC.findMany.mockResolvedValueOnce([]) // no QC records

    const result = await service.getPerformanceDashboard()

    expect(result.portfolioOnTimePercent).toBe(0)
    expect(result.portfolioQualityPassRate).toBe(0)
    expect(result.riskAlerts).toHaveLength(0)
  })
})
