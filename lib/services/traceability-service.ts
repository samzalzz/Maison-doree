/**
 * lib/services/traceability-service.ts
 *
 * Traceability business logic layer.
 *
 * Responsibilities:
 *  - Validate all inputs with schemas from lib/validators-pp.ts before
 *    touching the database.
 *  - Verify that referenced ProductionBatch records exist before creating
 *    TraceabilityRecord events.
 *  - Provide full batch genealogy: events, source material allocations, and
 *    inter-batch dependency graphs.
 *  - Support recall scope analysis by locating every batch that consumed an
 *    affected material within a date range.
 *  - Generate human-readable compliance timelines and text reports suitable
 *    for display, printing, or email distribution.
 *
 * Error types thrown:
 *  - ValidationError  – malformed input or failed schema validation
 *  - NotFoundError    – the requested record does not exist
 *
 * DB model notes (from schema.prisma):
 *  TraceabilityRecord.details    String   (non-nullable — defaults to '' when
 *                                          the caller omits it)
 *  TraceabilityRecord.location   String?  (nullable)
 *  TraceabilityRecord.recordedBy String   (userId or display name)
 *  ProductionBatch.batchNumber   String   @unique
 *  ProductionBatch.recipeId      String   (FK → Recipe)
 *  ProductionBatch.actualStartTime         DateTime?
 *  ProductionBatch.actualCompletionTime    DateTime?
 *  MaterialAllocation.batchId    String   (FK → ProductionBatch)
 *  MaterialAllocation.materialId String   (FK → RawMaterial)
 *
 * The TraceabilityRecord and MaterialAllocation models are not yet present in
 * the generated Prisma client in this environment (prisma generate must be run
 * after the PP migration). Local type aliases are therefore defined with
 * `Record<string, any>` so the service compiles and is ready once the client
 * is regenerated. All Prisma accessor calls use the camelCase names Prisma
 * will produce: traceabilityRecord, materialAllocation.
 */

import { type ProductionBatch, type Recipe } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  CreateTraceabilityRecordSchema,
  TraceabilityRecordFiltersSchema,
  type CreateTraceabilityRecordInput,
  type TraceabilityRecordFiltersInput,
} from '@/lib/validators-pp'

