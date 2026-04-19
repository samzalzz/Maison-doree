# Worker Dashboard Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan for this design.

**Goal:** Enable workers and managers to execute production batches through a dedicated UI with role-based access control.

**Architecture:** Two-role system (WORKER, MANAGER) with simple batch-to-worker assignment model. Workers see assigned batches and report progress; managers assign work and manage lab inventory.

**Tech Stack:** Next.js 14 App Router, React 18, Prisma ORM, PostgreSQL, Tailwind CSS

---

## Context

**Current State:**
- Phase 1-3 complete (971 tests passing)
- ProductionBatch, LabEmployee, LabStock models exist
- Admin can create batches and manage labs
- No worker UI or batch assignment system yet

**User Roles Needed:**
- **WORKER** — Execute batches, report progress, view recipes and lab inventory
- **MANAGER** — Assign batches to workers, manage lab resources and inventory

**Scope:** Lightweight implementation (no shift scheduling, no labor hour tracking). Focus on enabling batch execution workflow.

---

## Database Design

### Role Enum Extension

Add to existing `Role` enum in `prisma/schema.prisma`:
```prisma
enum Role {
  CUSTOMER
  ADMIN
  DRIVER
  WORKER
  MANAGER
}
```

### New Table: BatchAssignment

```prisma
model BatchAssignment {
  id                 String            @id @default(cuid())
  batchId            String
  batch              ProductionBatch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  
  workerId           String
  worker             User              @relation(fields: [workerId], references: [id], onDelete: Cascade)
  
  labId              String            // Denormalized for query optimization
  lab                ProductionLab     @relation(fields: [labId], references: [id], onDelete: Cascade)
  
  status             String            @default("PENDING")  // PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, PAUSED, FAILED
  
  assignedAt         DateTime          @default(now())
  acceptedAt         DateTime?         // When worker accepted assignment
  startedAt          DateTime?         // When worker started work
  reportedCompletedAt DateTime?         // When worker reported completion
  
  notes              String?           // Worker notes on completion
  
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  
  @@index([batchId])
  @@index([workerId])
  @@index([labId])
  @@index([status])
  @@unique([batchId, workerId])  // One assignment per batch-worker pair
}
```

### Relations Update

Add to `ProductionBatch` model:
```prisma
assignments    BatchAssignment[]
```

Add to `User` model:
```prisma
batchAssignments   BatchAssignment[]
```

Add to `ProductionLab` model:
```prisma
batchAssignments   BatchAssignment[]
```

---

## API Routes

### Worker Endpoints

#### 1. GET `/api/worker/dashboard`
**Auth:** WORKER or MANAGER role required

**Returns:**
```json
{
  "success": true,
  "data": {
    "myBatches": [
      {
        "id": "...",
        "batchNumber": "BATCH-2026-04-19-0001",
        "recipe": { "id": "...", "name": "Gâteau au Chocolat" },
        "quantity": 10,
        "status": "COMPLETED",
        "assignment": {
          "id": "...",
          "status": "IN_PROGRESS",
          "assignedAt": "2026-04-19T08:00:00Z"
        }
      }
    ],
    "labBatches": [
      // All batches in worker's lab with assignment info
    ],
    "stats": {
      "myAssignedToday": 3,
      "myCompletedToday": 1,
      "labTotalInProgress": 5,
      "labTotalCompleted": 8
    }
  }
}
```

