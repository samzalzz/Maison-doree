# Supplier Management (Cycle B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build complete supplier lifecycle management with intelligent PO workflow, performance analytics, and batch integration.

**Architecture:** Modular supplier subsystem with 4 service classes (Supplier, PurchaseOrder, Performance, Alert), 13 API routes, and 5 admin UI pages. Suppliers are managed by MANAGER/ADMIN roles; no supplier portal.

**Tech Stack:** Next.js 14 App Router, React 18, Prisma ORM, PostgreSQL, Tailwind CSS, Zod, Jest

---

## PHASE 1: DATABASE & SCHEMA (Days 1-2)

### Task 1: Add Supplier Models to Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add four new models to schema**

Open `prisma/schema.prisma` and add these models after the QualityInspection section (around line 917):

```prisma
// ---------------------------------------------------------------------------
// SUPPLIER MANAGEMENT SYSTEM
// ---------------------------------------------------------------------------

model SupplierCatalog {
  id              String      @id @default(cuid())
  supplierId      String
  supplier        Supplier    @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  materialId      String
  material        RawMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)
  
  unitPrice       Decimal     @db.Decimal(12, 4)
  minOrderQty     Int
  leadTimeDays    Int
  isActive        Boolean     @default(true)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@unique([supplierId, materialId])
  @@index([supplierId])
  @@index([materialId])
}

model PurchaseOrderSuggestion {
  id              String      @id @default(cuid())
  labId           String
  lab             ProductionLab @relation(fields: [labId], references: [id], onDelete: Cascade)
  
  materialId      String
  material        RawMaterial @relation(fields: [materialId], references: [id], onDelete: Cascade)
  
  supplierId      String
  supplier        Supplier    @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  suggestedQty    Decimal     @db.Decimal(10, 2)
  reasoning       String
  
  status          String      @default("PENDING")
  
  approvedAt      DateTime?
  rejectedAt      DateTime?
  rejectionReason String?
  
  createdAt       DateTime    @default(now())
  expiresAt       DateTime
  
  @@index([labId])
  @@index([status])
  @@index([expiresAt])
}

model SupplierPerformanceMetric {
  id              String      @id @default(cuid())
  supplierId      String      @unique
  supplier        Supplier    @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  totalOrders     Int         @default(0)
  totalDelivered  Int         @default(0)
  
  onTimeCount     Int         @default(0)
  onTimePercent   Int         @default(0)
  
  inspectionsPassed Int       @default(0)
  inspectionsFailed Int       @default(0)
  qualityPassRate Int         @default(0)
  
  trend30Day      String      @default("stable")
  reliabilityScore Int        @default(0)
  
  lastUpdated     DateTime    @updatedAt
  
  @@index([supplierId])
}

model SupplierCategoryPerformance {
  id              String      @id @default(cuid())
  supplierId      String
  supplier        Supplier    @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  
  category        String
  
  onTimePercent   Int         @default(0)
  qualityPassRate Int         @default(0)
  reliabilityScore Int        @default(0)
  
  lastUpdated     DateTime    @updatedAt
  
  @@unique([supplierId, category])
  @@index([supplierId])
}
```

- [ ] **Step 2: Update Supplier model with new fields and relations**

Find the Supplier model (around line 636) and update it:

```prisma
model Supplier {
  id           String   @id @default(cuid())
  name         String
  email        String?
  phone        String?
  leadTimeDays Int
  categories   String[]
  
  // New fields
  address       String?
  city          String?
  contactPerson String?
  status        String   @default("ACTIVE")
  notes         String?

  // Relations
  purchaseOrders     PurchaseOrder[]
  qualityInspections QualityInspection[]
  mrpSuggestions     MRPSuggestion[]
  
  // New relations
  catalogs           SupplierCatalog[]
  poSuggestions      PurchaseOrderSuggestion[]
  performanceMetric  SupplierPerformanceMetric?
  categoryPerformance SupplierCategoryPerformance[]

  createdAt DateTime @default(now())

  @@index([name])
}
```

- [ ] **Step 3: Update PurchaseOrder model**

Find PurchaseOrder model (around line 654) and add these fields before the closing brace:

```prisma
  // Workflow tracking
  approvedBy           String?
  sentAt               DateTime?
  expectedDeliveryDate DateTime?
  actualDeliveryDate   DateTime?
  receivedQuantity     Decimal? @db.Decimal(10, 2)
  qualityInspectionId  String?
  
  @@index([approvedBy])
```

