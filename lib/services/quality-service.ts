/**
 * lib/services/quality-service.ts
 *
 * Quality Management (QM) business logic layer.
 *
 * Responsibilities:
 *  - Validate all inputs with schemas from lib/validators-qm.ts before
 *    touching the database.
 *  - Enforce QM state-machine rules (inspection status transitions).
 *  - Enforce context rules (batchId / supplierId per inspection type).
 *  - Verify that referenced resources (RawMaterial, ProductionBatch, Supplier)
 *    actually exist before creating an inspection.
 *  - Auto-set completedDate (stored as actualDate in the DB) when a terminal
 *    status (PASSED | FAILED | CONDITIONAL) is written.
 *
 * Error types thrown:
 *  - ValidationError  – malformed input or a rejected state transition
 *  - NotFoundError    – the requested record does not exist
 *
 * All DB field notes
 *  The Prisma schema uses:
 *    QualityInspection.rawMaterialId     (nullable FK → RawMaterial)
 *    QualityInspection.productionBatchId (nullable FK → ProductionBatch)
 *    QualityInspection.supplierId        (nullable FK → Supplier)
 *    QualityInspection.status            (InspectionStatus)
 *    QualityInspection.inspectedBy       (userId string)
 *    QualityInspection.actualDate        (used as completedDate)
 *    InspectionCheckpoint.checkName      (mapped from checkpointName in input)
 */

