import { db } from '@/lib/db'

export class SupplierAlertService {
  async checkBatchMaterialStatus(batchId: string) {
    const batch = await db.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                rawMaterial: true,
              },
            },
          },
        },
      },
    })

    if (!batch) throw new Error('Batch not found')

    const delayedMaterials: any[] = []

    for (const ingredient of batch.recipe.ingredients) {
      const materialId = ingredient.rawMaterialId
      if (!materialId) continue

      const pos = await db.purchaseOrder.findMany({
        where: {
          materialId,
          status: 'PENDING',
          expectedDeliveryDate: { lt: batch.plannedStartTime },
        },
        include: { supplier: true, material: true },
      })

      pos.forEach((po) => {
        const daysOverdue = Math.floor(
          (new Date().getTime() - po.expectedDeliveryDate!.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysOverdue > 0) {
          delayedMaterials.push({
            materialId: ingredient.materialId,
            materialName: ingredient.rawMaterial.name,
            supplierId: po.supplierId,
            supplierName: po.supplier.name,
            expectedDeliveryDate: po.expectedDeliveryDate,
            daysLate: daysOverdue,
          })
        }
      })
    }

    return {
      isDelayed: delayedMaterials.length > 0,
      delayedMaterials,
    }
  }

  async getMaterialAlertsForLab(labId: string) {
    const lab = await db.productionLab.findUnique({
      where: { id: labId },
      include: { stock: { include: { material: true } } },
    })

    if (!lab) throw new Error('Lab not found')

    const delayedMaterials: any[] = []
    const belowThresholdMaterials: any[] = []

    const activePOs = await db.purchaseOrder.findMany({
      where: {
        status: { in: ['PENDING', 'ORDERED'] },
        expectedDeliveryDate: { lt: new Date() },
      },
      include: { supplier: true, material: true },
    })

    activePOs.forEach((po) => {
      const stockEntry = lab.stock.find((s) => s.materialId === po.materialId)
      if (stockEntry) {
        delayedMaterials.push({
          materialId: po.materialId,
          materialName: po.material.name,
          supplierId: po.supplierId,
          supplierName: po.supplier.name,
          expectedDeliveryDate: po.expectedDeliveryDate,
        })
      }
    })

    lab.stock.forEach((stock) => {
      if (stock.quantity.lessThan(stock.minThreshold)) {
        const daysUntilDepletion = Math.max(1, Math.floor(stock.quantity.toNumber() / 5))

        belowThresholdMaterials.push({
          materialId: stock.materialId,
          materialName: stock.material.name,
          currentStock: stock.quantity.toNumber(),
          minThreshold: stock.minThreshold.toNumber(),
          daysUntilDepletion,
        })
      }
    })

    return {
      delayedMaterials,
      belowThresholdMaterials,
    }
  }

  async canBatchStart(batchId: string) {
    const status = await this.checkBatchMaterialStatus(batchId)

    return {
      canStart: !status.isDelayed,
      blockedBy: status.delayedMaterials.map(
        (m) => `${m.materialName} (expected ${m.expectedDeliveryDate.toISOString().split('T')[0]})`
      ),
    }
  }
}
