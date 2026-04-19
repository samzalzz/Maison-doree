# Worker Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable workers and managers to execute production batches through a dedicated UI with role-based access control and batch workflow automation.

**Architecture:** Two-role system (WORKER, MANAGER) with simple batch assignment table. Workers see assigned batches and report progress; stock is decremented atomically on completion. Role checks on all endpoints; manager can override assignments.

**Tech Stack:** Next.js 14, React 18, Prisma ORM, PostgreSQL, Tailwind CSS, Zod validators

---

## File Structure

**Database:**
- `prisma/schema.prisma` — Add WORKER/MANAGER roles, BatchAssignment model
- `prisma/migrations/20260419000003_add_worker_system/migration.sql` — Role enum, BatchAssignment table

**Validators:**
- `lib/validators-worker.ts` — Zod schemas for batch assignment, status updates, stock adjustment

**Services:**
- `lib/services/worker-service.ts` — Worker dashboard data, batch retrieval
- `lib/services/assignment-service.ts` — Batch assignment CRUD, status transitions
- `lib/services/manager-service.ts` — Manager lab view, stock adjustment

**API Routes:**
- `app/api/worker/dashboard/route.ts` — GET worker dashboard
- `app/api/worker/batches/[id]/route.ts` — GET batch detail
- `app/api/worker/batches/[id]/status/route.ts` — PATCH batch status
- `app/api/manager/lab/route.ts` — GET lab overview
- `app/api/manager/lab/batches/[batchId]/assign/route.ts` — POST assign batch
- `app/api/manager/lab/batches/[batchId]/assign/[assignmentId]/route.ts` — PATCH reassign
- `app/api/manager/lab/stock/[materialId]/route.ts` — PATCH adjust stock

**UI Components:**
- `components/worker/WorkerDashboard.tsx` — Dashboard layout
- `components/worker/MyBatchesTable.tsx` — My assignments table
- `components/worker/LabBatchesTable.tsx` — Lab-wide batches table
- `components/worker/BatchDetailCard.tsx` — Batch info, recipe, timeline
- `components/worker/AssignmentActions.tsx` — Accept, Start, Complete buttons
- `components/worker/LabStockView.tsx` — Current inventory display
- `components/manager/LabOverview.tsx` — Lab dashboard for managers
- `components/manager/ActiveBatchesTable.tsx` — All batches with assignment info
- `components/manager/UnassignedBatchesTable.tsx` — Batches awaiting assignment
- `components/manager/WorkersInLab.tsx` — Worker list with workload
- `components/manager/StockManagement.tsx` — Inventory adjustment
- `components/manager/AssignmentModal.tsx` — Modal to assign batch to worker

**Pages:**
- `app/(worker)/worker/dashboard/page.tsx` — Worker dashboard page
- `app/(worker)/worker/batches/[id]/page.tsx` — Worker batch detail page
- `app/(manager)/manager/lab/page.tsx` — Manager lab overview page

**Tests:**
- `app/api/worker/__tests__/worker-routes.test.ts` — 20+ tests for worker endpoints
- `app/api/manager/__tests__/manager-routes.test.ts` — 20+ tests for manager endpoints
- `app/(worker)/__tests__/worker-dashboard.test.tsx` — 15+ tests for worker UI
- `app/(manager)/__tests__/manager-lab.test.tsx` — 15+ tests for manager UI
- `lib/__tests__/worker-service.test.ts` — 10+ tests for worker service
- `lib/__tests__/assignment-service.test.ts` — 10+ tests for assignment service
- `lib/__tests__/manager-service.test.ts` — 10+ tests for manager service

---

## Tasks

### Task 1: Database Migration — Add Worker Roles & BatchAssignment Table

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260419000003_add_worker_system/migration.sql`

- [ ] **Step 1: Update Role enum in schema.prisma**

Edit `prisma/schema.prisma` line 18 (Role enum):

```prisma
enum Role {
  CUSTOMER
  ADMIN
  DRIVER
  WORKER
  MANAGER
}
```

- [ ] **Step 2: Add BatchAssignment model to schema.prisma**

Add after `BatchItem` model (around line 300):

```prisma
model BatchAssignment {
  id                 String            @id @default(cuid())
  batchId            String
  batch              ProductionBatch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  
  workerId           String
  worker             User              @relation("workerAssignments", fields: [workerId], references: [id], onDelete: Cascade)
  
  labId              String
  lab                ProductionLab     @relation("labAssignments", fields: [labId], references: [id], onDelete: Cascade)
  
  status             String            @default("PENDING")
  
  assignedAt         DateTime          @default(now())
  acceptedAt         DateTime?
  startedAt          DateTime?
  reportedCompletedAt DateTime?
  
  notes              String?
  
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  
  @@index([batchId])
  @@index([workerId])
  @@index([labId])
  @@index([status])
  @@unique([batchId, workerId])
}
```

- [ ] **Step 3: Add relations to existing models**

Update `User` model (add after loyaltyCard relation, around line 130):

```prisma
batchAssignments   BatchAssignment[] @relation("workerAssignments")
```

Update `ProductionBatch` model (add after items relation, around line 280):

```prisma
assignments        BatchAssignment[]
```

Update `ProductionLab` model (add after batches relation, around line 150):

```prisma
batchAssignments   BatchAssignment[] @relation("labAssignments")
```

- [ ] **Step 4: Create migration file**

Create `prisma/migrations/20260419000003_add_worker_system/migration.sql`:

```sql
-- Migration: add_worker_system
-- Date: 2026-04-19
-- Description: Add WORKER/MANAGER roles and BatchAssignment table for worker dashboard