import { InspectionStatus, type QualityInspection, type InspectionCheckpoint } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  CreateQualityInspectionSchema,
  UpdateQualityInspectionSchema,
  QualityInspectionFiltersSchema,
  CreateInspectionCheckpointSchema,
  UpdateInspectionCheckpointSchema,
  validateInspectionContext,
  validateInspectionTransition,
  type CreateQualityInspectionInput,
  type UpdateQualityInspectionInput,
  type QualityInspectionFiltersInput,
  type CreateInspectionCheckpointInput,
  type UpdateInspectionCheckpointInput,
} from '@/lib/validators-qm'

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class QualityServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'QualityServiceError'
    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends QualityServiceError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends QualityServiceError {
  constructor(resourceType: string, id: string) {
    super(`${resourceType} not found: ${id}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** The set of terminal statuses that indicate an inspection is finished. */
const TERMINAL_STATUSES = new Set<InspectionStatus>([
  InspectionStatus.PASSED,
  InspectionStatus.FAILED,
  InspectionStatus.CONDITIONAL,
])

/**
 * Full inspection include payload — always load checkpoints alongside the
 * parent record so callers receive a consistent shape.
 */
const INSPECTION_WITH_CHECKPOINTS = {
  checkpoints: {
    orderBy: { id: 'asc' as const },
  },
} as const

// ============================================================================
// 1. CREATE INSPECTION
// ============================================================================

/**
 * Creates a new QualityInspection with status PLANNED.
 *
 * Validation order:
 *  1. Schema validation (Zod)
 *  2. Business-logic context validation (validateInspectionContext)
 *  3. Referential existence checks against the database
 *  4. Database insert
 */
export async function createQualityInspection(
  input: CreateQualityInspectionInput,
  userId: string,
): Promise<QualityInspection & { checkpoints: InspectionCheckpoint[] }> {
  // --- Step 1: Schema validation ---
  const parseResult = CreateQualityInspectionSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid inspection input', errors)
  }

  const validated = parseResult.data

  // --- Step 2: Business-logic context validation ---
  const contextResult = validateInspectionContext(
    validated.inspectionType,
    validated.materialId,
    validated.batchId,
    validated.supplierId,
  )
  if (!contextResult.valid) {
    throw new ValidationError('Inspection context validation failed', contextResult.errors)
  }

  // --- Step 3: Referential existence checks ---
  const existenceErrors: string[] = []

  const material = await prisma.rawMaterial.findUnique({
    where: { id: validated.materialId },
    select: { id: true },
  })
  if (!material) {
    existenceErrors.push(`RawMaterial not found: ${validated.materialId}`)
  }

  if (validated.batchId) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: validated.batchId },
      select: { id: true },
    })
    if (!batch) {
      existenceErrors.push(`ProductionBatch not found: ${validated.batchId}`)
    }
  }

  if (validated.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: validated.supplierId },
      select: { id: true },
    })
    if (!supplier) {
      existenceErrors.push(`Supplier not found: ${validated.supplierId}`)
    }
  }

  if (existenceErrors.length > 0) {
    throw new ValidationError('Referenced resources do not exist', existenceErrors)
  }

  // --- Step 4: Persist ---
  const inspection = await prisma.qualityInspection.create({
    data: {
      inspectionType: validated.inspectionType,
      status: InspectionStatus.PLANNED,
      rawMaterialId: validated.materialId,
      productionBatchId: validated.batchId ?? null,
      supplierId: validated.supplierId ?? null,
      inspectedBy: userId,
      scheduledDate: validated.scheduledDate,
      notes: validated.notes ?? null,
    },
    include: INSPECTION_WITH_CHECKPOINTS,
  })

  return inspection
}

// ============================================================================
// 2. RETRIEVE INSPECTIONS
// ============================================================================

/**
 * Fetches a single QualityInspection by its ID.
 * Returns null when the record does not exist.
 */
export async function getQualityInspection(
  inspectionId: string,
): Promise<(QualityInspection & { checkpoints: InspectionCheckpoint[] }) | null> {
  const inspection = await prisma.qualityInspection.findUnique({
    where: { id: inspectionId },
    include: INSPECTION_WITH_CHECKPOINTS,
  })

  return inspection
}

/**
 * Lists QualityInspections with optional filtering and cursor-based pagination.
 *
 * Filters supported:
 *  - inspectionType, inspectionStatus
 *  - materialId (rawMaterialId), batchId (productionBatchId), supplierId
 *  - date range: fromDate <= scheduledDate <= toDate
 *
 * Returns both the page of records and the total count matching the filters.
 */
export async function listQualityInspections(
  filters: QualityInspectionFiltersInput,
): Promise<{
  inspections: (QualityInspection & { checkpoints: InspectionCheckpoint[] })[]
  total: number
}> {
  // Validate + apply defaults (limit=50, offset=0)
  const parseResult = QualityInspectionFiltersSchema.safeParse(filters)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid filter parameters', errors)
  }

  const {
    inspectionType,
    inspectionStatus,
    materialId,
    batchId,
    supplierId,
    fromDate,
    toDate,
    limit,
    offset,
  } = parseResult.data

  // Build dynamic where clause
  const where: Parameters<typeof prisma.qualityInspection.findMany>[0]['where'] = {}

  if (inspectionType !== undefined) {
    where.inspectionType = inspectionType
  }
  if (inspectionStatus !== undefined) {
    where.status = inspectionStatus
  }
  if (materialId !== undefined) {
    where.rawMaterialId = materialId
  }
  if (batchId !== undefined) {
    where.productionBatchId = batchId
  }
  if (supplierId !== undefined) {
    where.supplierId = supplierId
  }
  if (fromDate !== undefined || toDate !== undefined) {
    where.scheduledDate = {}
    if (fromDate !== undefined) {
      where.scheduledDate.gte = fromDate
    }
    if (toDate !== undefined) {
      where.scheduledDate.lte = toDate
    }
  }

  // Run count and data fetch in parallel for efficiency
  const [total, inspections] = await Promise.all([
    prisma.qualityInspection.count({ where }),
    prisma.qualityInspection.findMany({
      where,
      include: INSPECTION_WITH_CHECKPOINTS,
      orderBy: { scheduledDate: 'desc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { inspections, total }
}

// ============================================================================
// 3. UPDATE INSPECTION
// ============================================================================

/**
 * Applies a partial update to a QualityInspection.
 *
 * If inspectionStatus is provided the state-machine transition is validated.
 * On transition to a terminal status (PASSED | FAILED | CONDITIONAL) the
 * actualDate field is automatically set to the current timestamp if not
 * already present.
 */
export async function updateQualityInspection(
  inspectionId: string,
  input: UpdateQualityInspectionInput,
  userId: string,
): Promise<QualityInspection & { checkpoints: InspectionCheckpoint[] }> {
  // Existence check
  const existing = await prisma.qualityInspection.findUnique({
    where: { id: inspectionId },
    select: { id: true, status: true, actualDate: true, inspectedBy: true },
  })
  if (!existing) {
    throw new NotFoundError('QualityInspection', inspectionId)
  }

  // Schema validation
  const parseResult = UpdateQualityInspectionSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid update input', errors)
  }

  const validated = parseResult.data

  // State-machine transition guard
  if (validated.inspectionStatus !== undefined) {
    const allowed = validateInspectionTransition(existing.status, validated.inspectionStatus)
    if (!allowed) {
      throw new ValidationError('Invalid inspection status transition', [
        `Cannot transition from ${existing.status} to ${validated.inspectionStatus}`,
      ])
    }
  }

  // Determine actualDate: auto-set when entering a terminal status
  let actualDate: Date | null | undefined = undefined
  if (
    validated.inspectionStatus !== undefined &&
    TERMINAL_STATUSES.has(validated.inspectionStatus as InspectionStatus)
  ) {
    // Preserve an existing actualDate; otherwise stamp now
    actualDate = existing.actualDate ?? new Date()
  }
  // If completedDate was explicitly supplied in the input, honour it
  if (validated.completedDate !== undefined) {
    actualDate = validated.completedDate
  }

  // Build update payload — only include defined fields
  const updateData: Parameters<typeof prisma.qualityInspection.update>[0]['data'] = {}

  if (validated.inspectionStatus !== undefined) {
    updateData.status = validated.inspectionStatus
  }
  if (validated.notes !== undefined) {
    updateData.notes = validated.notes
  }
  if (actualDate !== undefined) {
    updateData.actualDate = actualDate
  }
  // Record who last touched the record
  updateData.inspectedBy = userId

  const updated = await prisma.qualityInspection.update({
    where: { id: inspectionId },
    data: updateData,
    include: INSPECTION_WITH_CHECKPOINTS,
  })

  return updated
}

// ============================================================================
// 4. INSPECTION CHECKPOINTS
// ============================================================================

/**
 * Creates an InspectionCheckpoint linked to a QualityInspection.
 * The parent inspection must exist; its existence is verified before insert.
 */
export async function createInspectionCheckpoint(
  inspectionId: string,
  input: CreateInspectionCheckpointInput,
  _userId: string,
): Promise<InspectionCheckpoint> {
  // Verify parent inspection exists
  const inspection = await prisma.qualityInspection.findUnique({
    where: { id: inspectionId },
    select: { id: true },
  })
  if (!inspection) {
    throw new NotFoundError('QualityInspection', inspectionId)
  }

  // Schema validation — enforce inspectionId consistency
  const normalizedInput = { ...input, inspectionId }
  const parseResult = CreateInspectionCheckpointSchema.safeParse(normalizedInput)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid checkpoint input', errors)
  }

  const validated = parseResult.data

  const checkpoint = await prisma.inspectionCheckpoint.create({
    data: {
      inspectionId: validated.inspectionId,
      checkName: validated.checkpointName,
      passed: validated.passed,
      notes: validated.notes ?? null,
    },
  })

  return checkpoint
}

/**
 * Returns all InspectionCheckpoints for the given inspection, ordered by
 * creation order (ascending id).
 */
export async function getInspectionCheckpoints(
  inspectionId: string,
): Promise<InspectionCheckpoint[]> {
  const checkpoints = await prisma.inspectionCheckpoint.findMany({
    where: { inspectionId },
    orderBy: { id: 'asc' },
  })

  return checkpoints
}

/**
 * Applies a partial update to an InspectionCheckpoint.
 * Throws NotFoundError if the checkpoint does not exist.
 */
export async function updateInspectionCheckpoint(
  checkpointId: string,
  input: UpdateInspectionCheckpointInput,
  _userId: string,
): Promise<InspectionCheckpoint> {
  // Existence check
  const existing = await prisma.inspectionCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('InspectionCheckpoint', checkpointId)
  }

  // Schema validation
  const parseResult = UpdateInspectionCheckpointSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid checkpoint update input', errors)
  }

  const validated = parseResult.data

  // Build update payload — only send defined fields
  const updateData: Parameters<typeof prisma.inspectionCheckpoint.update>[0]['data'] = {}
  if (validated.passed !== undefined) {
    updateData.passed = validated.passed
  }
  if (validated.notes !== undefined) {
    updateData.notes = validated.notes
  }

  const updated = await prisma.inspectionCheckpoint.update({
    where: { id: checkpointId },
    data: updateData,
  })

  return updated
}

// ============================================================================
// 5. ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Computes the aggregate pass/fail result for a QualityInspection by counting
 * its checkpoints.
 *
 * Returns:
 *  allPassed   – true only when every checkpoint passed and at least one exists
 *  passedCount – number of checkpoints with passed=true
 *  totalCount  – total number of checkpoints
 */
export async function calculateInspectionResult(
  inspectionId: string,
): Promise<{ allPassed: boolean; passedCount: number; totalCount: number }> {
  const checkpoints = await prisma.inspectionCheckpoint.findMany({
    where: { inspectionId },
    select: { passed: true },
  })

  const totalCount = checkpoints.length
  const passedCount = checkpoints.filter((c) => c.passed).length
  const allPassed = totalCount > 0 && passedCount === totalCount

  return { allPassed, passedCount, totalCount }
}

/**
 * Returns a high-level summary of all QualityInspections, optionally scoped to
 * a date range (applied to scheduledDate).
 *
 * Aggregated metrics:
 *  totalInspections                      – total matching records
 *  byStatus                              – count per InspectionStatus value
 *  byType                                – count per InspectionType value
 *  averageCheckpointsPerInspection       – mean checkpoint count (0 if no inspections)
 */
export async function getInspectionSummary(
  fromDate?: Date,
  toDate?: Date,
): Promise<{
  totalInspections: number
  byStatus: {
    PLANNED: number
    IN_PROGRESS: number
    PASSED: number
    FAILED: number
    CONDITIONAL: number
  }
  byType: {
    INCOMING: number
    IN_PROCESS: number
    FINAL: number
  }
  averageCheckpointsPerInspection: number
}> {
  // Build date-range filter
  const dateWhere =
    fromDate !== undefined || toDate !== undefined
      ? {
          scheduledDate: {
            ...(fromDate !== undefined ? { gte: fromDate } : {}),
            ...(toDate !== undefined ? { lte: toDate } : {}),
          },
        }
      : {}

  // Fetch all inspections in range (select only required fields for efficiency)
  const inspections = await prisma.qualityInspection.findMany({
    where: dateWhere,
    select: {
      id: true,
      status: true,
      inspectionType: true,
      _count: {
        select: { checkpoints: true },
      },
    },
  })

  const totalInspections = inspections.length

  // Initialise counters with explicit keys to satisfy the return type
  const byStatus = {
    PLANNED: 0,
    IN_PROGRESS: 0,
    PASSED: 0,
    FAILED: 0,
    CONDITIONAL: 0,
  }

  const byType = {
    INCOMING: 0,
    IN_PROCESS: 0,
    FINAL: 0,
  }

  let totalCheckpoints = 0

  for (const inspection of inspections) {
    // Status grouping — cast is safe because Prisma enums are exhaustive
    byStatus[inspection.status as keyof typeof byStatus] += 1

    // Type grouping
    byType[inspection.inspectionType as keyof typeof byType] += 1

    // Aggregate checkpoint count
    totalCheckpoints += inspection._count.checkpoints
  }

  const averageCheckpointsPerInspection =
    totalInspections > 0
      ? Math.round((totalCheckpoints / totalInspections) * 100) / 100
      : 0

  return {
    totalInspections,
    byStatus,
    byType,
    averageCheckpointsPerInspection,
  }
}
