# Supplier Management (Cycle B) - Design Specification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan for this design.

**Goal:** Enable complete supplier lifecycle management with intelligent purchase order workflow, performance tracking, and integration into Worker Dashboard batch planning.

**Architecture:** Modular supplier subsystem with 4 service classes, 11 API routes, 5 admin UI pages, and integration points for batch delay alerts.

**Tech Stack:** Next.js 14 App Router, React 18, Prisma ORM, PostgreSQL, Tailwind CSS, Zod validators, Jest

---

## Context

**Current State:**
- Cycle A (Worker Dashboard) complete with 656 tests passing
- Basic Supplier and PurchaseOrder models exist in schema
- RawMaterial, LabStock, ProductionBatch models for inventory tracking
- No supplier catalog, PO workflow, or performance metrics yet

**User Roles:**
- **MANAGER** — Create suppliers, manage catalogs, approve PO suggestions, adjust stock
- **ADMIN** — Same as manager + supplier deactivation, performance analytics

**Scope:** Lightweight, focused supplier management (no EDI/B2B portals). CSV import for bulk data, admin-only workflows, batch-aware alerting.

---

## Database Design

### New Models

#### SM-1. SupplierCatalog
Links suppliers to materials with pricing and lead times.

```prisma
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
```

#### SM-2. PurchaseOrderSuggestion
Auto-generated suggestions when stock falls below threshold.

```prisma
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
```

#### SM-3. SupplierPerformanceMetric
Aggregated metrics per supplier (on-time %, quality %, trend, reliability score).

```prisma
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
```

#### SM-4. SupplierCategoryPerformance
Category-specific metrics (e.g., Flour supplier rated separately from sugar supplier).