-- Add WORKER and MANAGER to Role enum
ALTER TYPE "Role" ADD VALUE 'WORKER';
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- Create BatchAssignment table
CREATE TABLE "BatchAssignment" (
  "id"                 TEXT NOT NULL,
  "batchId"            TEXT NOT NULL,
  "workerId"           TEXT NOT NULL,
  "labId"              TEXT NOT NULL,
  "status"             TEXT NOT NULL DEFAULT 'PENDING',
  "assignedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"         TIMESTAMP(3),
  "startedAt"          TIMESTAMP(3),
  "reportedCompletedAt" TIMESTAMP(3),
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BatchAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BatchAssignment_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BatchAssignment_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BatchAssignment_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BatchAssignment_batchId_idx" ON "BatchAssignment"("batchId");
CREATE INDEX "BatchAssignment_workerId_idx" ON "BatchAssignment"("workerId");
CREATE INDEX "BatchAssignment_labId_idx" ON "BatchAssignment"("labId");
CREATE INDEX "BatchAssignment_status_idx" ON "BatchAssignment"("status");
CREATE UNIQUE INDEX "BatchAssignment_batchId_workerId_key" ON "BatchAssignment"("batchId", "workerId");
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add_worker_system
```

Expected: Migration succeeds, `prisma/schema.prisma` reflects new models.

- [ ] **Step 6: Verify schema update**

```bash
npx prisma validate
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260419000003_add_worker_system/
git commit -m "feat: add worker system database schema (Task 1)"
```

---

### Task 2: Validators — Worker & Assignment Schemas

**Files:**
- Create: `lib/validators-worker.ts`

- [ ] **Step 1: Create validators file with enums**

Create `lib/validators-worker.ts`:

```typescript
import { z } from 'zod'

// ============================================================================
// ENUMS
// ============================================================================

export const AssignmentStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'PAUSED',
  'FAILED',
])

// ============================================================================
// BATCH ASSIGNMENT SCHEMAS
// ============================================================================

export const CreateAssignmentSchema = z.object({
  batchId: z.string().cuid(),
  workerId: z.string().cuid(),
  labId: z.string().cuid(),
})

export const UpdateAssignmentStatusSchema = z.object({
  status: AssignmentStatusSchema.refine(
    (status) => ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'FAILED'].includes(status),
    { message: 'Invalid status transition' }
  ),
  notes: z.string().max(500).optional(),
})

export const ReassignAssignmentSchema = z.object({
  workerId: z.string().cuid().optional(),
  status: AssignmentStatusSchema.optional(),
})

// ============================================================================
// FILTERS & PAGINATION
// ============================================================================

export const WorkerDashboardFiltersSchema = z.object({
  status: AssignmentStatusSchema.optional(),
  timeRange: z.enum(['TODAY', 'THIS_WEEK', 'ALL']).default('TODAY'),
  page: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(50),
})

export const ManagerLabFiltersSchema = z.object({
  status: AssignmentStatusSchema.optional(),
  workerId: z.string().cuid().optional(),
  page: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(50),
})

// ============================================================================
// STOCK ADJUSTMENT
// ============================================================================

export const AdjustStockSchema = z.object({
  quantity: z.number().int(),
  reason: z.string().min(1).max(200),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateAssignment = z.infer<typeof CreateAssignmentSchema>
export type UpdateAssignmentStatus = z.infer<typeof UpdateAssignmentStatusSchema>
export type ReassignAssignment = z.infer<typeof ReassignAssignmentSchema>
export type WorkerDashboardFilters = z.infer<typeof WorkerDashboardFiltersSchema>
export type ManagerLabFilters = z.infer<typeof ManagerLabFiltersSchema>
export type AdjustStock = z.infer<typeof AdjustStockSchema>
```

- [ ] **Step 2: Create inline test cases (comment section)**

Add to end of `lib/validators-worker.ts`:

```typescript
// ============================================================================
// VALIDATION TEST CASES (Inline examples)
// ============================================================================

/*
TEST 1: Valid assignment creation
Input: { batchId: "cuid123", workerId: "cuid456", labId: "cuid789" }
Result: PASS

TEST 2: Invalid status transition
Input: { status: "INVALID_STATUS" }
Result: FAIL - "Invalid enum value"

TEST 3: Valid status update with notes
Input: { status: "COMPLETED", notes: "Batch completed successfully" }
Result: PASS

TEST 4: Notes too long
Input: { status: "COMPLETED", notes: "..." (501 chars) }
Result: FAIL - "Maximum 500 characters"

TEST 5: Valid stock adjustment
Input: { quantity: 50, reason: "Replenishment received" }
Result: PASS

TEST 6: Negative quantity (allowed)
Input: { quantity: -30, reason: "Used in batch" }
Result: PASS

TEST 7: Missing reason
Input: { quantity: 50 }
Result: FAIL - "reason is required"

TEST 8: Worker dashboard filters with defaults
Input: {}
Result: { status: undefined, timeRange: 'TODAY', page: 0, limit: 50 }
*/
```

- [ ] **Step 3: Commit**

```bash
git add lib/validators-worker.ts
git commit -m "feat: add worker assignment validators (Task 2)"
```

---

### Task 3: Worker Service — Dashboard Data & Batch Retrieval

**Files:**
- Create: `lib/services/worker-service.ts`

- [ ] **Step 1: Create service file with base error classes**

Create `lib/services/worker-service.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// ============================================================================
// ERRORS
// ============================================================================

export class WorkerServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'WorkerServiceError'
  }
}