- [ ] **Step 4: Update ProductionLab model**

Find ProductionLab model (around line 387) and add this relation in the Relations section:

```prisma
  poSuggestions       PurchaseOrderSuggestion[]
```

- [ ] **Step 5: Update RawMaterial model**

Find RawMaterial model (around line 490) and add this relation in the Relations section:

```prisma
  supplierCatalogs    SupplierCatalog[]
```

- [ ] **Step 6: Verify schema syntax**

Run: `npx prisma validate`

Expected: No errors, "✓ Your schema is valid'

---

### Task 2: Create Database Migration

**Files:**
- Create: `prisma/migrations/20260419000004_add_supplier_system/migration.sql`

- [ ] **Step 1: Generate migration from schema changes**

Run: `npx prisma migrate dev --name add_supplier_system`

This will:
- Create the migration directory and file
- Apply the migration to your local database
- Generate Prisma client

- [ ] **Step 2: Verify migration file was created**

Check: `prisma/migrations/20260419000004_add_supplier_system/migration.sql` exists

Expected: SQL DDL with CREATE TABLE for 4 new models + ALTER TABLE for updates

- [ ] **Step 3: Verify Prisma client generated successfully**

Run: `npx prisma generate`

Expected: Client types generated with new models

- [ ] **Step 4: Commit migration**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat: add supplier management database models (Task 2)"
```

---

## PHASE 2: VALIDATORS (Days 2-3)

### Task 3: Create Supplier Validators

**Files:**
- Create: `lib/validators-supplier.ts`

- [ ] **Step 1: Write validators file**

Create `lib/validators-supplier.ts`:

```typescript
import { z } from 'zod'

// ============================================================================
// SUPPLIER VALIDATORS
// ============================================================================

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  contactPerson: z.string().optional(),
  categories: z.array(z.string()).default([]),
})

export const UpdateSupplierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  contactPerson: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  notes: z.string().max(500).optional(),
}).strict()

export const SupplierFiltersSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
}).strict()

// ============================================================================
// SUPPLIER CATALOG VALIDATORS
// ============================================================================

export const CreateCatalogEntrySchema = z.object({
  supplierId: z.string().cuid(),
  materialId: z.string().cuid(),
  unitPrice: z.coerce.number().positive('Price must be positive'),
  minOrderQty: z.coerce.number().int().positive(),
  leadTimeDays: z.coerce.number().int().positive(),
}).strict()

export const UpdateCatalogEntrySchema = z.object({
  unitPrice: z.coerce.number().positive().optional(),
  minOrderQty: z.coerce.number().int().positive().optional(),
  leadTimeDays: z.coerce.number().int().positive().optional(),
}).strict()

// ============================================================================
// PURCHASE ORDER SUGGESTION VALIDATORS
// ============================================================================

export const CreatePOSuggestionSchema = z.object({
  labId: z.string().cuid(),
  materialId: z.string().cuid(),
  suggestedQty: z.coerce.number().positive(),
  reasoning: z.string().min(5).max(200),
}).strict()

export const ApprovePOSuggestionSchema = z.object({
  qtyOverride: z.coerce.number().positive().optional(),
  supplierId: z.string().cuid().optional(),
  approvedBy: z.string().min(1),
}).strict()

export const RejectPOSuggestionSchema = z.object({
  reason: z.string().min(5).max(200),
}).strict()

// ============================================================================
// PURCHASE ORDER VALIDATORS
// ============================================================================

export const ReceivePOSchema = z.object({
  receivedQuantity: z.coerce.number().positive().optional(),
  qualityInspectionId: z.string().cuid().optional(),
}).strict()

export const PurchaseOrderFiltersSchema = z.object({
  status: z.string().optional(),
  supplierId: z.string().cuid().optional(),
  materialId: z.string().cuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
}).strict()

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>
export type SupplierFilters = z.infer<typeof SupplierFiltersSchema>

export type CreateCatalogEntryInput = z.infer<typeof CreateCatalogEntrySchema>
export type UpdateCatalogEntryInput = z.infer<typeof UpdateCatalogEntrySchema>

export type CreatePOSuggestionInput = z.infer<typeof CreatePOSuggestionSchema>
export type ApprovePOSuggestionInput = z.infer<typeof ApprovePOSuggestionSchema>
export type RejectPOSuggestionInput = z.infer<typeof RejectPOSuggestionSchema>

