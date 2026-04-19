import { db } from '@/lib/db'

export class SupplierPerformanceService {
  async calculateSupplierMetrics(supplierId: string) {
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) throw new Error('Supplier not found')

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const pos = await db.purchaseOrder.findMany({
      where: {
        supplierId,
        status: 'DELIVERED',
        actualDeliveryDate: { gte: thirtyDaysAgo },
      },
    })

    const onTimeCount = pos.filter(
      (po) => po.actualDeliveryDate! <= po.expectedDeliveryDate!
    ).length

    const onTimePercent = pos.length > 0 ? Math.round((onTimeCount / pos.length) * 100) : 0

    const qcResults = await db.qualityInspection.findMany({
      where: {
        supplierId,
        actualDate: { gte: thirtyDaysAgo },
      },
    })

    const passedQC = qcResults.filter((qc) => qc.status === 'PASSED').length
    const qualityPassRate =
      qcResults.length > 0 ? Math.round((passedQC / qcResults.length) * 100) : 0

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const olderPOs = await db.purchaseOrder.findMany({
      where: {
        supplierId,
        status: 'DELIVERED',
        actualDeliveryDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    })

    const olderOnTimeCount = olderPOs.filter(
      (po) => po.actualDeliveryDate! <= po.expectedDeliveryDate!
    ).length
    const olderOnTimePercent = olderPOs.length > 0 ? (olderOnTimeCount / olderPOs.length) * 100 : 0
    const trend =
      onTimePercent > olderOnTimePercent + 5
        ? 'improving'
        : onTimePercent < olderOnTimePercent - 5
          ? 'declining'
          : 'stable'

    const trendScore = trend === 'improving' ? 5 : trend === 'declining' ? -10 : 0
    const reliabilityScore = Math.max(
      0,
      Math.min(100, Math.round(onTimePercent * 0.4 + qualityPassRate * 0.4 + (50 + trendScore)))
    )

    return db.supplierPerformanceMetric.upsert({
      where: { supplierId },
      create: {
        supplierId,
        totalOrders: pos.length,
        totalDelivered: pos.length,
        onTimeCount,
        onTimePercent,
        inspectionsPassed: passedQC,
        inspectionsFailed: qcResults.length - passedQC,
        qualityPassRate,
        trend30Day: trend,
        reliabilityScore,
      },
      update: {
        totalOrders: pos.length,
        totalDelivered: pos.length,
        onTimeCount,
        onTimePercent,
        inspectionsPassed: passedQC,
        inspectionsFailed: qcResults.length - passedQC,
        qualityPassRate,
        trend30Day: trend,
        reliabilityScore,
      },
    })
  }

  async calculateCategoryMetrics(supplierId: string, category: string) {
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) throw new Error('Supplier not found')

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const pos = await db.purchaseOrder.findMany({
      where: {
        supplierId,
        status: 'DELIVERED',
        actualDeliveryDate: { gte: thirtyDaysAgo },
        material: { type: category },
      },
    })

    const onTimeCount = pos.filter(
      (po) => po.actualDeliveryDate! <= po.expectedDeliveryDate!
    ).length
    const onTimePercent = pos.length > 0 ? Math.round((onTimeCount / pos.length) * 100) : 0

    const qcResults = await db.qualityInspection.findMany({
      where: {
        supplierId,
        actualDate: { gte: thirtyDaysAgo },
        rawMaterial: { type: category },
      },
    })

    const passedQC = qcResults.filter((qc) => qc.status === 'PASSED').length
    const qualityPassRate =
      qcResults.length > 0 ? Math.round((passedQC / qcResults.length) * 100) : 0

    const reliabilityScore = Math.max(
      0,
      Math.min(100, Math.round(onTimePercent * 0.5 + qualityPassRate * 0.5))
    )

    return db.supplierCategoryPerformance.upsert({
      where: {
        supplierId_category: { supplierId, category },
      },
      create: {
        supplierId,
        category,
        onTimePercent,
        qualityPassRate,
        reliabilityScore,
      },
      update: {
        onTimePercent,
        qualityPassRate,
        reliabilityScore,
      },
    })
  }

  async getPerformanceDashboard() {
    const suppliers = await db.supplierPerformanceMetric.findMany({
      include: { supplier: true },
      orderBy: { reliabilityScore: 'desc' },
    })

    const allPOs = await db.purchaseOrder.findMany({
      where: { status: 'DELIVERED' },
    })

    const allOnTimeCount = allPOs.filter(
      (po) => po.actualDeliveryDate! <= po.expectedDeliveryDate!
    ).length
    const portfolioOnTimePercent =
      allPOs.length > 0 ? Math.round((allOnTimeCount / allPOs.length) * 100) : 0

    const allQC = await db.qualityInspection.findMany({})
    const passedQC = allQC.filter((qc) => qc.status === 'PASSED').length
    const portfolioQualityPassRate =
      allQC.length > 0 ? Math.round((passedQC / allQC.length) * 100) : 0

    const riskAlerts: string[] = []

    suppliers.forEach((metric) => {
      if (metric.qualityPassRate < 85) {
        riskAlerts.push(`${metric.supplier.name}: Quality below 85% (${metric.qualityPassRate}%)`)
      }
      if (metric.onTimePercent < 80) {
        riskAlerts.push(`${metric.supplier.name}: On-time delivery below 80% (${metric.onTimePercent}%)`)
      }
    })

    return {
      suppliers,
      portfolioOnTimePercent,
      portfolioQualityPassRate,
      riskAlerts,
    }
  }
}