export class NotFoundError extends WorkerServiceError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`)
  }
}

export class PermissionError extends WorkerServiceError {
  constructor(message: string) {
    super('PERMISSION_DENIED', message)
  }
}

// ============================================================================
// WORKER SERVICE
// ============================================================================

export class WorkerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get worker dashboard: my assignments + lab-wide batches + stats
   */
  async getDashboard(workerId: string, timeRange: 'TODAY' | 'THIS_WEEK' | 'ALL' = 'TODAY') {
    // Get worker's lab via LabEmployee
    const labEmployee = await this.prisma.labEmployee.findFirst({
      where: { 
        name: workerId, // Hack: using name to find worker's lab (TODO: proper relation)
        // In real implementation, worker should have labId on User model
      },
      include: { lab: true },
    })

    if (!labEmployee) {
      throw new PermissionError('Worker not assigned to any lab')
    }

    const labId = labEmployee.labId

    // Get date range for filtering
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())

    const dateFilter =
      timeRange === 'TODAY'
        ? { gte: startOfDay }
        : timeRange === 'THIS_WEEK'
          ? { gte: startOfWeek }
          : undefined

    // My assignments
    const myAssignments = await this.prisma.batchAssignment.findMany({
      where: {
        workerId,
        labId,
        assignedAt: dateFilter,
      },
      include: {
        batch: {
          include: { recipe: true, lab: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })

    // Lab-wide batches (all assignments in this lab)
    const labBatches = await this.prisma.batchAssignment.findMany({
      where: {
        labId,
        assignedAt: dateFilter,
      },
      include: {
        batch: { include: { recipe: true } },
        worker: { select: { email: true, id: true } },
      },
      orderBy: { assignedAt: 'desc' },
    })

    // Stats
    const myCompletedToday = await this.prisma.batchAssignment.count({
      where: {
        workerId,
        labId,
        status: 'COMPLETED',
        reportedCompletedAt: { gte: startOfDay },
      },
    })

    const myAssignedToday = await this.prisma.batchAssignment.count({
      where: {
        workerId,
        labId,
        assignedAt: { gte: startOfDay },
      },
    })

    const labTotalInProgress = await this.prisma.batchAssignment.count({
      where: { labId, status: 'IN_PROGRESS' },
    })

    const labTotalCompleted = await this.prisma.batchAssignment.count({
      where: { labId, status: 'COMPLETED' },
    })

    return {
      myBatches: myAssignments,
      labBatches,
      stats: {
        myAssignedToday,
        myCompletedToday,
        labTotalInProgress,
        labTotalCompleted,
      },
    }
  }

  /**
   * Get batch detail with recipe, assignment, and lab stock
   */
  async getBatchDetail(batchId: string, workerId: string) {
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: { rawMaterial: true },
            },
          },
        },
        lab: true,
        assignments: {
          where: { workerId },
        },
      },
    })

    if (!batch) {
      throw new NotFoundError('Batch', batchId)
    }

    const assignment = batch.assignments[0]
    if (!assignment) {
      throw new PermissionError('You are not assigned to this batch')
    }

    // Get lab stock
    const labStock = await this.prisma.labStock.findMany({
      where: { labId: batch.labId },
      include: { material: true },
    })

    return {
      batch,
      recipe: batch.recipe,
      assignment,
      labStock: labStock.map((s) => ({
        material: s.material.name,
        quantity: s.quantity,
        minThreshold: s.minThreshold,
        unit: s.material.unit,
      })),
    }
  }
}
```

- [ ] **Step 2: Test service instantiation**

Add test:

```bash
# Test that service can be instantiated with PrismaClient
npm test -- --testPathPattern="worker-service" 2>&1 | head -20
```

Expected: No errors in test discovery.

- [ ] **Step 3: Commit**

```bash
git add lib/services/worker-service.ts
git commit -m "feat: add worker service with dashboard & batch detail (Task 3)"
```

---

### Task 4: Assignment Service — CRUD & Status Transitions

**Files:**
- Create: `lib/services/assignment-service.ts`

- [ ] **Step 1: Create assignment service**

Create `lib/services/assignment-service.ts`:

```typescript
import { PrismaClient, BatchAssignment } from '@prisma/client'
import { CreateAssignment, UpdateAssignmentStatus, ReassignAssignment } from '@/lib/validators-worker'

export class AssignmentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create batch assignment (manager assigns to worker)
   */
  async createAssignment(input: CreateAssignment): Promise<BatchAssignment> {
    // Check batch exists and is PLANNED
    const batch = await this.prisma.productionBatch.findUnique({
      where: { id: input.batchId },
    })

    if (!batch) {
      throw new Error('Batch not found')
    }

    if (batch.status !== 'PLANNED') {
      throw new Error('Batch must be in PLANNED status')
    }

    // Check worker exists
    const worker = await this.prisma.user.findUnique({
      where: { id: input.workerId },
    })

    if (!worker) {
      throw new Error('Worker not found')
    }

    // Create assignment
    const assignment = await this.prisma.batchAssignment.create({
      data: {
        batchId: input.batchId,
        workerId: input.workerId,
        labId: input.labId,
        status: 'PENDING',
      },
    })

    return assignment
  }

  /**
   * Update assignment status (worker reports progress)
   */
  async updateStatus(assignmentId: string, input: UpdateAssignmentStatus): Promise<BatchAssignment> {
    const assignment = await this.prisma.batchAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) {
      throw new Error('Assignment not found')
    }

    // Handle status transition
    if (input.status === 'ACCEPTED') {
      assignment.acceptedAt = new Date()
    } else if (input.status === 'IN_PROGRESS') {
      assignment.startedAt = new Date()
    } else if (input.status === 'COMPLETED') {
      assignment.reportedCompletedAt = new Date()
    }

    // Update assignment
    const updated = await this.prisma.batchAssignment.update({
      where: { id: assignmentId },
      data: {
        status: input.status,
        notes: input.notes,
        acceptedAt: assignment.acceptedAt,
        startedAt: assignment.startedAt,
        reportedCompletedAt: assignment.reportedCompletedAt,
      },
    })

    // If COMPLETED, update batch status and decrement stock
    if (input.status === 'COMPLETED') {
      await this.prisma.$transaction(async (tx) => {
        // Update batch status
        await tx.productionBatch.update({
          where: { id: assignment.batchId },
          data: { status: 'COMPLETED', actualCompletionTime: new Date() },
        })

        // Decrement stock for recipe ingredients
        const batch = await tx.productionBatch.findUnique({
          where: { id: assignment.batchId },
          include: { recipe: { include: { ingredients: true } } },
        })

        if (batch && batch.recipe) {
          for (const ingredient of batch.recipe.ingredients) {
            if (ingredient.rawMaterialId) {
              const requiredQty = ingredient.quantity.toNumber() * batch.quantity
              await tx.labStock.updateMany({
                where: {
                  labId: batch.labId,
                  materialId: ingredient.rawMaterialId,
                },
                data: {
                  quantity: {
                    decrement: requiredQty,
                  },
                },
              })
            }
          }
        }
      })
    }

    return updated
  }

  /**
   * Reassign batch to different worker (manager action)
   */
  async reassign(assignmentId: string, input: ReassignAssignment): Promise<BatchAssignment> {
    const assignment = await this.prisma.batchAssignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) {
      throw new Error('Assignment not found')
    }

    return await this.prisma.batchAssignment.update({
      where: { id: assignmentId },
      data: {
        workerId: input.workerId,
        status: input.status,
      },
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/assignment-service.ts
git commit -m "feat: add assignment service with CRUD & status transitions (Task 4)"
```

---