export type ReceivePOInput = z.infer<typeof ReceivePOSchema>
export type PurchaseOrderFilters = z.infer<typeof PurchaseOrderFiltersSchema>
```

- [ ] **Step 2: Commit validators**

```bash
git add lib/validators-supplier.ts
git commit -m "feat: add supplier validators (Task 3)"
```

---

## PHASE 3: SERVICES (Days 3-5)

### Task 4: Create Supplier Service

**Files:**
- Create: `lib/services/supplier-service.ts`

- [ ] **Step 1: Write supplier service**

Create `lib/services/supplier-service.ts`:

```typescript
import { prisma } from '@/lib/db'
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
    return prisma.supplier.create({
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
    const supplier = await prisma.supplier.findUnique({
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
      prisma.supplier.findMany({
        where,
        include: { performanceMetric: true },
        skip,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.count({ where }),
    ])

    return { suppliers, total, page: filters.page, limit: filters.limit }
  }

  async updateSupplier(id: string, input: UpdateSupplierInput) {
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new SupplierNotFoundError(id)

    return prisma.supplier.update({
      where: { id },
      data: input,
    })
  }

  async deactivateSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } })
    if (!supplier) throw new SupplierNotFoundError(id)

    return prisma.supplier.update({
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
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
    })
    if (!supplier) throw new SupplierNotFoundError(input.supplierId)

    const material = await prisma.rawMaterial.findUnique({
      where: { id: input.materialId },
    })
    if (!material) throw new SupplierError('Material not found')

    const existing = await prisma.supplierCatalog.findUnique({
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

    return prisma.supplierCatalog.create({
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
    return prisma.supplierCatalog.findUnique({
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
    return prisma.supplierCatalog.update({
      where: { id: catalogId },
      data: input,
      include: { material: true },
    })
  }

  async removeCatalogEntry(catalogId: string) {
    return prisma.supplierCatalog.delete({ where: { id: catalogId } })
  }

  async findBestSupplier(materialId: string) {
    const catalogs = await prisma.supplierCatalog.findMany({
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
```

- [ ] **Step 2: Commit service**

```bash
git add lib/services/supplier-service.ts
git commit -m "feat: implement supplier service (Task 4)"
```

---

### Task 5: Create Purchase Order Service

**Files:**
- Create: `lib/services/purchase-order-service.ts`

- [ ] **Step 1: Write PO service**

Create `lib/services/purchase-order-service.ts`:

```typescript
import { prisma } from '@/lib/db'
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
    const lab = await prisma.productionLab.findUnique({ where: { id: input.labId } })
    if (!lab) throw new POError('Lab not found')

    const material = await prisma.rawMaterial.findUnique({ where: { id: input.materialId } })
    if (!material) throw new POError('Material not found')

    const catalogs = await prisma.supplierCatalog.findMany({
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    return prisma.purchaseOrderSuggestion.create({
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

    return prisma.purchaseOrderSuggestion.findMany({
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
    const suggestion = await prisma.purchaseOrderSuggestion.findUnique({
      where: { id: suggestionId },
      include: { supplier: { include: { catalogs: true } } },
    })

    if (!suggestion) throw new PONotFoundError('Suggestion not found')

    const finalSupplierId = input.supplierId || suggestion.supplierId
    const finalQty = input.qtyOverride || suggestion.suggestedQty

    const catalog = await prisma.supplierCatalog.findUnique({
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

    const po = await prisma.purchaseOrder.create({
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

    await prisma.purchaseOrderSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    })

    return po
  }

  async rejectSuggestion(suggestionId: string, reason: string) {
    const suggestion = await prisma.purchaseOrderSuggestion.findUnique({
      where: { id: suggestionId },
    })

    if (!suggestion) throw new PONotFoundError('Suggestion not found')

    return prisma.purchaseOrderSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    })
  }

  async getPurchaseOrder(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
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

    return prisma.purchaseOrder.findMany({
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
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { material: true },
    })

    if (!po) throw new PONotFoundError('PO not found')

    const receivedQty = input.receivedQuantity || po.quantity
    const actualDeliveryDate = new Date()
    const isOnTime = actualDeliveryDate <= po.expectedDeliveryDate!

    return prisma.$transaction(async (tx) => {
      // Update PO
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

      // Update lab stock
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

      // Update performance metrics
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
```

- [ ] **Step 2: Commit service**

```bash
git add lib/services/purchase-order-service.ts
git commit -m "feat: implement purchase order service (Task 5)"
```

---

### Task 6: Create Supplier Performance Service

**Files:**
- Create: `lib/services/supplier-performance-service.ts`

- [ ] **Step 1: Write performance service**

Create `lib/services/supplier-performance-service.ts`:

```typescript
import { prisma } from '@/lib/db'

export class SupplierPerformanceService {
  async calculateSupplierMetrics(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) throw new Error('Supplier not found')

    // Get all POs in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const pos = await prisma.purchaseOrder.findMany({
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

    // Get QC results
    const qcResults = await prisma.qualityInspection.findMany({
      where: {
        supplierId,
        actualDate: { gte: thirtyDaysAgo },
      },
    })

    const passedQC = qcResults.filter((qc) => qc.status === 'PASSED').length
    const qualityPassRate =
      qcResults.length > 0 ? Math.round((passedQC / qcResults.length) * 100) : 0

    // Calculate trend
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const olderPOs = await prisma.purchaseOrder.findMany({
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

    // Reliability score: (on-time 40% + quality 40% + trend 20%)
    const trendScore = trend === 'improving' ? 5 : trend === 'declining' ? -10 : 0
    const reliabilityScore = Math.max(
      0,
      Math.min(100, Math.round(onTimePercent * 0.4 + qualityPassRate * 0.4 + (50 + trendScore)))
    )

    return prisma.supplierPerformanceMetric.upsert({
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
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) throw new Error('Supplier not found')

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // POs for this category
    const pos = await prisma.purchaseOrder.findMany({
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

    // QC for this category
    const qcResults = await prisma.qualityInspection.findMany({
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

    return prisma.supplierCategoryPerformance.upsert({
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
    const suppliers = await prisma.supplierPerformanceMetric.findMany({
      include: { supplier: true },
      orderBy: { reliabilityScore: 'desc' },
    })

    const allPOs = await prisma.purchaseOrder.findMany({
      where: { status: 'DELIVERED' },
    })

    const allOnTimeCount = allPOs.filter(
      (po) => po.actualDeliveryDate! <= po.expectedDeliveryDate!
    ).length
    const portfolioOnTimePercent =
      allPOs.length > 0 ? Math.round((allOnTimeCount / allPOs.length) * 100) : 0

    const allQC = await prisma.qualityInspection.findMany({})
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
```

- [ ] **Step 2: Commit service**

```bash
git add lib/services/supplier-performance-service.ts
git commit -m "feat: implement supplier performance service (Task 6)"
```

---

### Task 7: Create Supplier Alert Service

**Files:**
- Create: `lib/services/supplier-alert-service.ts`

- [ ] **Step 1: Write alert service**

Create `lib/services/supplier-alert-service.ts`:

```typescript
import { prisma } from '@/lib/db'

export class SupplierAlertService {
  async checkBatchMaterialStatus(batchId: string) {
    const batch = await prisma.productionBatch.findUnique({
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

      // Get any pending POs for this material
      const pos = await prisma.purchaseOrder.findMany({
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
    const lab = await prisma.productionLab.findUnique({
      where: { id: labId },
      include: { stock: { include: { material: true } } },
    })

    if (!lab) throw new Error('Lab not found')

    const delayedMaterials: any[] = []
    const belowThresholdMaterials: any[] = []

    // Check for delayed materials
    const activePOs = await prisma.purchaseOrder.findMany({
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

    // Check for below-threshold materials
    lab.stock.forEach((stock) => {
      if (stock.quantity.lessThan(stock.minThreshold)) {
        const daysUntilDepletion = Math.max(1, Math.floor(stock.quantity.toNumber() / 5)) // Assuming 5 units per day avg

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
```

- [ ] **Step 2: Commit service**

```bash
git add lib/services/supplier-alert-service.ts
git commit -m "feat: implement supplier alert service (Task 7)"
```

---

## PHASE 4: API ROUTES (Days 5-7)

### Task 8: Create Supplier API Routes

**Files:**
- Create: `app/api/supplier/suppliers/route.ts`
- Create: `app/api/supplier/suppliers/[id]/route.ts`

- [ ] **Step 1: Create suppliers endpoint (POST/GET)**

Create `app/api/supplier/suppliers/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { CreateSupplierSchema, SupplierFiltersSchema } from '@/lib/validators-supplier'
import { SupplierService } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = CreateSupplierSchema.parse(body)
    const supplier = await service.createSupplier(input)

    return NextResponse.json({ success: true, data: { supplier } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.errors },
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const filters = SupplierFiltersSchema.parse({
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 20,
    })

    const result = await service.listSuppliers(filters)

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 2: Create supplier detail endpoint (GET/PATCH/DELETE)**

Create `app/api/supplier/suppliers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { UpdateSupplierSchema } from '@/lib/validators-supplier'
import { SupplierService, SupplierNotFoundError } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const GET = withAuth(async (req: NextRequest, { params, session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const supplier = await service.getSupplier(params.id)
    return NextResponse.json({ success: true, data: { supplier } })
  } catch (error: any) {
    if (error instanceof SupplierNotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const PATCH = withAuth(async (req: NextRequest, { params, session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = UpdateSupplierSchema.parse(body)
    const supplier = await service.updateSupplier(params.id, input)

    return NextResponse.json({ success: true, data: { supplier } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    if (error instanceof SupplierNotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: NextRequest, { params, session }) => {
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    await service.deactivateSupplier(params.id)
    return NextResponse.json({ success: true, data: { message: 'Supplier deactivated' } })
  } catch (error: any) {
    if (error instanceof SupplierNotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 3: Commit API routes**

```bash
git add app/api/supplier/
git commit -m "feat: add supplier CRUD API routes (Task 8)"
```

---

### Task 9: Create Catalog API Routes

**Files:**
- Create: `app/api/supplier/catalogs/route.ts`
- Create: `app/api/supplier/catalogs/[catalogId]/route.ts`

- [ ] **Step 1: Create catalogs endpoint (POST/GET)**

Create `app/api/supplier/catalogs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { CreateCatalogEntrySchema } from '@/lib/validators-supplier'
import { SupplierService, CatalogEntryAlreadyExistsError, SupplierError } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = CreateCatalogEntrySchema.parse(body)
    const catalog = await service.addToSupplierCatalog(input)

    return NextResponse.json({ success: true, data: { catalog } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    if (error instanceof CatalogEntryAlreadyExistsError) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: error.message } },
        { status: 409 }
      )
    }
    if (error instanceof SupplierError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req: NextRequest, { session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplierId')

    const catalogs = await prisma.supplierCatalog.findMany({
      where: supplierId ? { supplierId } : {},
      include: { supplier: true, material: true },
    })

    return NextResponse.json({ success: true, data: { catalogs } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 2: Create catalog detail endpoint (PATCH/DELETE)**

Create `app/api/supplier/catalogs/[catalogId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { UpdateCatalogEntrySchema } from '@/lib/validators-supplier'
import { SupplierService } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const PATCH = withAuth(async (req: NextRequest, { params, session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = UpdateCatalogEntrySchema.parse(body)
    const catalog = await service.updateCatalogEntry(params.catalogId, input)

    return NextResponse.json({ success: true, data: { catalog } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: NextRequest, { params, session }) => {
  if (!['MANAGER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    await service.removeCatalogEntry(params.catalogId)
    return NextResponse.json({ success: true, data: { message: 'Catalog entry deleted' } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/supplier/catalogs/
git commit -m "feat: add supplier catalog API routes (Task 9)"
```

**Note:** The remaining API route tasks (PO suggestions, PO tracking, performance dashboard, CSV import, batch alerts) follow the same pattern. For brevity in this plan, I'm showing the complete structure for the first 2 tasks. Each subsequent API task follows TDD (write test → implement → verify → commit) with similar endpoint structure.

---

### Task 10: Create PO Suggestion Routes

**Files:**
- Create: `app/api/supplier/po-suggestions/route.ts`
- Create: `app/api/supplier/po-suggestions/[id]/approve/route.ts`
- Create: `app/api/supplier/po-suggestions/[id]/reject/route.ts`

**Implementation:** Following same pattern as Tasks 8-9. Create POST/GET for suggestions, PATCH for approve/reject with proper validation and error handling.

**Commit:** `git commit -m "feat: add PO suggestion API routes (Task 10)"`

---

### Task 11: Create PO Tracking Routes

**Files:**
- Create: `app/api/supplier/purchase-orders/route.ts`
- Create: `app/api/supplier/purchase-orders/[poId]/receive/route.ts`

**Implementation:** GET for listing with filters, PATCH for receive with stock update and performance metric updates.

**Commit:** `git commit -m "feat: add purchase order tracking API routes (Task 11)"`

---

### Task 12: Create Performance Dashboard Route

**Files:**
- Create: `app/api/supplier/performance/route.ts`

**Implementation:** GET aggregated metrics, supplier rankings, portfolio KPIs, risk alerts.

**Commit:** `git commit -m "feat: add supplier performance dashboard API route (Task 12)"`

---

### Task 13: Create CSV Import Routes

**Files:**
- Create: `app/api/supplier/import/suppliers/route.ts`
- Create: `app/api/supplier/import/catalogs/route.ts`

**Implementation:** POST with FormData, parse CSV, validate rows, create in transaction, return summary with imported count and errors.

**Commit:** `git commit -m "feat: add CSV import API routes (Task 13)"`

---

### Task 14: Create Batch Alert Route

**Files:**
- Create: `app/api/supplier/batch-alerts/route.ts`

**Implementation:** GET with optional batchId or labId query param, return delayed materials and below-threshold materials.

**Commit:** `git commit -m "feat: add batch alert API route (Task 14)"`

---

## PHASE 5: UI COMPONENTS & PAGES (Days 7-9)

### Task 15: Create Supplier List Page

**Files:**
- Create: `components/supplier/SupplierList.tsx`
- Create: `app/(admin)/admin/suppliers/page.tsx`

**Implementation:** 
- Search + status filter dropdown
- Supplier table with columns: Name, Email, Status, Reliability Score, On-Time %, Quality %
- Click row → navigate to detail
- Actions dropdown: Edit, View POs, Performance, Delete
- "+ Add Supplier" button → modal
- "Import Suppliers" button → CSV upload modal
- GET `/api/supplier/suppliers?status=X&search=Y` with 60s refetch

**Commit:** `git commit -m "feat: create supplier list page and components (Task 15)"`

---

### Task 16: Create Supplier Detail Page

**Files:**
- Create: `components/supplier/SupplierDetail.tsx`
- Create: `app/(admin)/admin/suppliers/[id]/page.tsx`

**Sections:**
- Supplier info card with edit/archive/block buttons
- Performance scorecard (reliability score, on-time %, quality %, trend)
- Category breakdown table
- Material catalog table with edit/remove actions
- Recent purchase orders section
- Quality inspections section

**Commit:** `git commit -m "feat: create supplier detail page (Task 16)"`

---

### Task 17: Create Purchase Order Tracking Page

**Files:**
- Create: `components/supplier/PurchaseOrderTracking.tsx`
- Create: `app/(admin)/admin/purchase-orders/page.tsx`

**Tabs:**
- Pending Approvals: Show suggestions, approve/reject with override modals
- Active Orders: Show PENDING/ORDERED POs, mark received action
- Delivery History: DELIVERED/CANCELLED POs
- Stats bar: Pending count, Active count, Overdue count

**Commit:** `git commit -m "feat: create purchase order tracking page (Task 17)"`

---

### Task 18: Create Performance Dashboard Page

**Files:**
- Create: `components/supplier/SupplierPerformanceDashboard.tsx`
- Create: `app/(admin)/admin/supplier-performance/page.tsx`

**Sections:**
- Portfolio metrics cards (avg reliability score, on-time %, quality %)
- Supplier ranking table sorted by reliability score
- Trend charts (line: reliability over 30 days, stacked bar: on-time vs late)
- Risk alerts banner (score drops, low quality, chronic lateness)

**Commit:** `git commit -m "feat: create performance dashboard page (Task 18)"`

---

### Task 19: Create Inventory Replenishment Page

**Files:**
- Create: `components/supplier/InventoryReplenishment.tsx`
- Create: `app/(admin)/admin/inventory-replenishment/page.tsx`

**Sections:**
- Stock status by lab (lab dropdown selector, materials with stock/threshold/days until)
- Auto-suggestion preview (materials that will need ordering in 7 days)
- Forecast integration (demand forecast vs stock depletion charts)

**Commit:** `git commit -m "feat: create inventory replenishment page (Task 19)"`

---

### Task 20: Create UI Modals

**Files:**
- Create: `components/supplier/modals/AddSupplierModal.tsx`
- Create: `components/supplier/modals/ApprovePOSuggestionModal.tsx`
- Create: `components/supplier/modals/RejectPOSuggestionModal.tsx`
- Create: `components/supplier/modals/ReceivePOModal.tsx`
- Create: `components/supplier/modals/CSVImportModal.tsx`
- Create: `components/supplier/modals/AddCatalogEntryModal.tsx`

**Implementation:** Form modals with proper validation, error toast notifications, loading states, disabled buttons during API calls.

**Commit:** `git commit -m "feat: create supplier modals (Task 20)"`

---

## PHASE 6: TESTS (Days 9-10)

### Task 21: Write API Tests

**Files:**
- Create: `app/api/supplier/__tests__/supplier-routes.test.ts` (10 tests)
- Create: `app/api/supplier/__tests__/po-routes.test.ts` (10 tests)
- Create: `app/api/supplier/__tests__/import-routes.test.ts` (8 tests)

**Test Coverage:**
- Supplier CRUD: create, list with filters, get, update, delete
- Catalog: add, get, update price/lead time, remove
- PO suggestions: create, list pending, approve, reject
- PO tracking: list with filters, receive (updates stock + metrics)
- CSV import: valid data, invalid data, duplicates
- Error cases: 400/403/404/409 errors with proper messages

**Commit:** `git commit -m "feat: add API route tests (Task 21)"`

---

### Task 22: Write Service Tests

**Files:**
- Create: `lib/services/__tests__/supplier-service.test.ts` (10 tests)
- Create: `lib/services/__tests__/purchase-order-service.test.ts` (10 tests)
- Create: `lib/services/__tests__/supplier-performance-service.test.ts` (10 tests)

**Test Coverage:**
- SupplierService: CRUD operations, catalog management, best supplier selection
- PurchaseOrderService: suggestion creation, approval (validates catalog), rejection, receiving (stock update + metrics)
- SupplierPerformanceService: on-time %, quality %, reliability score calculation, trend detection
- Error cases: not found, duplicate, validation

**Commit:** `git commit -m "feat: add service tests (Task 22)"`

---

### Task 23: Write UI Component Tests

**Files:**
- Create: `app/(admin)/__tests__/supplier-pages.test.tsx` (12 tests)

**Test Coverage:**
- Supplier list: render table, search/filter works, navigation
- Supplier detail: info card, metrics display, catalog table, recent POs
- PO tracking: pending approvals tab, active orders tab, delivery history
- Performance dashboard: ranking table, charts render, risk alerts
- Inventory replenishment: stock status by lab, forecast preview

**Commit:** `git commit -m "feat: add UI component tests (Task 23)"`

---

### Task 24: Integration Tests & Final Verification

**Files:**
- Create: `app/api/supplier/__tests__/supplier-integration.test.ts` (12 tests)

**Test Scenarios:**
- End-to-end: Create supplier → Add catalog → Auto-suggest PO → Approve → Receive → Verify stock updated + metrics calculated
- Batch integration: Create batch → Check material status → Alert for delayed supplier
- Performance flow: Create POs → Receive on-time → Verify reliability score improves
- CSV import flow: Import suppliers + catalogs → Verify data persisted

**Commit:** `git commit -m "feat: add integration tests and final verification (Task 24)"`

---

## FINAL VERIFICATION

- [ ] Run full test suite: `npm test -- supplier`
- [ ] Expected: 80+ tests passing
- [ ] Check coverage: `npm test -- supplier --coverage`
- [ ] Expected: 80%+ coverage on services and API routes
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Expected: No type errors

---

## Success Criteria

✅ Supplier CRUD works, CSV import functional  
✅ Supplier catalog: pricing + lead times persisted  
✅ PO suggestions auto-generated when stock below threshold  
✅ Manager can approve, reject, modify suggestions  
✅ Supplier performance metrics calculated (on-time %, quality %, reliability score)  
✅ Batch detail shows material delays  
✅ Manager lab overview shows supplier impact  
✅ Performance dashboard shows risk alerts  
✅ Received POs update LabStock atomically  
✅ CSV import handles duplicates gracefully  
✅ 80+ tests passing, no regressions in Cycle A  
✅ All error cases handled with clear messages  

---

## Timeline Summary

- **Days 1-2:** Database schema + migrations
- **Days 2-3:** Validators
- **Days 3-5:** Services (4 classes)
- **Days 5-7:** API routes (13 endpoints)
- **Days 7-9:** UI pages (5 pages + modals)
- **Days 9-10:** Tests (80+ tests)
- **Total: 2 weeks** (can be parallelized)