#### 2. GET `/api/worker/batches/[id]`
**Auth:** WORKER or MANAGER role required (worker can only see own lab's batches)

**Returns:**
```json
{
  "success": true,
  "data": {
    "batch": { /* ProductionBatch with full details */ },
    "recipe": { 
      "name": "...",
      "description": "...",
      "laborMinutes": 120,
      "ingredients": [
        { "rawMaterial": { "name": "Flour" }, "quantity": 2, "unit": "kg" }
      ]
    },
    "assignment": { /* BatchAssignment */ },
    "labStock": [
      { "material": "Flour", "quantity": 150, "unit": "kg", "minThreshold": 50 }
    ]
  }
}
```

#### 3. PATCH `/api/worker/batches/[id]/status`
**Auth:** WORKER or MANAGER role required

**Body:**
```json
{
  "status": "IN_PROGRESS|COMPLETED|PAUSED|FAILED",
  "notes": "Optional notes from worker"
}
```

**Logic:**
- Validates status transition (PENDING → ACCEPTED → IN_PROGRESS → COMPLETED or FAILED)
- Updates `BatchAssignment.status`
- If COMPLETED: updates `ProductionBatch.status` to COMPLETED, decrements lab stock for recipe ingredients
- Records timestamps (acceptedAt, startedAt, reportedCompletedAt)

**Returns:**
```json
{
  "success": true,
  "data": {
    "assignment": { /* updated BatchAssignment */ },
    "batch": { /* updated ProductionBatch */ }
  }
}
```

### Manager Endpoints

#### 4. POST `/api/manager/lab/batches/[batchId]/assign`
**Auth:** MANAGER role required

**Body:**
```json
{
  "workerId": "user-cuid-123"
}
```

**Logic:**
- Validates batch exists and is in PLANNED status
- Validates worker exists and has WORKER or MANAGER role
- Validates worker belongs to same lab
- Creates BatchAssignment (status: PENDING)

**Returns:**
```json
{
  "success": true,
  "data": {
    "assignment": { /* BatchAssignment */ }
  }
}
```

**Error Cases:**
- 404: Batch or worker not found
- 400: Batch already assigned (UNIQUE constraint on batchId, workerId)
- 403: Worker not in same lab

#### 5. PATCH `/api/manager/lab/batches/[batchId]/assign/[assignmentId]`
**Auth:** MANAGER role required

**Body:**
```json
{
  "workerId": "new-worker-id (optional)",
  "status": "PAUSED|FAILED (optional)"
}
```

**Logic:**
- Manager can reassign to different worker
- Manager can override status (e.g., mark as FAILED if batch was ruined)

**Returns:**
```json
{
  "success": true,
  "data": {
    "assignment": { /* updated */ }
  }
}
```

#### 6. GET `/api/manager/lab`
**Auth:** MANAGER role required

**Returns:**
```json
{
  "success": true,
  "data": {
    "lab": { "id": "...", "name": "Lab de Préparation", "type": "PREPARATION" },
    "batches": [
      {
        "batch": { /* ProductionBatch */ },
        "assignment": { /* BatchAssignment if assigned, null if unassigned */ },
        "worker": { /* User */ }
      }
    ],
    "workers": [
      { "id": "...", "email": "worker@test.com", "name": "Mohamed" }
    ],
    "stock": [
      { "material": "Flour", "quantity": 150, "minThreshold": 50, "unit": "kg" }
    ]
  }
}
```

#### 7. PATCH `/api/manager/lab/stock/[materialId]`
**Auth:** MANAGER role required

**Body:**
```json
{
  "quantity": 50,           // Amount to add/subtract
  "reason": "Replenishment received"
}
```

**Logic:**
- Updates `LabStock.quantity` (can be negative to decrease)
- Records reason
- Validates quantity doesn't go below 0

**Returns:**
```json
{
  "success": true,
  "data": {
    "stock": { /* updated LabStock */ }
  }
}
```

---

## UI Pages

### Worker Pages

#### 1. `/worker/dashboard`
**Purpose:** Show worker's assignments for today + lab-wide batch visibility

**Components:**
- Stat cards: "My Assignments Today" (3), "Completed Today" (1), "Lab In Progress" (5), "Lab Completed" (8)
- Filters: Status (All/Pending/Accepted/In Progress/Done), Time Range (Today/This Week)
- My Assignments Table:
  - Columns: Batch #, Recipe, Quantity, Status, Actions (View, Accept, Start, Complete)
  - Color-coded status badges
  - Click row → `/worker/batches/[id]`
- Lab Batches Table:
  - Columns: Batch #, Recipe, Assigned Worker, Status
  - Read-only (worker can see what teammates are doing)
  - Click row → `/worker/batches/[id]` (view-only)

**Data Fetch:**
- GET `/api/worker/dashboard`
- Refetch every 30 seconds (live updates)

#### 2. `/worker/batches/[id]`
**Purpose:** Detailed batch view with recipe and progress tracking

**Sections:**
- **Batch Info Card:**
  - Batch #, Recipe name, Quantity, Target time, Status badge
  - Assigned by: [Manager name] at [time]

- **Recipe Details:**
  - Description, Labor minutes
  - Ingredients table: Material, Quantity, Unit
  - Instructions/steps (if available)

- **Assignment Timeline:**
  - Assigned → [timestamp]
  - Accepted → [timestamp, show "Accept" button if not accepted yet]
  - Started → [timestamp, show "Start" button if not started]
  - Completed → [timestamp, show "Complete" button if in progress]
  - Show progress bar

- **Lab Stock View:**
  - Materials available in your lab (read-only)
  - Material name, Current qty, Unit, Min threshold, Alert if below threshold

- **Report Section:**
  - If NOT ACCEPTED: "Accept Assignment" button
  - If ACCEPTED: "Start Work" button
  - If IN_PROGRESS: "Pause Work" button + "Complete" button
  - Complete section: Status dropdown (COMPLETED/PAUSED/FAILED), Notes textarea, "Submit" button

**Data Fetch:**
- GET `/api/worker/batches/[id]`

**Actions:**
- Click "Accept" → PATCH `/api/worker/batches/[id]/status` { status: ACCEPTED }
- Click "Start" → PATCH { status: IN_PROGRESS }
- Click "Complete" → Modal with notes textarea, then PATCH { status: COMPLETED, notes: "..." }
- Click "Pause" → PATCH { status: PAUSED }

### Manager Pages

#### 3. `/manager/lab` (new)
**Purpose:** Lab overview and batch management

**Sections:**
- **Lab Info Card:**
  - Lab name, type, capacity, employee count

- **Quick Actions:**
  - "Create Batch" button → navigate to Phase 1 batch creation
  - "Manage Inventory" link → scroll to stock section

- **Active Batches Table:**
  - Columns: Batch #, Recipe, Qty, Assigned Worker, Status, Actions (Reassign, Mark Failed, View)
  - Filter: Status dropdown, Worker dropdown
  - "Reassign" action → modal to select new worker
  - "Mark Failed" action → confirm dialog, then PATCH status to FAILED
  - "View" → `/worker/batches/[id]` (manager can see all batches)

- **Unassigned Batches Table:**
  - Columns: Batch #, Recipe, Qty, Created, Actions (Assign)
  - "Assign" button → modal with worker dropdown + workload preview
  - After select: POST `/api/manager/lab/batches/[id]/assign` { workerId }

- **Workers in Lab:**
  - List: Worker name, Active batches count, Completed today count
  - Click worker → show their assignment history

- **Stock Management:**
  - Materials table: Material, Current Qty, Min Threshold, Unit, Actions (Adjust)
  - Color alert if below threshold (red background)
  - "Adjust" button → modal: quantity input (positive/negative), reason textarea
  - After submit: PATCH `/api/manager/lab/stock/[materialId]` { quantity, reason }

**Data Fetch:**
- GET `/api/manager/lab`
- Refetch every 60 seconds

---

## Error Handling

**API Errors:**
- `ValidationError` → 400 with `{ errors: [...] }`
- `NotFoundError` → 404 with `{ message: "Batch not found" }`
- `ForbiddenError` → 403 with `{ message: "You don't have permission" }`
- `ConflictError` → 409 with `{ message: "Batch already assigned" }`
- Generic → 500 with `{ message: "Internal server error" }`

**UI Errors:**
- Show toast notification (error, warning, success)
- Disable buttons during API calls
- Show loading spinners
- Retry button on failed requests

---

## Testing Strategy

**Unit Tests:**
- BatchAssignment CRUD validations
- Role checks (WORKER vs MANAGER)
- Status transition logic (PENDING → ACCEPTED → IN_PROGRESS → COMPLETED)

**Integration Tests:**
- Assign batch to worker → worker sees in dashboard
- Worker accepts → assignment updates
- Worker completes → batch status updates → stock decrements
- Manager reassigns → old worker loses assignment, new worker gains it
- Stock adjustment → lab stock updates

**API Tests:**
- 40+ test cases covering all 7 endpoints
- Happy path + error cases
- Role-based access (WORKER cannot adjust stock, etc.)
- Permission checks (worker can only see own lab)

**UI Tests:**
- Dashboard renders assigned batches
- Clicking batch navigates to detail page
- Buttons trigger correct status updates
- Stock view shows current inventory
- Manager can assign and reassign
- Filters work correctly

**Total Test Coverage:** 60+ test cases

---

## Implementation Phases

**Phase 1: Database & API (Days 1-3)**
- Add WORKER/MANAGER roles
- Create BatchAssignment migration
- Implement 7 API routes with validation

**Phase 2: Worker UI (Days 4-5)**
- Build `/worker/dashboard`
- Build `/worker/batches/[id]`
- Connect to APIs

**Phase 3: Manager UI (Day 6)**
- Build `/manager/lab`
- Connect assignment/stock endpoints

**Phase 4: Testing & Polish (Day 7)**
- Complete test suite
- Bug fixes
- Documentation

---

## Success Criteria

✅ WORKER role can see assigned batches and report progress  
✅ MANAGER role can assign batches to workers  
✅ Batch status updates trigger appropriate side effects (stock decrement on completion)  
✅ Workers see lab-wide batches (transparency)  
✅ Managers can adjust stock manually  
✅ Role-based access control enforced (worker cannot adjust stock)  
✅ 60+ tests passing, no regressions in Phase 1-3  
✅ Dashboard updates reflect API responses  
✅ All error cases handled gracefully (toasts, disable buttons, retry)  

---

## Notes

- BatchAssignment is separate from ProductionBatch to allow future multi-worker assignments
- Worker can view lab batches but cannot modify them (read-only)
- Manager can override assignment or mark batch failed manually
- No shift scheduling in this cycle (future enhancement for Phase 4C)
- Stock decrement happens atomically when batch completion is reported (via transaction)