```prisma
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

### Model Updates

#### Update Supplier
```prisma
model Supplier {
  id           String   @id @default(cuid())
  name         String
  email        String?
  phone        String?
  leadTimeDays Int
  categories   String[]

  // Add new fields
  address       String?
  city          String?
  contactPerson String?
  status        String   @default("ACTIVE")  // ACTIVE | INACTIVE | BLOCKED
  notes         String?

  // Add new relations
  purchaseOrders     PurchaseOrder[]
  qualityInspections QualityInspection[]
  mrpSuggestions     MRPSuggestion[]
  catalogs           SupplierCatalog[]
  poSuggestions      PurchaseOrderSuggestion[]
  performanceMetric  SupplierPerformanceMetric?
  categoryPerformance SupplierCategoryPerformance[]

  createdAt DateTime @default(now())
}
```

#### Update PurchaseOrder
```prisma
model PurchaseOrder {
  // ... existing fields ...
  
  // Add new fields for workflow tracking
  approvedBy           String?
  sentAt               DateTime?
  expectedDeliveryDate DateTime?
  actualDeliveryDate   DateTime?
  receivedQuantity     Decimal? @db.Decimal(10, 2)
  qualityInspectionId  String?
  
  @@index([approvedBy])
}
```

#### Update ProductionLab
```prisma
model ProductionLab {
  // ... existing fields ...
  poSuggestions PurchaseOrderSuggestion[]
}
```

#### Update RawMaterial
```prisma
model RawMaterial {
  // ... existing fields ...
  supplierCatalogs SupplierCatalog[]
}
```

---

## API Routes

### Supplier Management

#### 1. POST `/api/supplier/suppliers`
**Auth:** MANAGER or ADMIN

**Body:**
```json
{
  "name": "Flour Corp",
  "email": "contact@flourcorp.ma",
  "phone": "+212-XXX",
  "address": "123 Main St",
  "city": "Casablanca",
  "contactPerson": "Ahmed",
  "categories": ["Flour", "Sugar"]
}
```

**Returns:**
```json
{
  "success": true,
  "data": { "supplier": {...} }
}
```

#### 2. GET `/api/supplier/suppliers`
**Auth:** MANAGER or ADMIN

**Query:** `?status=ACTIVE&search=Flour&page=1&limit=20`

**Returns:**
```json
{
  "success": true,
  "data": {
    "suppliers": [
      {
        "id": "...",
        "name": "Flour Corp",
        "status": "ACTIVE",
        "reliabilityScore": 96,
        "onTimePercent": 95,
        "qualityPassRate": 98
      }
    ],
    "total": 1
  }
}
```

#### 3. GET `/api/supplier/suppliers/[id]`
**Auth:** MANAGER or ADMIN

**Returns:**
```json
{
  "success": true,
  "data": {
    "supplier": {...},
    "performanceMetric": {
      "reliabilityScore": 96,
      "onTimePercent": 95,
      "qualityPassRate": 98,
      "trend30Day": "stable",
      "totalOrders": 15,
      "totalDelivered": 14
    },
    "categoryPerformance": [
      {
        "category": "Flour",
        "onTimePercent": 98,
        "qualityPassRate": 99,
        "reliabilityScore": 98
      }
    ],
    "catalogs": [
      {
        "id": "...",
        "materialId": "...",
        "materialName": "Flour",
        "unitPrice": 15,
        "minOrderQty": 50,
        "leadTimeDays": 5
      }
    ],
    "recentPOs": [...]
  }
}
```

#### 4. PATCH `/api/supplier/suppliers/[id]`
**Auth:** MANAGER or ADMIN

**Body:** (partial update)
```json
{
  "phone": "+212-YYY",
  "status": "INACTIVE"
}
```

#### 5. DELETE `/api/supplier/suppliers/[id]`
**Auth:** ADMIN only
**Logic:** Soft-delete (sets status: INACTIVE)

---

### Supplier Catalog (Pricing)

#### 6. POST `/api/supplier/catalogs`
**Auth:** MANAGER or ADMIN

**Body:**
```json
{
  "supplierId": "...",
  "materialId": "...",
  "unitPrice": 15.50,
  "minOrderQty": 50,
  "leadTimeDays": 5
}
```

**Returns:** Created SupplierCatalog

**Error Cases:**
- 404: Supplier or material not found
- 409: Catalog entry already exists for this supplier-material pair

#### 7. GET `/api/supplier/catalogs`
**Query:** `?supplierId=X&materialId=Y`

**Returns:** List of SupplierCatalog entries with supplier and material details

#### 8. PATCH `/api/supplier/catalogs/[catalogId]`
**Auth:** MANAGER or ADMIN

**Body:** (partial)
```json
{
  "unitPrice": 16.00,
  "leadTimeDays": 6
}
```

#### 9. DELETE `/api/supplier/catalogs/[catalogId]`
**Auth:** MANAGER or ADMIN

---

### Purchase Order Workflow

#### 10. POST `/api/supplier/po-suggestions`
**Auth:** Internal (called by ReplenishmentService or admin manually)

**Body:**
```json
{
  "labId": "...",
  "materialId": "...",
  "suggestedQty": 100,
  "reasoning": "Stock below threshold (20 < 50)"
}
```

**Logic:**
- Find best supplier for material (by reliability score)
- Get pricing from SupplierCatalog
- Create PurchaseOrderSuggestion with status: PENDING

**Returns:** Created PurchaseOrderSuggestion with supplier details

#### 11. GET `/api/supplier/po-suggestions`
**Query:** `?status=PENDING&labId=X&page=1&limit=20`

**Returns:** List of PurchaseOrderSuggestions

#### 12. PATCH `/api/supplier/po-suggestions/[id]/approve`
**Auth:** MANAGER or ADMIN

**Body:**
```json
{
  "qtyOverride": 120,        // optional, override suggested qty
  "supplierId": "...",       // optional, switch suppliers
  "approvedBy": "admin@..."
}
```

**Logic:**
- Validate supplier has catalog for material
- Create PurchaseOrder with status: PENDING
- Update suggestion status: APPROVED, set approvedAt
- Return created PurchaseOrder

**Returns:** Created PurchaseOrder

**Error Cases:**
- 404: Suggestion or supplier not found
- 400: Supplier doesn't have catalog for material

#### 13. PATCH `/api/supplier/po-suggestions/[id]/reject`
**Auth:** MANAGER or ADMIN

**Body:**
```json
{
  "reason": "Stock already received from another supplier"
}
```

**Logic:**
- Update suggestion status: REJECTED, set rejectedAt, rejectionReason

---

### Purchase Order Tracking

#### 14. GET `/api/supplier/purchase-orders`
**Query:** `?status=ORDERED,PENDING&supplierId=X&page=1&limit=20`

**Returns:**
```json
{
  "success": true,
  "data": {
    "purchaseOrders": [
      {
        "id": "...",
        "poNumber": "PO-2026-04-19-001",
        "supplier": {...},
        "material": {...},
        "quantity": 100,
        "status": "ORDERED",
        "expectedDeliveryDate": "2026-04-24",
        "daysOverdue": 0,
        "isOverdue": false
      }
    ],
    "total": 5
  }
}
```

#### 15. PATCH `/api/supplier/purchase-orders/[poId]/receive`
**Auth:** MANAGER or ADMIN

**Body:**
```json
{
  "receivedQuantity": 95,  // null = full delivery (100)
  "qualityInspectionId": "..."
}
```

**Logic:**
- Update PurchaseOrder:
  - actualDeliveryDate: now()
  - receivedQuantity: input qty (or quantity if null)
  - status: DELIVERED
- Update LabStock: increment quantity
- Call SupplierPerformanceService.recordPODelivery() to update on-time metric
- If qualityInspectionId provided, link it
- Return updated PurchaseOrder

**Returns:** Updated PurchaseOrder with delivery details

**Error Cases:**
- 404: PO not found
- 400: Invalid received quantity (> ordered)

---

### Performance & Analytics

#### 16. GET `/api/supplier/performance`
**Auth:** MANAGER or ADMIN

**Returns:**
```json
{
  "success": true,
  "data": {
    "portfolioMetrics": {
      "avgReliabilityScore": 87,
      "onTimeDeliveryPercent": 92,
      "qualityPassRatePercent": 93
    },
    "suppliers": [
      {
        "id": "...",
        "name": "Flour Corp",
        "reliabilityScore": 96,
        "onTimePercent": 95,
        "qualityPassRate": 98,
        "trend30Day": "stable",
        "totalOrders": 15,
        "riskLevel": "low"  // low | medium | high
      }
    ],
    "riskAlerts": [
      "Sugar Ltd: Quality dropped 15% (from 95% to 80%)",
      "Chocolate House: On-time delivery < 80%"
    ]
  }
}
```

---

### CSV Import

#### 17. POST `/api/supplier/import/suppliers`
**Auth:** ADMIN only

**Body:** FormData with file (CSV)

**CSV Format:**
```
name,email,phone,address,city,contactPerson,categories
Flour Corp,contact@flourcorp.ma,+212-123,123 Main,Casablanca,Ahmed,"Flour,Sugar"
Sugar Ltd,hello@sugarltd.ma,+212-456,456 Oak,Fes,Fatima,Sugar
```

**Logic:**
- Parse CSV
- Validate each row (required: name)
- Deduplicate (skip if supplier name already exists)
- Create suppliers in transaction
- Return summary: { imported: 2, errors: [] }

**Returns:**
```json
{
  "success": true,
  "data": {
    "imported": 2,
    "failed": 0,
    "errors": []
  }
}
```

#### 18. POST `/api/supplier/import/catalogs`
**Auth:** ADMIN only

**Body:** FormData with file (CSV)

**CSV Format:**
```
supplierId,materialId,unitPrice,minOrderQty,leadTimeDays
SUPPLIER_ID_1,MATERIAL_ID_1,15.50,50,5
SUPPLIER_ID_1,MATERIAL_ID_2,12.00,25,3
```

**Logic:**
- Parse CSV
- Validate foreign keys exist
- Skip duplicates
- Create catalog entries
- Return summary

---

### Batch Integration

#### 19. GET `/api/supplier/batch-alerts`
**Auth:** WORKER or MANAGER

**Returns:**
```json
{
  "success": true,
  "data": {
    "delayedMaterials": [
      {
        "materialId": "...",
        "materialName": "Flour",
        "supplierId": "...",
        "supplierName": "Flour Corp",
        "expectedDeliveryDate": "2026-04-22",
        "isOverdue": false,
        "daysUntilDelivery": 3
      }
    ],
    "belowThresholdMaterials": [
      {
        "materialId": "...",
        "materialName": "Sugar",
        "currentStock": 10,
        "minThreshold": 25,
        "daysUntilDepletion": 2
      }
    ]
  }
}
```

---

## UI Pages

### Page 1: `/admin/suppliers` (Supplier List)

**Components:**
- Search bar + Status filter dropdown (ACTIVE, INACTIVE, BLOCKED)
- Supplier table:
  - Columns: Name, Email, Status, Reliability Score, On-Time %, Quality %, Actions
  - Color-coded status badges
  - Click row → `/admin/suppliers/[id]`
  - Actions dropdown: Edit, View POs, Performance, Delete

- Quick actions:
  - "+ Add Supplier" → modal
  - "Import Suppliers" → CSV upload modal
  - "Import Catalogs" → CSV upload modal

**Data Fetch:** GET `/api/supplier/suppliers?status=X&search=Y`
**Refetch:** 60s polling

---

### Page 2: `/admin/suppliers/[id]` (Supplier Detail)

**Sections:**

1. **Supplier Info Card**
   - Name, Email, Phone, Address, Contact Person, Status
   - Edit, Archive, Block buttons

2. **Performance Scorecard**
   - Reliability Score (large, 0-100)
   - On-Time %: X | Quality %: Y | Trend: ⬆️/➡️/⬇️
   - Total Orders, Delivered On-Time

3. **Category Breakdown**
   - Table: Category | On-Time % | Quality % | Score
   - Helps identify supplier strengths/weaknesses by material type

4. **Material Catalog**
   - Table: Material | Unit Price | Min Order Qty | Lead Time | Status
   - Edit/Remove actions
   - "+ Add Material" button

5. **Recent Purchase Orders**
   - Table: PO #, Material, Qty, Status, Expected, Actual, On-Time?
   - Link to `/admin/purchase-orders`

6. **Quality Inspections**
   - Recent incoming QC results

**Data Fetch:** GET `/api/supplier/suppliers/[id]`

---

### Page 3: `/admin/purchase-orders` (PO Tracking)

**Tabs:**

**Tab A: Pending Approvals**
- Table: Lab, Material, Suggested Qty, Best Supplier, Expires In
- Actions: Approve (with override modal), Reject (with reason)
- Shows why suggestion was created

**Tab B: Active Orders**
- Table: PO #, Supplier, Material, Qty, Expected Delivery, Status
- Highlight red if overdue
- Actions: Mark Received, Details, Cancel

**Tab C: Delivery History**
- Table: PO #, Supplier, Material, Qty, Delivery Date, Received Qty, QC Result, On-Time?
- Searchable, sortable

**Quick Stats Bar:**
- "Pending Approval: X | Active Orders: Y | Overdue: Z"

**Data Fetch:**
- Tab A: GET `/api/supplier/po-suggestions?status=PENDING`
- Tab B: GET `/api/supplier/purchase-orders?status=ORDERED,PENDING`
- Tab C: GET `/api/supplier/purchase-orders?status=DELIVERED`

---

### Page 4: `/admin/supplier-performance` (Analytics Dashboard)

**Sections:**

1. **Portfolio Metrics (Cards)**
   - Avg Reliability Score
   - Portfolio On-Time %
   - Portfolio Quality Pass Rate

2. **Supplier Ranking Table**
   - Rank | Name | Reliability Score | On-Time % | Quality % | Trend | Categories
   - Sorted by score (highest first)
   - Color-coded (green 80+, yellow 60-79, red <60)

3. **Trend Charts**
   - Line: Reliability scores over 30 days (top 5 suppliers)
   - Stacked bar: On-time vs Late by supplier

4. **Risk Alerts**
   - Red banner if supplier score dropped >10 points
   - Alert if quality < 85%
   - Alert if on-time < 80%

**Data Fetch:** GET `/api/supplier/performance`

---

### Page 5: `/admin/inventory-replenishment` (Stock & Suggestions)

**Sections:**

1. **Stock Status by Lab**
   - Lab dropdown selector
   - Table: Material | Current Stock | Min Threshold | Days Until Threshold | Reorder Qty
   - Red alert if below threshold
   - Yellow if <2 weeks away
   - Click material → show forecast + supplier options

2. **Auto-Suggestion Preview**
   - "Next Suggested Orders" (next 7 days)
   - Table: Material | Forecasted Qty | Best Supplier | Lead Time | Suggested Qty | Est. Price
   - Link to create suggestion now

3. **Forecast Integration**
   - For each material: Demand forecast vs stock depletion chart
   - When will stock run out?

**Data Fetch:**
- GET `/api/admin/lab-stock`
- GET `/api/admin/production/forecast`
- GET `/api/supplier/catalogs`

---

## Integration with Worker Dashboard

**1. Worker Batch Detail Page** (`/worker/batches/[id]`)
- Material Requirements section shows availability status per ingredient
- ✅ "In Stock" | ⏳ "Pending Delivery [Date]" | ⚠️ "Delayed — [Supplier] [Expected Date]"

**2. Manager Lab Overview** (`/manager/lab`)
- Active Batches table adds "Material Status" column
- ✅ All materials ready | ⏳ Awaiting [Material] | ⚠️ Delayed
- Supplier Delay Banner at top if any batches affected

**3. Batch Creation Validation**
- When admin creates batch with planned start date
- Check supplier lead times: warn if materials won't arrive in time
- Allow override with warning

**4. Dashboard Stats**
- Manager: Add "Materials at Risk: X" stat card

---

## Error Handling

**API Errors:**
- 400: ValidationError (invalid supplier ID, duplicate catalog, invalid lead time)
- 403: PermissionError (only MANAGER can approve POs)
- 404: NotFoundError (supplier, material, PO not found)
- 409: ConflictError (supplier already has catalog entry)
- 500: ServerError (database transaction failure)

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_SUPPLIER",
    "message": "Supplier not found",
    "details": { "supplierId": "..." }
  }
}
```