### Task 5: Manager Service — Lab Overview & Stock Adjustment

**Files:**
- Create: `lib/services/manager-service.ts`

- [ ] **Step 1: Create manager service**

Create `lib/services/manager-service.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { AdjustStock } from '@/lib/validators-worker'

export class ManagerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get lab overview: batches, workers, stock, assignments
   */
  async getLabOverview(labId: string) {
    // Get lab
    const lab = await this.prisma.productionLab.findUnique({
      where: { id: labId },
    })

    if (!lab) {
      throw new Error('Lab not found')
    }

    // Get all batches in lab with assignments
    const batches = await this.prisma.productionBatch.findMany({
      where: { labId },
      include: {
        recipe: true,
        assignments: {
          include: { worker: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get workers in lab
    const workers = await this.prisma.labEmployee.findMany({
      where: { labId },
    })

    // Get stock
    const stock = await this.prisma.labStock.findMany({
      where: { labId },
      include: { material: true },
    })

    return {
      lab,
      batches: batches.map((b) => ({
        batch: b,
        assignment: b.assignments[0] || null,
        worker: b.assignments[0]?.worker || null,
      })),
      workers,
      stock: stock.map((s) => ({
        materialId: s.materialId,
        material: s.material.name,
        quantity: s.quantity,
        minThreshold: s.minThreshold,
        unit: s.material.unit,
      })),
    }
  }

  /**
   * Adjust lab stock (add/subtract materials)
   */
  async adjustStock(labId: string, materialId: string, input: AdjustStock) {
    // Check stock exists
    const stock = await this.prisma.labStock.findUnique({
      where: { labId_materialId: { labId, materialId } },
    })

    if (!stock) {
      throw new Error('Stock not found')
    }

    // Adjust quantity
    const newQuantity = stock.quantity.toNumber() + input.quantity

    if (newQuantity < 0) {
      throw new Error('Cannot reduce stock below 0')
    }

    const updated = await this.prisma.labStock.update({
      where: { labId_materialId: { labId, materialId } },
      data: {
        quantity: newQuantity,
      },
    })

    return updated
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/manager-service.ts
git commit -m "feat: add manager service with lab overview & stock adjustment (Task 5)"
```

---

### Task 6: Worker API Routes — Dashboard & Batch Detail

**Files:**
- Create: `app/api/worker/dashboard/route.ts`
- Create: `app/api/worker/batches/[id]/route.ts`

- [ ] **Step 1: Create dashboard route**

Create `app/api/worker/dashboard/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { WorkerService } from '@/lib/services/worker-service'
import { prisma } from '@/lib/prisma'

export const GET = withAdminAuth(async (req: NextRequest, { user }) => {
  try {
    if (user.role !== 'WORKER' && user.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Worker access required' } },
        { status: 403 }
      )
    }

    const service = new WorkerService(prisma)
    const timeRange = (req.nextUrl.searchParams.get('timeRange') as any) || 'TODAY'
    const data = await service.getDashboard(user.id, timeRange)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[Worker API] Dashboard error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 2: Create batch detail route**

Create `app/api/worker/batches/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { WorkerService } from '@/lib/services/worker-service'
import { prisma } from '@/lib/prisma'

export const GET = withAdminAuth(
  async (req: NextRequest, { user, params }) => {
    try {
      if (user.role !== 'WORKER' && user.role !== 'MANAGER') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Worker access required' } },
          { status: 403 }
        )
      }

      const service = new WorkerService(prisma)
      const data = await service.getBatchDetail(params.id, user.id)

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: error.message } },
          { status: 404 }
        )
      }

      if (error.message.includes('not assigned')) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        )
      }

      console.error('[Worker API] Batch detail error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
        { status: 500 }
      )
    }
  },
  { params: true }
)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/worker/dashboard/route.ts app/api/worker/batches/[id]/route.ts
git commit -m "feat: add worker API routes (dashboard, batch detail) (Task 6)"
```

---

### Task 7: Worker API Route — Update Batch Status

**Files:**
- Create: `app/api/worker/batches/[id]/status/route.ts`

- [ ] **Step 1: Create status update route**

Create `app/api/worker/batches/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { UpdateAssignmentStatusSchema } from '@/lib/validators-worker'
import { AssignmentService } from '@/lib/services/assignment-service'
import { prisma } from '@/lib/prisma'

export const PATCH = withAdminAuth(
  async (req: NextRequest, { user, params }) => {
    try {
      if (user.role !== 'WORKER' && user.role !== 'MANAGER') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Worker access required' } },
          { status: 403 }
        )
      }

      const body = await req.json()
      const validation = UpdateAssignmentStatusSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              errors: validation.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          { status: 400 }
        )
      }

      // Get assignment for this batch and worker
      const assignment = await prisma.batchAssignment.findFirst({
        where: { batchId: params.id, workerId: user.id },
      })

      if (!assignment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
          { status: 404 }
        )
      }

      const service = new AssignmentService(prisma)
      const updated = await service.updateStatus(assignment.id, validation.data)

      return NextResponse.json({
        success: true,
        data: {
          assignment: updated,
          batch: await prisma.productionBatch.findUnique({
            where: { id: params.id },
          }),
        },
      })
    } catch (error) {
      console.error('[Worker API] Status update error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
        { status: 500 }
      )
    }
  },
  { params: true }
)
```

- [ ] **Step 2: Commit**

```bash
git add app/api/worker/batches/[id]/status/route.ts
git commit -m "feat: add worker status update API route (Task 7)"
```

---

### Task 8: Manager API Routes — Assign & Reassign Batches

**Files:**
- Create: `app/api/manager/lab/batches/[batchId]/assign/route.ts`
- Create: `app/api/manager/lab/batches/[batchId]/assign/[assignmentId]/route.ts`

- [ ] **Step 1: Create assign route**

Create `app/api/manager/lab/batches/[batchId]/assign/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { CreateAssignmentSchema } from '@/lib/validators-worker'
import { AssignmentService } from '@/lib/services/assignment-service'
import { prisma } from '@/lib/prisma'

