import { db } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

export class POError extends Error {}
export class PONotFoundError extends POError {}

export class PurchaseOrderService {
  async suggestPurchaseOrder(input: {
    labId: string
    materialId: string
    suggestedQty: number | Decimal
    reasoning: string
  }) {
    const lab = await db.productionLab.findUnique({ where: { id: input.labId } })
    if (!lab) throw new POError('Lab not found')

    const material = await db.rawMaterial.findUnique({ where: { id: input.materialId } })
    if (!material) throw new POError('Material not found')

    const catalogs = await db.supplierCatalog.findMany({
      where: { materialId: input.materialId, isActive: true },
      include: {
        supplier: { include: { performanceMetric: true } },
      },
      orderBy: {
        supplier: {
          performanceMetric: { reliabilityScore: 'desc' },
        },
      },
      take: 1,
    })

    if (catalogs.length === 0) {
      throw new POError('No active suppliers found for this material')
    }

    const supplierId = catalogs[0].supplierId
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    return db.purchaseOrderSuggestion.create({
      data: {
        labId: input.labId,
        materialId: input.materialId,
        supplierId,
        suggestedQty: new Decimal(input.suggestedQty.toString()),
        reasoning: input.reasoning,
        status: 'PENDING',
        expiresAt,
      },
      include: {
        supplier: { include: { catalogs: true } },
        material: true,
      },
    })
  }

  async getPendingSuggestions(filters?: { labId?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const skip = (page - 1) * limit

    const where: any = {
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    }

    if (filters?.labId) where.labId = filters.labId

    return db.purchaseOrderSuggestion.findMany({
      where,
      include: {
        supplier: { include: { catalogs: true } },
        material: true,
        lab: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
  }

  async approveSuggestion(
    suggestionId: string,
    input: {
      qtyOverride?: number | Decimal
      supplierId?: string
      approvedBy: string
    }
  ) {
    const suggestion = await db.purchaseOrderSuggestion.findUnique({
      where: { id: suggestionId },
      include: { supplier: { include: { catalogs: true } } },
    })

    if (!suggestion) throw new PONotFoundError('Suggestion not found')

    const finalSupplierId = input.supplierId || suggestion.supplierId
    const finalQty = input.qtyOverride || suggestion.suggestedQty

    const catalog = await db.supplierCatalog.findUnique({
      where: {
        supplierId_materialId: {
          supplierId: finalSupplierId,
          materialId: suggestion.materialId,
        },
      },
    })

    if (!catalog) {
      throw new POError('Selected supplier does not have catalog for this material')
    }

    const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const expectedDeliveryDate = new Date(Date.now() + catalog.leadTimeDays * 24 * 60 * 60 * 1000)

    const po = await db.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: finalSupplierId,
        materialId: suggestion.materialId,
        quantity: new Decimal(finalQty.toString()),
        status: 'PENDING',
        approvedBy: input.approvedBy,
        expectedDeliveryDate,
      },
      include: { supplier: true, material: true },
    })

    await db.purchaseOrderSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })

    return po
  }

  async rejectSuggestion(suggestionId: string, reason: string) {
    const suggestion = await db.purchaseOrderSuggestion.findUnique({
      where: { id: suggestionId },
    })

    if (!suggestion) throw new PONotFoundError('Suggestion not found')

    return db.purchaseOrderSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    })
  }

  async getPurchaseOrder(poId: string) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: { supplier: true, material: true },
    })

    if (!po) throw new PONotFoundError('PO not found')
    return po
  }

  async listPurchaseOrders(filters?: {
    status?: string
    supplierId?: string
    materialId?: string
    page?: number
    limit?: number
  }) {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const skip = (page - 1) * limit

    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.materialId) where.materialId = filters.materialId

    return db.purchaseOrder.findMany({
      where,
      include: { supplier: true, material: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
  }

  async receivePurchaseOrder(
    poId: string,
    input: {
      receivedQuantity?: number | Decimal
      qualityInspectionId?: string
    }
  ) {
    const po = await db.purchaseOrder.findUnique({
      where: { id: poId },
      include: { material: true },
    })

    if (!po) throw new PONotFoundError('PO not found')

    const receivedQty = input.receivedQuantity || po.quantity
    const actualDeliveryDate = new Date()
    const isOnTime = actualDeliveryDate <= po.expectedDeliveryDate!

    return db.$transaction(async (tx) => {
      const updatedPO = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'DELIVERED',
          actualDeliveryDate,
          receivedQuantity: new Decimal(receivedQty.toString()),
          qualityInspectionId: input.qualityInspectionId,
        },
        include: { supplier: true, material: true },
      })

      const labStock = await tx.labStock.findFirst({
        where: {
          materialId: po.materialId,
        },
      })

      if (labStock) {
        await tx.labStock.update({
          where: { id: labStock.id },
          data: {
            quantity: labStock.quantity.plus(new Decimal(receivedQty.toString())),
          },
        })
      }

      const metric = await tx.supplierPerformanceMetric.findUnique({
        where: { supplierId: po.supplierId },
      })

      if (metric) {
        const newOnTimeCount = isOnTime ? metric.onTimeCount + 1 : metric.onTimeCount
        const newTotal = metric.totalDelivered + 1

        await tx.supplierPerformanceMetric.update({
          where: { supplierId: po.supplierId },
          data: {
            totalDelivered: newTotal,
            onTimeCount: newOnTimeCount,
            onTimePercent: Math.round((newOnTimeCount / newTotal) * 100),
            lastUpdated: new Date(),
          },
        })
      }

      return updatedPO
    })
  }
}