**UI Errors:**
- Toast notifications (error, warning, success)
- Disable buttons during API calls
- Show loading spinners
- Retry button on failed requests

---

## Testing Strategy

**Unit Tests (35 tests):**
- SupplierService: CRUD, CSV import, best supplier selection
- PurchaseOrderService: Suggestions, approval, rejection, receiving
- SupplierPerformanceService: Metrics, scoring, trend detection
- ReplenishmentService: Threshold checking, reorder qty calculation

**Integration Tests (30 tests):**
- Supplier endpoints: create, list, get, update
- Catalog endpoints: add, list, update, remove
- PO workflow: suggest, approve, reject, receive
- Performance dashboard: metrics aggregation, risk alerts
- CSV import: valid/invalid data, duplicates
- Error cases: invalid IDs, missing catalogs, permission denied

**UI Tests (25 tests):**
- Supplier list: render, search, filter, navigation
- Supplier detail: info card, metrics, catalogs, recent POs
- PO tracking: pending approvals, active orders, history
- Performance dashboard: ranking, charts, alerts
- Inventory replenishment: stock status, forecasts, suggestions

**Total: 80+ tests** with 80%+ coverage

---

## Success Criteria

✅ Supplier CRUD works, CSV import functional  
✅ Supplier catalog: pricing + lead times persisted  
✅ PO suggestions generated when stock below threshold  
✅ Manager can approve, reject, modify suggestions  
✅ Supplier performance metrics calculated correctly (on-time %, quality %, reliability score)  
✅ Batch detail shows material delays  
✅ Manager lab overview shows supplier impact  
✅ Performance dashboard shows risk alerts  
✅ Received POs update LabStock atomically  
✅ CSV import handles duplicates gracefully  
✅ 80+ tests passing, no regressions in Cycle A  
✅ All error cases handled with clear messages  

---

## Implementation Phases

**Phase 1 (Days 1-2): Database & Validators**
- Add 4 new models + 3 model updates
- Create migration
- Write Zod validators for all payloads

**Phase 2 (Days 3-5): API Routes & Services**
- Implement 5 service classes
- Build 19 API routes
- Write 30 integration tests

**Phase 3 (Days 6-7): Admin UI**
- Build 5 pages + modals
- Connect to APIs
- Write 25 UI tests

**Phase 4 (Day 8): Integration & Polish**
- Batch alert integration
- CSV import testing
- Performance optimization
- Final testing pass

**Timeline: 1-2 weeks** (can be parallelized: DB/Validators parallel to UI mocks)

---

## Notes

- SupplierCatalog separates supplier data from pricing (future: multiple prices per material)
- PurchaseOrderSuggestion expires after 7 days (prevents stale suggestions)
- Reliability score = weighted average (on-time 40% + quality 40% + trend 20%)
- CSV import deduplicates by supplier name and supplier-material pair
- Batch creation checks lead times to prevent infeasible schedules
- All PO updates (receive, approve) happen in transactions for consistency
- Performance metrics update daily via background job (not real-time)