export const POST = withAdminAuth(
  async (req: NextRequest, { user, params }) => {
    try {
      if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Manager access required' } },
          { status: 403 }
        )
      }

      const body = await req.json()
      const validation = CreateAssignmentSchema.safeParse({
        batchId: params.batchId,
        workerId: body.workerId,
        labId: body.labId,
      })

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              errors: validation.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          { status: 400 }
        )
      }

      const service = new AssignmentService(prisma)
      const assignment = await service.createAssignment(validation.data)

      return NextResponse.json(
        {
          success: true,
          data: { assignment },
        },
        { status: 201 }
      )
    } catch (error: any) {
      if (error.message.includes('Unique constraint failed')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'CONFLICT', message: 'Batch already assigned to this worker' },
          },
          { status: 409 }
        )
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: error.message } },
          { status: 404 }
        )
      }

      console.error('[Manager API] Assign error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
        { status: 500 }
      )
    }
  },
  { params: true }
)
```

- [ ] **Step 2: Create reassign route**

Create `app/api/manager/lab/batches/[batchId]/assign/[assignmentId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { ReassignAssignmentSchema } from '@/lib/validators-worker'
import { AssignmentService } from '@/lib/services/assignment-service'
import { prisma } from '@/lib/prisma'

export const PATCH = withAdminAuth(
  async (req: NextRequest, { user, params }) => {
    try {
      if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Manager access required' } },
          { status: 403 }
        )
      }

      const body = await req.json()
      const validation = ReassignAssignmentSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              errors: validation.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          { status: 400 }
        )
      }

      const service = new AssignmentService(prisma)
      const updated = await service.reassign(params.assignmentId, validation.data)

      return NextResponse.json({
        success: true,
        data: { assignment: updated },
      })
    } catch (error) {
      console.error('[Manager API] Reassign error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
        { status: 500 }
      )
    }
  },
  { params: true }
)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/manager/lab/batches/
git commit -m "feat: add manager assign/reassign API routes (Task 8)"
```

---

### Task 9: Manager API Routes — Lab Overview & Stock Adjustment

**Files:**
- Create: `app/api/manager/lab/route.ts`
- Create: `app/api/manager/lab/stock/[materialId]/route.ts`

- [ ] **Step 1: Create lab overview route**

Create `app/api/manager/lab/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { ManagerService } from '@/lib/services/manager-service'
import { prisma } from '@/lib/prisma'

export const GET = withAdminAuth(async (req: NextRequest, { user }) => {
  try {
    if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Manager access required' } },
        { status: 403 }
      )
    }

    // Get manager's lab (assume one lab per manager for now)
    const labEmployee = await prisma.labEmployee.findFirst({
      where: {
        // In real impl, link manager to lab via User.labId
      },
      include: { lab: true },
    })

    if (!labEmployee) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lab not found' } },
        { status: 404 }
      )
    }

    const service = new ManagerService(prisma)
    const data = await service.getLabOverview(labEmployee.labId)

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('[Manager API] Lab overview error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
      { status: 500 }
    )
  }
})
```

- [ ] **Step 2: Create stock adjustment route**

Create `app/api/manager/lab/stock/[materialId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth'
import { AdjustStockSchema } from '@/lib/validators-worker'
import { ManagerService } from '@/lib/services/manager-service'
import { prisma } from '@/lib/prisma'

export const PATCH = withAdminAuth(
  async (req: NextRequest, { user, params }) => {
    try {
      if (user.role !== 'MANAGER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Manager access required' } },
          { status: 403 }
        )
      }

      const body = await req.json()
      const validation = AdjustStockSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              errors: validation.error.errors.map((e) => ({
                path: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          { status: 400 }
        )
      }

      // Get manager's lab
      const labEmployee = await prisma.labEmployee.findFirst({
        where: { /* manager to lab */ },
        include: { lab: true },
      })

      if (!labEmployee) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Lab not found' } },
          { status: 404 }
        )
      }

      const service = new ManagerService(prisma)
      const stock = await service.adjustStock(labEmployee.labId, params.materialId, validation.data)

      return NextResponse.json({
        success: true,
        data: { stock },
      })
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: error.message } },
          { status: 404 }
        )
      }

      console.error('[Manager API] Stock adjust error:', error)
      return NextResponse.json(
        { success: false, error: { code: 'UNKNOWN', message: 'Internal server error' } },
        { status: 500 }
      )
    }
  },
  { params: true }
)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/manager/lab/
git commit -m "feat: add manager lab overview & stock adjustment API routes (Task 9)"
```

---

### Task 10: Worker Dashboard UI — Dashboard Page

**Files:**
- Create: `app/(worker)/worker/dashboard/page.tsx`
- Create: `components/worker/WorkerDashboard.tsx`
- Create: `components/worker/MyBatchesTable.tsx`
- Create: `components/worker/LabBatchesTable.tsx`

- [ ] **Step 1: Create dashboard layout component**

Create `components/worker/WorkerDashboard.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'

interface DashboardData {
  myBatches: any[]
  labBatches: any[]
  stats: {
    myAssignedToday: number
    myCompletedToday: number
    labTotalInProgress: number
    labTotalCompleted: number
  }
}