// ============================================================================
// LOCAL TYPE ALIASES
// (Match Prisma-generated types once `prisma generate` is run for the PP
//  migration. Using Record<string, any> avoids compile errors in the interim.)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TraceabilityRecord = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaterialAllocation = Record<string, any>

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class TraceabilityServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'TraceabilityServiceError'
    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends TraceabilityServiceError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends TraceabilityServiceError {
  constructor(resourceType: string, id: string) {
    super(`${resourceType} not found: ${id}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Parses a Zod schema and throws ValidationError on failure.
 * Centralises the error-extraction pattern used across all service functions.
 */
function parseOrThrow<T>(
  schema: {
    safeParse: (input: unknown) => {
      success: boolean
      data?: T
      error?: { issues: Array<{ path: (string | number)[]; message: string }> }
    }
  },
  input: unknown,
  contextMessage: string,
): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    const errors = result.error!.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError(contextMessage, errors)
  }
  return result.data as T
}

/** Accessor for TraceabilityRecord via (prisma as any) until Prisma regenerates. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tr = () => (prisma as any).traceabilityRecord

/** Accessor for MaterialAllocation via (prisma as any) until Prisma regenerates. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ma = () => (prisma as any).materialAllocation

// ============================================================================
// 1. EVENT RECORDING
// ============================================================================

/**
 * Records an immutable traceability event against a production batch.
 *
 * Validation order:
 *  1. Schema validation (Zod via CreateTraceabilityRecordSchema)
 *  2. Verify batch exists
 *  3. Persist TraceabilityRecord
 *  4. Return created record
 *
 * Throws ValidationError if schema validation fails.
 * Throws NotFoundError if the batch does not exist.
 */
export async function recordEvent(
  input: CreateTraceabilityRecordInput,
  userId: string,
): Promise<TraceabilityRecord> {
  // Step 1: Schema validation
  const validated = parseOrThrow(
    CreateTraceabilityRecordSchema,
    input,
    'Invalid traceability record input',
  )

  // Step 2: Verify batch exists
  const batch = await prisma.productionBatch.findUnique({
    where: { id: validated.batchId },
    select: { id: true },
  })
  if (!batch) {
    throw new NotFoundError('ProductionBatch', validated.batchId)
  }

  // Step 3: Persist
  const record = await tr().create({
    data: {
      batchId: validated.batchId,
      event: validated.event,
      location: validated.location ?? null,
      details: validated.details ?? '',
      recordedBy: userId,
    },
  })

  return record
}

// ============================================================================
// 2. BATCH GENEALOGY
// ============================================================================

/**
 * Returns the full genealogy for a production batch:
 *  - batch details with its Recipe
 *  - all TraceabilityRecord events (newest first)
 *  - all MaterialAllocation records (source materials)
 *  - dependency map (recipe version + any source batches for intermediate materials)
 *
 * Throws NotFoundError if the batch does not exist.
 */
export async function getBatchTraceability(
  batchId: string,
): Promise<{
  batch: ProductionBatch & { recipe: Recipe }
  events: TraceabilityRecord[]
  sourceAllocations: MaterialAllocation[]
  dependencies: Array<{ type: 'batch' | 'recipe'; id: string; name: string }>
}> {
  // Step 1: Query batch details with recipe
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
    include: { recipe: true },
  })
  if (!batch) {
    throw new NotFoundError('ProductionBatch', batchId)
  }

  // Step 2: Get all TraceabilityRecord events for this batch (newest first)
  const events: TraceabilityRecord[] = await tr().findMany({
    where: { batchId },
    orderBy: { timestamp: 'desc' },
  })

  // Step 3: Get all MaterialAllocation records for this batch
  const sourceAllocations: MaterialAllocation[] = await ma().findMany({
    where: { batchId },
    include: { material: true },
  })

  // Step 4: Build dependency map
  //   - Always include the recipe as a dependency
  //   - For each allocation referencing an intermediate material (isIntermediate=true),
  //     find the batch that produced it and add it as a 'batch' dependency
  const dependencies: Array<{ type: 'batch' | 'recipe'; id: string; name: string }> = []

  // Recipe dependency
  dependencies.push({
    type: 'recipe',
    id: batch.recipe.id,
    name: batch.recipe.name,
  })

  // Source batch dependencies: intermediate materials are produced by other batches.
  // Find batches whose recipeId matches the productionRecipeId of intermediate materials.
  for (const allocation of sourceAllocations) {
    const material = allocation.material
    if (material?.isIntermediate && material.productionRecipeId) {
      // Find the most recent completed batch that used this recipe as its production recipe
      const sourceBatch = await prisma.productionBatch.findFirst({
        where: {
          recipeId: material.productionRecipeId,
          status: 'COMPLETED',
        },
        orderBy: { actualCompletionTime: 'desc' },
        select: { id: true, batchNumber: true },
      })
      if (sourceBatch) {
        // Avoid duplicate entries for the same source batch
        const alreadyAdded = dependencies.some(
          (d) => d.type === 'batch' && d.id === sourceBatch.id,
        )
        if (!alreadyAdded) {
          dependencies.push({
            type: 'batch',
            id: sourceBatch.id,
            name: sourceBatch.batchNumber,
          })
        }
      }
    }
  }

  return {
    batch: batch as ProductionBatch & { recipe: Recipe },
    events,
    sourceAllocations,
    dependencies,
  }
}

/**
 * Returns all TraceabilityRecord rows whose event type is RECALL,
 * ordered newest-first with offset-based pagination.
 */
export async function getRecallHistory(
  limit = 50,
  offset = 0,
): Promise<{ recalls: TraceabilityRecord[]; total: number }> {
  const where = { event: 'RECALL' }

  const [total, recalls] = await Promise.all([
    tr().count({ where }),
    tr().findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: { batch: true },
    }),
  ])

  return { recalls, total }
}

/**
 * Traces the complete origin chain of a production batch:
 *  - Immediate material allocations
 *  - For each intermediate material: the batch that produced it
 *  - A chronological event timeline (production start/end/shipping)
 *
 * Throws NotFoundError if the batch does not exist.
 */
export async function traceBatchOrigins(
  batchId: string,
): Promise<{
  batch: ProductionBatch
  immediateOrigins: MaterialAllocation[]
  sourceAllocations: { source: MaterialAllocation; batch?: ProductionBatch }[]
  timeline: { timestamp: Date; event: string; location?: string }[]
}> {
  // Step 1: Get batch
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
  })
  if (!batch) {
    throw new NotFoundError('ProductionBatch', batchId)
  }

  // Step 2: Get immediate material allocations with material details
  const immediateOrigins: MaterialAllocation[] = await ma().findMany({
    where: { batchId },
    include: { material: true },
  })

  // Step 3: For each intermediate material, find the batch that produced it
  const sourceAllocations: { source: MaterialAllocation; batch?: ProductionBatch }[] = []

  for (const allocation of immediateOrigins) {
    const material = allocation.material

    if (material?.isIntermediate && material.productionRecipeId) {
      // Find the completed batch that produced this intermediate product
      const producerBatch = await prisma.productionBatch.findFirst({
        where: {
          recipeId: material.productionRecipeId,
          status: 'COMPLETED',
        },
        orderBy: { actualCompletionTime: 'desc' },
      })
      sourceAllocations.push({
        source: allocation,
        batch: producerBatch ?? undefined,
      })
    } else {
      // Raw material — no producing batch
      sourceAllocations.push({ source: allocation })
    }
  }

  // Step 4: Build event timeline from TraceabilityRecord events + batch timestamps
  const traceEvents: TraceabilityRecord[] = await tr().findMany({
    where: { batchId },
    orderBy: { timestamp: 'asc' },
  })

  const timeline: { timestamp: Date; event: string; location?: string }[] = traceEvents.map(
    (evt: TraceabilityRecord) => ({
      timestamp: evt.timestamp as Date,
      event: evt.event as string,
      location: evt.location as string | undefined,
    }),
  )

  // Supplement with batch-level timestamps when no corresponding event was recorded
  const hasStartEvent = timeline.some((t) => t.event === 'PRODUCTION_STARTED')
  const hasEndEvent = timeline.some((t) => t.event === 'PRODUCTION_COMPLETED')

  if (!hasStartEvent && batch.actualStartTime) {
    timeline.unshift({
      timestamp: batch.actualStartTime,
      event: 'PRODUCTION_STARTED',
    })
  }
  if (!hasEndEvent && batch.actualCompletionTime) {
    timeline.push({
      timestamp: batch.actualCompletionTime,
      event: 'PRODUCTION_COMPLETED',
    })
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  return { batch, immediateOrigins, sourceAllocations, timeline }
}

// ============================================================================
// 3. TRACEABILITY QUERIES
// ============================================================================

/**
 * Searches TraceabilityRecord rows with optional filters and pagination.
 *
 * Filters supported:
 *  - batchId, event type
 *  - date range: fromDate <= timestamp <= toDate
 *
 * Returns both the matching page and total count.
 * Throws ValidationError if filter parameters fail schema validation.
 */
export async function searchEvents(
  filters: TraceabilityRecordFiltersInput,
): Promise<{ events: TraceabilityRecord[]; total: number }> {
  // Step 1: Validate filters (applies pagination defaults limit=50, offset=0)
  const validated = parseOrThrow(
    TraceabilityRecordFiltersSchema,
    filters,
    'Invalid traceability filter parameters',
  )

  const { batchId, event, fromDate, toDate, limit, offset } = validated

  // Step 2: Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (batchId !== undefined) {
    where.batchId = batchId
  }
  if (event !== undefined) {
    where.event = event
  }
  if (fromDate !== undefined || toDate !== undefined) {
    where.timestamp = {}
    if (fromDate !== undefined) {
      where.timestamp.gte = fromDate
    }
    if (toDate !== undefined) {
      where.timestamp.lte = toDate
    }
  }

  // Step 3: Run count + data fetch in parallel
  const [total, events] = await Promise.all([
    tr().count({ where }),
    tr().findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: { batch: true },
    }),
  ])

  return { events, total }
}

/**
 * Finds all ProductionBatch records that consumed a specific raw material within a
 * date range. Used to determine the scope of a recall.
 *
 * Filters:
 *  - affectedMaterialId: materialId in MaterialAllocation
 *  - fromDate / toDate: applied to ProductionBatch.plannedStartTime
 *
 * The recallReason parameter is accepted for caller context but is not used
 * as a database filter — it exists so callers can document why the query is
 * being run without requiring a separate audit call.
 */
export async function getBatchesForRecall(
  recallReason: string,    // eslint-disable-line @typescript-eslint/no-unused-vars
  affectedMaterialId: string,
  fromDate: Date,
  toDate: Date,
): Promise<ProductionBatch[]> {
  // Step 1: Find all allocations for the affected material
  const allocations: MaterialAllocation[] = await ma().findMany({
    where: { materialId: affectedMaterialId },
    select: { batchId: true },
  })

  const batchIds = allocations.map((a: MaterialAllocation) => a.batchId as string)

  if (batchIds.length === 0) {
    return []
  }

  // Step 2: Filter those batches by production date range
  const batches = await prisma.productionBatch.findMany({
    where: {
      id: { in: batchIds },
      plannedStartTime: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { plannedStartTime: 'asc' },
  })

  return batches
}

// ============================================================================
// 4. COMPLIANCE & REPORTING
// ============================================================================

/**
 * Returns a structured compliance timeline for a production batch, suitable
 * for regulatory audit trails.
 *
 * Includes:
 *  - Batch identity (batchNumber, recipe name)
 *  - Key timestamps (productionStart, productionEnd, shipped)
 *  - Quality inspection result if one exists (most recent FINAL inspection)
 *  - Ordered list of all traceability events
 *
 * Throws NotFoundError if the batch does not exist.
 */
export async function getComplianceTimeline(
  batchId: string,
): Promise<{
  batchId: string
  batchNumber: string
  recipe: string
  productionStart?: Date
  productionEnd?: Date
  shipped?: Date
  qualityCheckDate?: Date
  qualityStatus?: string
  events: Array<{ timestamp: Date; event: string; location?: string; details?: string }>
}> {
  // Step 1: Get batch with recipe
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
    include: { recipe: true },
  })
  if (!batch) {
    throw new NotFoundError('ProductionBatch', batchId)
  }

  // Step 2: Get all traceability events ordered chronologically
  const rawEvents: TraceabilityRecord[] = await tr().findMany({
    where: { batchId },
    orderBy: { timestamp: 'asc' },
  })

  // Step 3: Extract timeline markers from events
  const findEvent = (eventType: string): TraceabilityRecord | undefined =>
    rawEvents.find((e: TraceabilityRecord) => e.event === eventType)

  const startedEvent = findEvent('PRODUCTION_STARTED')
  const completedEvent = findEvent('PRODUCTION_COMPLETED')
  const shippedEvent = findEvent('SHIPPED')

  // Fall back to batch-level timestamps when event records are absent
  const productionStart: Date | undefined =
    (startedEvent?.timestamp as Date | undefined) ?? batch.actualStartTime ?? undefined
  const productionEnd: Date | undefined =
    (completedEvent?.timestamp as Date | undefined) ??
    batch.actualCompletionTime ??
    undefined
  const shipped: Date | undefined =
    (shippedEvent?.timestamp as Date | undefined) ?? undefined

  // Step 4: Look up the most recent FINAL quality inspection for this batch
  const qualityInspection = await prisma.qualityInspection.findFirst({
    where: {
      productionBatchId: batchId,
      inspectionType: 'FINAL',
    },
    orderBy: { scheduledDate: 'desc' },
    select: { actualDate: true, status: true },
  })

  // Step 5: Build event list
  const events = rawEvents.map((evt: TraceabilityRecord) => ({
    timestamp: evt.timestamp as Date,
    event: evt.event as string,
    location: evt.location as string | undefined,
    details: evt.details as string | undefined,
  }))

  return {
    batchId,
    batchNumber: batch.batchNumber,
    recipe: batch.recipe.name,
    productionStart,
    productionEnd,
    shipped,
    qualityCheckDate: qualityInspection?.actualDate ?? undefined,
    qualityStatus: qualityInspection?.status ?? undefined,
    events,
  }
}

/**
 * Generates a formatted plain-text traceability report for a production batch.
 *
 * Report sections:
 *  1. Batch Summary  — batchNumber, recipe, planned/actual dates, status
 *  2. Material Origins — list of allocated materials (raw + intermediate)
 *  3. Production Events — chronological traceability event log
 *  4. Quality Records — quality inspection outcome if available
 *  5. Shipping Information — shipped timestamp and location if recorded
 *
 * Throws NotFoundError if the batch does not exist.
 * Returns a formatted string suitable for display, printing, or email.
 */
export async function generateTraceabilityReport(
  batchId: string,
): Promise<string> {
  // Reuse getBatchTraceability for the core data set
  const { batch, events, sourceAllocations } = await getBatchTraceability(batchId)

  const timeline = await getComplianceTimeline(batchId)

  // Formatting helpers
  const fmt = (date?: Date | null): string =>
    date ? date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : 'N/A'

  const divider = '='.repeat(60)
  const sectionBreak = '-'.repeat(60)

  const lines: string[] = []

  // ---- Header ----
  lines.push(divider)
  lines.push('TRACEABILITY REPORT — MAISON DOREE')
  lines.push(`Generated: ${fmt(new Date())}`)
  lines.push(divider)

  // ---- Section 1: Batch Summary ----
  lines.push('')
  lines.push('BATCH SUMMARY')
  lines.push(sectionBreak)
  lines.push(`Batch Number  : ${batch.batchNumber}`)
  lines.push(`Recipe        : ${batch.recipe.name}`)
  lines.push(`Status        : ${batch.status}`)
  lines.push(`Quantity      : ${batch.quantity}`)
  lines.push(`Planned Start : ${fmt(batch.plannedStartTime)}`)
  lines.push(`Actual Start  : ${fmt(batch.actualStartTime)}`)
  lines.push(`Actual End    : ${fmt(batch.actualCompletionTime)}`)

  // ---- Section 2: Material Origins ----
  lines.push('')
  lines.push('MATERIAL ORIGINS')
  lines.push(sectionBreak)

  if (sourceAllocations.length === 0) {
    lines.push('  No material allocations recorded.')
  } else {
    for (const allocation of sourceAllocations) {
      const material = allocation.material
      const materialName: string = material?.name ?? allocation.materialId
      const materialType: string = material?.isIntermediate ? 'Intermediate' : 'Raw Material'
      const allocated: string = allocation.allocatedQty !== undefined
        ? String(allocation.allocatedQty)
        : 'N/A'
      const actual: string = allocation.actualQty !== undefined && allocation.actualQty !== null
        ? String(allocation.actualQty)
        : 'N/A'
      lines.push(`  - ${materialName} (${materialType})`)
      lines.push(`    Allocated: ${allocated} | Actual Used: ${actual}`)
    }
  }

  // ---- Section 3: Production Events ----
  lines.push('')
  lines.push('PRODUCTION EVENTS')
  lines.push(sectionBreak)

  if (events.length === 0) {
    lines.push('  No traceability events recorded.')
  } else {
    // Display chronologically (events were already sorted DESC; reverse for report)
    const chronological = [...events].reverse()
    for (const evt of chronological) {
      const ts = fmt(evt.timestamp as Date)
      const eventType: string = evt.event as string
      const location: string = evt.location ? ` @ ${evt.location}` : ''
      const details: string = evt.details ? ` — ${evt.details}` : ''
      lines.push(`  [${ts}] ${eventType}${location}${details}`)
    }
  }

  // ---- Section 4: Quality Records ----
  lines.push('')
  lines.push('QUALITY RECORDS')
  lines.push(sectionBreak)

  if (!timeline.qualityStatus) {
    lines.push('  No quality inspection on record for this batch.')
  } else {
    lines.push(`  Inspection Status : ${timeline.qualityStatus}`)
    lines.push(`  Check Date        : ${fmt(timeline.qualityCheckDate)}`)
  }

  // ---- Section 5: Shipping Information ----
  lines.push('')
  lines.push('SHIPPING INFORMATION')
  lines.push(sectionBreak)

  const shippedEvt = events.find(
    (e: TraceabilityRecord) => e.event === 'SHIPPED',
  )
  if (!shippedEvt) {
    lines.push('  Batch has not been shipped.')
  } else {
    lines.push(`  Shipped At : ${fmt(shippedEvt.timestamp as Date)}`)
    if (shippedEvt.location) {
      lines.push(`  Destination: ${shippedEvt.location as string}`)
    }
    if (shippedEvt.details) {
      lines.push(`  Notes      : ${shippedEvt.details as string}`)
    }
  }

  lines.push('')
  lines.push(divider)
  lines.push('END OF REPORT')
  lines.push(divider)

  return lines.join('\n')
}
