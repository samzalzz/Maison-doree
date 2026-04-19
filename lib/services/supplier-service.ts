import { db } from '@/lib/db'
import { CreateSupplierInput, UpdateSupplierInput, SupplierFilters } from '@/lib/validators-supplier'

export class SupplierError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupplierError'
  }
}

export class SupplierNotFoundError extends SupplierError {
  constructor(id: string) {
    super(`Supplier not found: ${id}`)
    this.name = 'SupplierNotFoundError'
  }
}

export class CatalogEntryAlreadyExistsError extends SupplierError {
  constructor(supplierId: string, materialId: string) {
    super(`Catalog entry already exists for supplier ${supplierId} and material ${materialId}`)
    this.name = 'CatalogEntryAlreadyExistsError'
  }
}

export class SupplierService {
  async createSupplier(input: CreateSupplierInput) {
    return db.supplier.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        contactPerson: input.contactPerson,
        categories: input.categories,
        status: 'ACTIVE',
      },
    })
  }

  async getSupplier(id: string) {
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        catalogs: {
          include: { material: true },
        },
        performanceMetric: true,
        categoryPerformance: true,
      },
    })

    if (!supplier) throw new SupplierNotFoundError(id)
    return supplier
  }

  async listSuppliers(filters: SupplierFilters) {
    const skip = (filters.page - 1) * filters.limit

    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: { performanceMetric: true },
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.supplier.count({ where }),
    ])

    return { suppliers, total, page: filters.page, limit: filters.limit }
  }

  async updateSupplier(id: string, input: UpdateSupplierInput) {
    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) throw new SupplierNotFoundError(id)

    return db.supplier.update({
      where: { id },
      data: input,
    })
  }

  async deactivateSupplier(id: string) {
    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) throw new SupplierNotFoundError(id)

    return db.supplier.update({
      where: { id },
      data: { status: 'INACTIVE' },
    })
  }

  async addToSupplierCatalog(input: {
    supplierId: string
    materialId: string
    unitPrice: number
    minOrderQty: number
    leadTimeDays: number
  }) {
    const supplier = await db.supplier.findUnique({
      where: { id: input.supplierId },
    })
    if (!supplier) throw new SupplierNotFoundError(input.supplierId)

    const material = await db.rawMaterial.findUnique({
      where: { id: input.materialId },
    })
    if (!material) throw new SupplierError('Material not found')

    const existing = await db.supplierCatalog.findUnique({
      where: {
        supplierId_materialId: {
          supplierId: input.supplierId,
          materialId: input.materialId,
        },
      },
    })

    if (existing) {
      throw new CatalogEntryAlreadyExistsError(input.supplierId, input.materialId)
    }

    return db.supplierCatalog.create({
      data: {
        supplierId: input.supplierId,
        materialId: input.materialId,
        unitPrice: input.unitPrice,
        minOrderQty: input.minOrderQty,
        leadTimeDays: input.leadTimeDays,
      },
      include: { material: true },
    })
  }

  async getCatalogEntry(supplierId: string, materialId: string) {
    return db.supplierCatalog.findUnique({
      where: {
        supplierId_materialId: { supplierId, materialId },
      },
      include: { material: true },
    })
  }

  async updateCatalogEntry(
    catalogId: string,
    input: { unitPrice?: number; minOrderQty?: number; leadTimeDays?: number }
  ) {
    return db.supplierCatalog.update({
      where: { id: catalogId },
      data: input,
      include: { material: true },
    })
  }

  async removeCatalogEntry(catalogId: string) {
    return db.supplierCatalog.delete({ where: { id: catalogId } })
  }

  async findBestSupplier(materialId: string) {
    const catalogs = await db.supplierCatalog.findMany({
      where: { materialId, isActive: true },
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

    return catalogs.length > 0 ? catalogs[0].supplier : null
  }
}