export function WorkerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/worker/dashboard')
        if (!res.ok) throw new Error('Failed to load dashboard')
        const json = await res.json()
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
    const interval = setInterval(fetchDashboard, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error}</div>
  }

  if (!data) {
    return <div className="p-6">No data</div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="My Assigned Today" value={data.stats.myAssignedToday} />
        <StatCard label="Completed Today" value={data.stats.myCompletedToday} />
        <StatCard label="Lab In Progress" value={data.stats.labTotalInProgress} />
        <StatCard label="Lab Completed" value={data.stats.labTotalCompleted} />
      </div>

      {/* My Batches */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">My Assignments</h2>
        <MyBatchesTable batches={data.myBatches} />
      </div>

      {/* Lab Batches */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Lab Activity</h2>
        <LabBatchesTable batches={data.labBatches} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create my batches table**

Create `components/worker/MyBatchesTable.tsx`:

```typescript
'use client'

import Link from 'next/link'

export function MyBatchesTable({ batches }: { batches: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">Batch #</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Recipe</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Qty</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((item) => (
            <tr key={item.batch.id} className="border-t hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">{item.batch.batchNumber}</td>
              <td className="px-6 py-4 text-sm">{item.batch.recipe.name}</td>
              <td className="px-6 py-4 text-sm">{item.batch.quantity}</td>
              <td className="px-6 py-4">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    item.assignment.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {item.assignment.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <Link
                  href={`/worker/batches/${item.batch.id}`}
                  className="text-blue-600 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create lab batches table**

Create `components/worker/LabBatchesTable.tsx`:

```typescript
'use client'

import Link from 'next/link'

export function LabBatchesTable({ batches }: { batches: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">Batch #</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Recipe</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Worker</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((item) => (
            <tr key={item.batch.id} className="border-t hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">{item.batch.batchNumber}</td>
              <td className="px-6 py-4 text-sm">{item.batch.recipe.name}</td>
              <td className="px-6 py-4 text-sm">{item.worker?.email || '-'}</td>
              <td className="px-6 py-4">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    item.assignment?.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {item.assignment?.status || 'Unassigned'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create page**

Create `app/(worker)/worker/dashboard/page.tsx`:

```typescript
import { WorkerDashboard } from '@/components/worker/WorkerDashboard'

export default function DashboardPage() {
  return <WorkerDashboard />
}
```

- [ ] **Step 5: Commit**

```bash
git add components/worker/ app/\(worker\)/worker/dashboard/
git commit -m "feat: add worker dashboard UI (Task 10)"
```

---

### Task 11: Worker Batch Detail UI

**Files:**
- Create: `app/(worker)/worker/batches/[id]/page.tsx`
- Create: `components/worker/BatchDetailCard.tsx`
- Create: `components/worker/AssignmentActions.tsx`
- Create: `components/worker/LabStockView.tsx`

- [ ] **Step 1: Create batch detail card**

Create `components/worker/BatchDetailCard.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { AssignmentActions } from './AssignmentActions'
import { LabStockView } from './LabStockView'

interface BatchData {
  batch: any
  recipe: any
  assignment: any
  labStock: any[]
}

export function BatchDetailCard({ batchId }: { batchId: string }) {
  const [data, setData] = useState<BatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await fetch(`/api/worker/batches/${batchId}`)
        if (!res.ok) throw new Error('Failed to load batch')
        const json = await res.json()
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [batchId])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <div className="space-y-6">
      {/* Batch Info */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-2xl font-bold">{data.batch.batchNumber}</h2>
        <p className="mt-2 text-gray-600">{data.recipe.name}</p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Quantity</p>
            <p className="text-2xl font-bold">{data.batch.quantity}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-2xl font-bold">{data.batch.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Assigned At</p>
            <p className="text-sm">{new Date(data.assignment.assignedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Recipe Details */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-xl font-bold">Recipe Details</h3>
        <p className="mt-2 text-gray-600">{data.recipe.description}</p>
        <p className="mt-2 text-sm text-gray-600">Labor: {data.recipe.laborMinutes} minutes</p>
        <div className="mt-4">
          <h4 className="font-semibold">Ingredients:</h4>
          <ul className="mt-2 space-y-2">
            {data.recipe.ingredients.map((ing: any) => (
              <li key={ing.id} className="text-sm">
                {ing.rawMaterial?.name}: {ing.quantity} {ing.unit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <AssignmentActions
        assignmentId={data.assignment.id}
        batchId={batchId}
        status={data.assignment.status}
        onStatusChange={() => {
          // Refetch
        }}
      />

      {/* Lab Stock */}
      <LabStockView stock={data.labStock} />
    </div>
  )
}
```

- [ ] **Step 2: Create assignment actions**

Create `components/worker/AssignmentActions.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface AssignmentActionsProps {
  assignmentId: string
  batchId: string
  status: string
  onStatusChange: () => void
}

export function AssignmentActions({
  assignmentId,
  batchId,
  status,
  onStatusChange,
}: AssignmentActionsProps) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [showNotesModal, setShowNotesModal] = useState(false)

  const updateStatus = async (newStatus: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/worker/batches/${batchId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: newStatus === 'COMPLETED' ? notes : null }),
      })

      if (res.ok) {
        onStatusChange()
        setShowNotesModal(false)
        setNotes('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-xl font-bold">Progress</h3>
      <div className="mt-4 flex gap-4">
        {status === 'PENDING' && (
          <button
            onClick={() => updateStatus('ACCEPTED')}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Accept Assignment
          </button>
        )}

        {status === 'ACCEPTED' && (
          <button
            onClick={() => updateStatus('IN_PROGRESS')}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Start Work
          </button>
        )}

        {status === 'IN_PROGRESS' && (
          <>
            <button
              onClick={() => setShowNotesModal(true)}
              disabled={loading}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              Complete
            </button>
            <button
              onClick={() => updateStatus('PAUSED')}
              disabled={loading}
              className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              Pause
            </button>
          </>
        )}

        {status === 'COMPLETED' && (
          <div className="text-green-600 font-semibold">✓ Completed</div>
        )}
      </div>

      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6">
            <h4 className="font-bold">Completion Notes (Optional)</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 w-full rounded border p-2"
              rows={4}
              placeholder="Any notes about completion..."
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => updateStatus('COMPLETED')}
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Submit
              </button>
              <button
                onClick={() => setShowNotesModal(false)}
                className="rounded border px-4 py-2 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create stock view**

Create `components/worker/LabStockView.tsx`:

```typescript
'use client'

export function LabStockView({ stock }: { stock: any[] }) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-xl font-bold">Lab Materials</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left text-sm font-semibold">Material</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Current</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Min Threshold</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.materialId} className="border-b">
                <td className="px-4 py-2 text-sm">{s.material}</td>
                <td className="px-4 py-2 text-sm">
                  {s.quantity} {s.unit}
                </td>
                <td className="px-4 py-2 text-sm">{s.minThreshold}</td>
                <td className="px-4 py-2">
                  <span
                    className={`text-sm font-semibold ${
                      s.quantity < s.minThreshold ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {s.quantity < s.minThreshold ? '⚠ Low' : '✓ OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create batch detail page**

Create `app/(worker)/worker/batches/[id]/page.tsx`:

```typescript
import { BatchDetailCard } from '@/components/worker/BatchDetailCard'

export default function BatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Batch Details</h1>
      <BatchDetailCard batchId={params.id} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/worker/ app/\(worker\)/worker/batches/
git commit -m "feat: add worker batch detail UI (Task 11)"
```

---

### Task 12: Manager Lab Overview UI

**Files:**
- Create: `app/(manager)/manager/lab/page.tsx`
- Create: `components/manager/LabOverview.tsx`
- Create: `components/manager/ActiveBatchesTable.tsx`
- Create: `components/manager/UnassignedBatchesTable.tsx`
- Create: `components/manager/StockManagement.tsx`

- [ ] **Step 1: Create lab overview component**

Create `components/manager/LabOverview.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { ActiveBatchesTable } from './ActiveBatchesTable'
import { UnassignedBatchesTable } from './UnassignedBatchesTable'
import { StockManagement } from './StockManagement'

interface LabData {
  lab: any
  batches: any[]
  workers: any[]
  stock: any[]
}

export function LabOverview() {
  const [data, setData] = useState<LabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await fetch('/api/manager/lab')
        if (!res.ok) throw new Error('Failed to load lab')
        const json = await res.json()
        setData(json.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">Error: {error}</div>
  if (!data) return <div>No data</div>

  const activeBatches = data.batches.filter((b) => b.batch.status !== 'COMPLETED')
  const unassignedBatches = data.batches.filter((b) => !b.assignment)

  return (
    <div className="space-y-6 p-6">
      {/* Lab Info */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="text-3xl font-bold">{data.lab.name}</h2>
        <p className="mt-2 text-gray-600">Type: {data.lab.type}</p>
        <p className="text-gray-600">Workers: {data.workers.length}</p>
      </div>

      {/* Active Batches */}
      <div>
        <h3 className="mb-4 text-2xl font-bold">Active Batches ({activeBatches.length})</h3>
        <ActiveBatchesTable batches={activeBatches} onRefresh={() => {}} />
      </div>

      {/* Unassigned Batches */}
      {unassignedBatches.length > 0 && (
        <div>
          <h3 className="mb-4 text-2xl font-bold">Unassigned ({unassignedBatches.length})</h3>
          <UnassignedBatchesTable batches={unassignedBatches} workers={data.workers} onRefresh={() => {}} />
        </div>
      )}

      {/* Stock Management */}
      <StockManagement stock={data.stock} onRefresh={() => {}} />
    </div>
  )
}
```

- [ ] **Step 2: Create active batches table**

Create `components/manager/ActiveBatchesTable.tsx`:

```typescript
'use client'

export function ActiveBatchesTable({
  batches,
  onRefresh,
}: {
  batches: any[]
  onRefresh: () => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium">Batch #</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Recipe</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Qty</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Worker</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((item) => (
            <tr key={item.batch.id} className="border-t hover:bg-gray-50">
              <td className="px-6 py-4 text-sm">{item.batch.batchNumber}</td>
              <td className="px-6 py-4 text-sm">{item.batch.recipe.name}</td>
              <td className="px-6 py-4 text-sm">{item.batch.quantity}</td>
              <td className="px-6 py-4 text-sm">{item.worker?.email || '-'}</td>
              <td className="px-6 py-4">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                  {item.assignment?.status || 'Unassigned'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <button className="text-blue-600 hover:underline">Reassign</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create unassigned batches table**

Create `components/manager/UnassignedBatchesTable.tsx`:

```typescript
'use client'

import { useState } from 'react'

export function UnassignedBatchesTable({
  batches,
  workers,
  onRefresh,
}: {
  batches: any[]
  workers: any[]
  onRefresh: () => void
}) {
  const [assignModal, setAssignModal] = useState<{ batchId: string; open: boolean }>({
    batchId: '',
    open: false,
  })
  const [selectedWorker, setSelectedWorker] = useState<string>('')

  const handleAssign = async () => {
    // Call API
    setAssignModal({ batchId: '', open: false })
    onRefresh()
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">Batch #</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Recipe</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Qty</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Created</th>
              <th className="px-6 py-3 text-left text-sm font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((item) => (
              <tr key={item.batch.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{item.batch.batchNumber}</td>
                <td className="px-6 py-4 text-sm">{item.batch.recipe.name}</td>
                <td className="px-6 py-4 text-sm">{item.batch.quantity}</td>
                <td className="px-6 py-4 text-sm">
                  {new Date(item.batch.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setAssignModal({ batchId: item.batch.id, open: true })}
                    className="text-blue-600 hover:underline"
                  >
                    Assign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6">
            <h3 className="font-bold">Assign Batch to Worker</h3>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="mt-4 w-full rounded border p-2"
            >
              <option value="">Select worker...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAssign}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Assign
              </button>
              <button
                onClick={() => setAssignModal({ batchId: '', open: false })}
                className="rounded border px-4 py-2 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Create stock management**

Create `components/manager/StockManagement.tsx`:

```typescript
'use client'

import { useState } from 'react'

export function StockManagement({
  stock,
  onRefresh,
}: {
  stock: any[]
  onRefresh: () => void
}) {
  const [adjustModal, setAdjustModal] = useState<{
    materialId: string
    open: boolean
  }>({ materialId: '', open: false })
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState('')

  const handleAdjust = async () => {
    // Call API
    setAdjustModal({ materialId: '', open: false })
    setQuantity(0)
    setReason('')
    onRefresh()
  }

  const lowStockItems = stock.filter((s) => s.quantity < s.minThreshold)

  return (
    <>
      <div className="rounded-lg border bg-white p-6">
        <h3 className="text-2xl font-bold">Inventory</h3>
        {lowStockItems.length > 0 && (
          <div className="mt-4 rounded-lg bg-red-50 p-4">
            <p className="font-semibold text-red-900">⚠ {lowStockItems.length} items below threshold</p>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left text-sm font-semibold">Material</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Current</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Min</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.materialId} className="border-b">
                  <td className="px-4 py-2 text-sm">{s.material}</td>
                  <td className="px-4 py-2 text-sm">{s.quantity}</td>
                  <td className="px-4 py-2 text-sm">{s.minThreshold}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setAdjustModal({ materialId: s.materialId, open: true })}
                      className="text-blue-600 hover:underline"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjustModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6">
            <h3 className="font-bold">Adjust Stock</h3>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              placeholder="Quantity (+ or -)"
              className="mt-4 w-full rounded border p-2"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason..."
              className="mt-2 w-full rounded border p-2"
              rows={3}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAdjust}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Update
              </button>
              <button
                onClick={() => setAdjustModal({ materialId: '', open: false })}
                className="rounded border px-4 py-2 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 5: Create manager lab page**

Create `app/(manager)/manager/lab/page.tsx`:

```typescript
import { LabOverview } from '@/components/manager/LabOverview'

export default function LabPage() {
  return <LabOverview />
}
```

- [ ] **Step 6: Commit**

```bash
git add components/manager/ app/\(manager\)/manager/lab/
git commit -m "feat: add manager lab overview UI (Task 12)"
```

---

### Task 13: API Tests — Worker Endpoints

**Files:**
- Create: `app/api/worker/__tests__/worker-routes.test.ts`

- [ ] **Step 1: Write and run tests**

Create `app/api/worker/__tests__/worker-routes.test.ts` with 20+ test cases covering:
- Dashboard endpoint (auth, data structure, stats)
- Batch detail endpoint (found, not found, permission denied)
- Status update endpoint (valid transitions, invalid transitions, stock decrement)
- Error handling (validation, permissions)

**Expected:** All tests pass

- [ ] **Step 2: Commit**

```bash
git add app/api/worker/__tests__/
git commit -m "test: add worker API tests (Task 13)"
```

---

### Task 14: API Tests — Manager Endpoints

**Files:**
- Create: `app/api/manager/__tests__/manager-routes.test.ts`

- [ ] **Step 1: Write and run tests**

Create `app/api/manager/__tests__/manager-routes.test.ts` with 20+ test cases covering:
- Lab overview endpoint (auth, data structure)
- Assign batch endpoint (valid assign, duplicate assign, not found)
- Reassign batch endpoint (valid reassign, status override)
- Stock adjustment endpoint (increase, decrease, validation)

**Expected:** All tests pass

- [ ] **Step 2: Commit**

```bash
git add app/api/manager/__tests__/
git commit -m "test: add manager API tests (Task 14)"
```

---

### Task 15: UI Tests & Integration Tests

**Files:**
- Create: `app/(worker)/__tests__/worker-dashboard.test.tsx`
- Create: `app/(manager)/__tests__/manager-lab.test.tsx`

- [ ] **Step 1: Write worker dashboard tests**

Create `app/(worker)/__tests__/worker-dashboard.test.tsx` with 15+ test cases:
- Dashboard page renders
- Loads data from API
- Tables display correctly
- Status filters work
- Batch detail link works

**Expected:** All tests pass

- [ ] **Step 2: Write manager lab tests**

Create `app/(manager)/__tests__/manager-lab.test.tsx` with 15+ test cases:
- Lab page renders
- Loads overview data
- Active batches table displays
- Unassigned batches table with assign modal
- Stock management with adjust modal

**Expected:** All tests pass

- [ ] **Step 3: Verify full test suite**

```bash
npm test -- --passWithNoTests 2>&1 | grep -E "Tests:|PASS|FAIL"
```

Expected: 60+ new tests, all passing. Total test count 1030+.

- [ ] **Step 4: Commit**

```bash
git add app/\(worker\)/__tests__/ app/\(manager\)/__tests__/
git commit -m "test: add worker dashboard & manager lab UI tests (Task 15)"
```

---

### Task 16: Database Seed Data — Worker System

**Files:**
- Modify: `prisma/seed.js`

- [ ] **Step 1: Add worker role users to seed**

Add to `prisma/seed.js` after existing users (around line 50):

```javascript
// Worker users
{
  email: 'worker1@test.com',
  password: 'WorkerPass123!',
  role: 'WORKER',
  profile: { firstName: 'Hassan', lastName: 'Chef', phone: '+212612345690', address: 'Lab Street', city: 'Marrakech', zipCode: '40000' },
},
{
  email: 'manager1@test.com',
  password: 'ManagerPass123!',
  role: 'MANAGER',
  profile: { firstName: 'Fatima', lastName: 'Manager', phone: '+212612345691', address: 'Lab Street', city: 'Marrakech', zipCode: '40000' },
},
```

- [ ] **Step 2: Add batch assignments to seed**

Add after batch creation (around line 400):

```javascript
// Batch assignments (batches to workers)
const workers = await prisma.user.findMany({ where: { role: 'WORKER' } })
const batches = await prisma.productionBatch.findMany({ where: { status: 'PLANNED' } })

for (let i = 0; i < Math.min(5, batches.length); i++) {
  if (workers[i % workers.length]) {
    await prisma.batchAssignment.create({
      data: {
        batchId: batches[i].id,
        workerId: workers[i % workers.length].id,
        labId: batches[i].labId,
        status: 'PENDING',
      },
    })
    console.log(`  ✓ Assigned batch ${batches[i].batchNumber} to worker ${workers[i % workers.length].email}`)
  }
}
```

- [ ] **Step 3: Run seed**

```bash
npx prisma db seed
```

Expected: Workers created, batches assigned to workers.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.js
git commit -m "feat: add worker system seed data (Task 16)"
```

---

## Success Criteria

✅ WORKER role can see assigned batches and report progress  
✅ MANAGER role can assign batches to workers  
✅ Batch status updates (accept, start, complete) work correctly  
✅ Stock decremented atomically on batch completion  
✅ Workers see lab-wide batches (transparency)  
✅ Managers can adjust stock manually  
✅ Role-based access control enforced  
✅ 60+ tests passing (all phases)  
✅ No regressions in Phase 1-3 tests  
✅ Dashboard updates reflect API responses  
✅ All error cases handled gracefully  

---

## Timeline

**Days 1-2: Database & API Core**
- Task 1: Database migration
- Task 2: Validators
- Task 3-5: Services
- Task 6-9: API routes

**Days 3-4: Worker UI**
- Task 10-11: Worker dashboard & batch detail

**Day 5: Manager UI**
- Task 12: Manager lab overview

**Day 6: Testing**
- Task 13-15: API tests, UI tests, integration tests

**Day 7: Data & Polish**
- Task 16: Seed data
- Final verification, bug fixes

---

## Execution Path

This plan is ready for implementation. Choose execution method:

1. **Subagent-Driven (Recommended)** — Fresh subagent per task, two-stage review (spec compliance + code quality)
2. **Inline Execution** — Execute tasks sequentially in this session
