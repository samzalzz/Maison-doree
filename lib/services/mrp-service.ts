/**
 * lib/services/mrp-service.ts
 *
 * Production Planning (PP) / MRP business logic layer.
 *
 * Responsibilities:
 *  - Validate all inputs with schemas from lib/validators-pp.ts before
 *    touching the database.
 *  - Enforce MRP business rules via validateMRPSuggestion and
 *    validateMaterialAllocation before persisting records.
 *  - Verify that referenced resources (Recipe, RawMaterial, Supplier,
 *    ProductionBatch, ProductionLab) exist before creating dependent records.
 *  - Provide capacity and stock analysis helpers for scheduling decisions.
 *
 * Error types thrown:
 *  - ValidationError  – malformed input or a rejected business-logic rule
 *  - NotFoundError    – the requested record does not exist
 *
 * DB field mapping notes:
 *  EnhancedForecast.confidenceLevel ← validator.confidence
 *  EnhancedForecast.sevenDayAvg     ← validator.sevenDayAverage
 *  EnhancedForecast.thirtyDayAvg    ← validator.thirtyDayAverage
 *  EnhancedForecast.seasonalFactor  ← validator.seasonalFactor
 *  validator.fourteenDayAverage has no DB column and is silently omitted.
 *
 * NOTE: EnhancedForecast, MRPSuggestion, MaterialAllocation and
 *   MRPSuggestionStatus are not yet present in the generated Prisma client
 *   (prisma generate must be run after the PP migration). Local type aliases
 *   are defined here so the service compiles and is ready to use once the
 *   client is regenerated. The DB accessor calls use the correct camelCase
 *   names that Prisma will produce (enhancedForecast, mRPSuggestion,
 *   materialAllocation).
 *
 * ProductionStatus IS present in the generated client and is imported normally.
 */

import { ProductionStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  CreateEnhancedForecastSchema,
  UpdateEnhancedForecastSchema,
  EnhancedForecastFiltersSchema,
  CreateMRPSuggestionSchema,
  MRPSuggestionFiltersSchema,
  CreateMaterialAllocationSchema,
  MaterialAllocationFiltersSchema,
  validateMRPSuggestion,
  validateMaterialAllocation,
  type CreateEnhancedForecastInput,
  type UpdateEnhancedForecastInput,
  type EnhancedForecastFiltersInput,
  type CreateMRPSuggestionInput,
  type MRPSuggestionFiltersInput,
  type CreateMaterialAllocationInput,
  type MaterialAllocationFiltersInput,
} from '@/lib/validators-pp'

// ============================================================================
// LOCAL TYPE ALIASES
// (These match the Prisma-generated types once `prisma generate` is run for
//  the PP migration. Using `any`-based aliases avoids compile errors before
//  the client is regenerated while keeping the rest of the code type-guided.)
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EnhancedForecast = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MRPSuggestion = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaterialAllocation = Record<string, any>

/** Status values mirroring MRPSuggestionStatus enum in the Prisma schema. */
const MRPStatus = {
  PENDING: 'PENDING',
  ORDERED: 'ORDERED',
  COMPLETED: 'COMPLETED',
  DISMISSED: 'DISMISSED',
} as const

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class MRPServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'MRPServiceError'
    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends MRPServiceError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends MRPServiceError {
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
 * Statuses that indicate a batch is actively consuming capacity.
 * CANCELLED and COMPLETED batches are excluded from capacity allocation counts.
 */
const ACTIVE_BATCH_STATUSES: ProductionStatus[] = [
  ProductionStatus.PLANNED,
  ProductionStatus.IN_PROGRESS,
  ProductionStatus.PAUSED,
]

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

// ============================================================================
// 1. ENHANCED FORECAST MANAGEMENT
// ============================================================================

/**
 * Creates a new EnhancedForecast record after verifying the recipe exists.
 *
 * Validation order:
 *  1. Schema validation (Zod)
 *  2. Verify recipe exists
 *  3. Persist
 */
export async function createEnhancedForecast(
  input: CreateEnhancedForecastInput,
  userId: string,
): Promise<EnhancedForecast> {
  // Step 1: Schema validation
  const validated = parseOrThrow(
    CreateEnhancedForecastSchema,
    input,
    'Invalid forecast input',
  )

  // Step 2: Verify recipe exists
  const recipe = await prisma.recipe.findUnique({
    where: { id: validated.recipeId },
    select: { id: true },
  })
  if (!recipe) {
    throw new NotFoundError('Recipe', validated.recipeId)
  }

  // Step 3: Persist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forecast = await (prisma as any).enhancedForecast.create({
    data: {
      date: validated.date,
      recipeId: validated.recipeId,
      predictedQuantity: validated.predictedQuantity,
      confidenceLevel: validated.confidence,
      algorithm: validated.algorithm,
      reasoning: validated.reasoning ?? null,
      sevenDayAvg: validated.sevenDayAverage ?? null,
      thirtyDayAvg: validated.thirtyDayAverage ?? null,
      seasonalFactor: validated.seasonalFactor ?? null,
    },
  })

  return forecast
}

/**
 * Fetches a single EnhancedForecast by ID.
 * Returns null when the record does not exist.
 */
export async function getEnhancedForecast(
  forecastId: string,
): Promise<EnhancedForecast | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forecast = await (prisma as any).enhancedForecast.findUnique({
    where: { id: forecastId },
  })

  return forecast
}

/**
 * Lists EnhancedForecasts with optional filtering and pagination.
 *
 * Filters supported:
 *  - recipeId, algorithm
 *  - date range: fromDate <= date <= toDate
 *  - minConfidence: confidenceLevel >= minConfidence
 *
 * Returns both the page of records and the total count matching the filters.
 */
export async function listEnhancedForecasts(
  filters: EnhancedForecastFiltersInput,
): Promise<{ forecasts: EnhancedForecast[]; total: number }> {
  const validated = parseOrThrow(
    EnhancedForecastFiltersSchema,
    filters,
    'Invalid forecast filter parameters',
  )

  const { recipeId, algorithm, fromDate, toDate, minConfidence, limit, offset } = validated

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (recipeId !== undefined) {
    where.recipeId = recipeId
  }
  if (algorithm !== undefined) {
    where.algorithm = algorithm
  }
  if (fromDate !== undefined || toDate !== undefined) {
    where.date = {}
    if (fromDate !== undefined) {
      where.date.gte = fromDate
    }
    if (toDate !== undefined) {
      where.date.lte = toDate
    }
  }
  if (minConfidence !== undefined) {
    where.confidenceLevel = { gte: minConfidence }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ef = (prisma as any).enhancedForecast
  const [total, forecasts] = await Promise.all([
    ef.count({ where }),
    ef.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { forecasts, total }
}

/**
 * Applies a partial update to an EnhancedForecast.
 * Throws NotFoundError if the forecast does not exist.
 */
export async function updateEnhancedForecast(
  forecastId: string,
  input: UpdateEnhancedForecastInput,
  userId: string,
): Promise<EnhancedForecast> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ef = (prisma as any).enhancedForecast

  // Step 1: Verify forecast exists
  const existing = await ef.findUnique({
    where: { id: forecastId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('EnhancedForecast', forecastId)
  }

  // Step 2: Schema validation
  const validated = parseOrThrow(
    UpdateEnhancedForecastSchema,
    input,
    'Invalid forecast update input',
  )

  // Build update payload — only include defined fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (validated.predictedQuantity !== undefined) {
    updateData.predictedQuantity = validated.predictedQuantity
  }
  if (validated.confidence !== undefined) {
    updateData.confidenceLevel = validated.confidence
  }
  if (validated.reasoning !== undefined) {
    updateData.reasoning = validated.reasoning
  }

  // Step 3: Persist
  const updated = await ef.update({
    where: { id: forecastId },
    data: updateData,
  })

  return updated
}

// ============================================================================
// 2. MRP SUGGESTION MANAGEMENT
// ============================================================================

/**
 * Creates a new MRPSuggestion with status PENDING.
 *
 * Validation order:
 *  1. Schema validation (Zod)
 *  2. Business-rule validation (validateMRPSuggestion)
 *  3. Verify material exists
 *  4. Verify supplier exists (if provided)
 *  5. Persist with status PENDING
 */
export async function createMRPSuggestion(
  input: CreateMRPSuggestionInput,
  userId: string,
): Promise<MRPSuggestion> {
  // Step 1: Schema validation
  const validated = parseOrThrow(
    CreateMRPSuggestionSchema,
    input,
    'Invalid MRP suggestion input',
  )

  // Step 2: Business-rule validation
  const bizResult = validateMRPSuggestion(
    validated.currentStock,
    validated.minThreshold,
    validated.projectedUsage,
    validated.recommendedQty,
    validated.maxCapacity,
  )
  if (!bizResult.valid) {
    throw new ValidationError('MRP suggestion business rule violation', bizResult.errors)
  }

  // Step 3: Verify material exists
  const material = await prisma.rawMaterial.findUnique({
    where: { id: validated.materialId },
    select: { id: true },
  })
  if (!material) {
    throw new NotFoundError('RawMaterial', validated.materialId)
  }

  // Step 4: Verify supplier exists (if provided)
  if (validated.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: validated.supplierId },
      select: { id: true },
    })
    if (!supplier) {
      throw new NotFoundError('Supplier', validated.supplierId)
    }
  }

  // Step 5: Persist with status PENDING
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestion = await (prisma as any).mRPSuggestion.create({
    data: {
      materialId: validated.materialId,
      supplierId: validated.supplierId ?? null,
      currentStock: validated.currentStock,
      minThreshold: validated.minThreshold,
      maxCapacity: validated.maxCapacity ?? null,
      projectedUsage: validated.projectedUsage,
      projectedDate: validated.projectedDate,
      recommendedQty: validated.recommendedQty,
      status: MRPStatus.PENDING,
    },
    include: {
      supplier: true,
    },
  })

  return suggestion
}

/**
 * Fetches a single MRPSuggestion by ID, including the supplier relation.
 * Returns null when the record does not exist.
 */
export async function getMRPSuggestion(
  suggestionId: string,
): Promise<MRPSuggestion | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestion = await (prisma as any).mRPSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      supplier: true,
    },
  })

  return suggestion
}

/**
 * Lists MRPSuggestions with optional filtering and pagination.
 *
 * Filters supported:
 *  - materialId, status, supplierId
 *  - date range: fromDate <= projectedDate <= toDate
 *
 * Returns both the page of records and the total count.
 */
export async function listMRPSuggestions(
  filters: MRPSuggestionFiltersInput,
): Promise<{ suggestions: MRPSuggestion[]; total: number }> {
  const validated = parseOrThrow(
    MRPSuggestionFiltersSchema,
    filters,
    'Invalid MRP suggestion filter parameters',
  )

  const { materialId, status, supplierId, fromDate, toDate, limit, offset } = validated

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (materialId !== undefined) {
    where.materialId = materialId
  }
  if (status !== undefined) {
    where.status = status
  }
  if (supplierId !== undefined) {
    where.supplierId = supplierId
  }
  if (fromDate !== undefined || toDate !== undefined) {
    where.projectedDate = {}
    if (fromDate !== undefined) {
      where.projectedDate.gte = fromDate
    }
    if (toDate !== undefined) {
      where.projectedDate.lte = toDate
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mrp = (prisma as any).mRPSuggestion
  const [total, suggestions] = await Promise.all([
    mrp.count({ where }),
    mrp.findMany({
      where,
      include: { supplier: true },
      orderBy: { projectedDate: 'asc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { suggestions, total }
}

/**
 * Updates the status of an MRPSuggestion.
 * All status transitions are permitted — no workflow restriction is applied.
 * Throws NotFoundError if the suggestion does not exist.
 * Auto-stamps dismissedAt when transitioning to DISMISSED.
 */
export async function updateMRPSuggestionStatus(
  suggestionId: string,
  newStatus: 'PENDING' | 'ORDERED' | 'COMPLETED' | 'DISMISSED',
  userId: string,
): Promise<MRPSuggestion> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mrp = (prisma as any).mRPSuggestion

  // Step 1: Verify suggestion exists
  const existing = await mrp.findUnique({
    where: { id: suggestionId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('MRPSuggestion', suggestionId)
  }

  // Step 2: Update status (with optional dismissedAt stamp)
  const updated = await mrp.update({
    where: { id: suggestionId },
    data: {
      status: newStatus,
      ...(newStatus === 'DISMISSED' ? { dismissedAt: new Date() } : {}),
    },
    include: { supplier: true },
  })

  return updated
}

// ============================================================================
// 3. MATERIAL ALLOCATION MANAGEMENT
// ============================================================================

/**
 * Allocates a quantity of raw material against a production batch.
 *
 * Validation order:
 *  1. Schema validation (Zod)
 *  2. Verify batch exists
 *  3. Verify material exists
 *  4. Check for duplicate allocation (same batch + material combination)
 *  5. Validate stock availability via validateMaterialAllocation
 *     - Get current stock from LabStock for the batch's lab
 *     - Sum all existing allocations for this material across all active batches
 *     - Ensure allocatedQty + alreadyAllocated <= availableStock
 *  6. Persist
 */
export async function allocateMaterial(
  input: CreateMaterialAllocationInput,
  userId: string,
): Promise<MaterialAllocation> {
  // Step 1: Schema validation
  const validated = parseOrThrow(
    CreateMaterialAllocationSchema,
    input,
    'Invalid material allocation input',
  )

  // Step 2: Verify batch exists
  const batch = await prisma.productionBatch.findUnique({
    where: { id: validated.batchId },
    select: { id: true, labId: true },
  })
  if (!batch) {
    throw new NotFoundError('ProductionBatch', validated.batchId)
  }

  // Step 3: Verify material exists
  const material = await prisma.rawMaterial.findUnique({
    where: { id: validated.materialId },
    select: { id: true },
  })
  if (!material) {
    throw new NotFoundError('RawMaterial', validated.materialId)
  }

  // Step 4: Check for duplicate allocation (@@unique([batchId, materialId]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma = (prisma as any).materialAllocation
  const duplicate = await ma.findUnique({
    where: {
      batchId_materialId: {
        batchId: validated.batchId,
        materialId: validated.materialId,
      },
    },
    select: { id: true },
  })
  if (duplicate) {
    throw new ValidationError('Duplicate material allocation', [
      `Material ${validated.materialId} is already allocated to batch ${validated.batchId}`,
    ])
  }

  // Step 5: Validate available stock
  // Current stock from the batch's lab
  const labStock = await prisma.labStock.findUnique({
    where: {
      labId_materialId: {
        labId: batch.labId,
        materialId: validated.materialId,
      },
    },
    select: { quantity: true },
  })

  const availableStock = labStock ? Number(labStock.quantity) : 0

  // Sum of all existing allocations for this material across all batches
  const existingAgg = await ma.aggregate({
    where: { materialId: validated.materialId },
    _sum: { allocatedQty: true },
  })

  const alreadyAllocated = existingAgg._sum?.allocatedQty
    ? Number(existingAgg._sum.allocatedQty)
    : 0

  const stockResult = validateMaterialAllocation(
    validated.allocatedQty,
    availableStock,
    alreadyAllocated,
  )
  if (!stockResult.valid) {
    throw new ValidationError('Insufficient material stock', stockResult.errors)
  }

  // Step 6: Persist
  const allocation = await ma.create({
    data: {
      batchId: validated.batchId,
      materialId: validated.materialId,
      allocatedQty: validated.allocatedQty,
    },
  })

  return allocation
}

/**
 * Fetches a single MaterialAllocation by ID.
 * Returns null when the record does not exist.
 */
export async function getMaterialAllocation(
  allocationId: string,
): Promise<MaterialAllocation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocation = await (prisma as any).materialAllocation.findUnique({
    where: { id: allocationId },
  })

  return allocation
}

/**
 * Lists MaterialAllocations with optional filtering and pagination.
 *
 * Filters supported: batchId, materialId
 * Returns both the page of records and the total count.
 */
export async function listMaterialAllocations(
  filters: MaterialAllocationFiltersInput,
): Promise<{ allocations: MaterialAllocation[]; total: number }> {
  const validated = parseOrThrow(
    MaterialAllocationFiltersSchema,
    filters,
    'Invalid material allocation filter parameters',
  )

  const { batchId, materialId, limit, offset } = validated

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}

  if (batchId !== undefined) {
    where.batchId = batchId
  }
  if (materialId !== undefined) {
    where.materialId = materialId
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma = (prisma as any).materialAllocation
  const [total, allocations] = await Promise.all([
    ma.count({ where }),
    ma.findMany({
      where,
      orderBy: { allocatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { allocations, total }
}

/**
 * Records the actual quantity of material consumed by a production batch.
 * actualQty may be 0 when material was reserved but ultimately unused.
 * Throws NotFoundError if the allocation does not exist.
 * Throws ValidationError if actualQty is negative.
 */
export async function updateAllocationActualQty(
  allocationId: string,
  actualQty: number,
  userId: string,
): Promise<MaterialAllocation> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ma = (prisma as any).materialAllocation

  // Step 1: Verify allocation exists
  const existing = await ma.findUnique({
    where: { id: allocationId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('MaterialAllocation', allocationId)
  }

  // Step 2: Validate actualQty >= 0
  if (actualQty < 0) {
    throw new ValidationError('Invalid actualQty', [
      'actualQty must be greater than or equal to 0',
    ])
  }

  // Step 3: Persist
  const updated = await ma.update({
    where: { id: allocationId },
    data: { actualQty },
  })

  return updated
}

// ============================================================================
// 4. CAPACITY & STOCK ANALYSIS
// ============================================================================

/**
 * Returns a daily capacity breakdown for a lab over a date range.
 *
 * For each calendar day in [fromDate, toDate]:
 *  - capacity  = lab.capacity (maximum concurrent batches)
 *  - allocated = count of PLANNED / IN_PROGRESS / PAUSED batches whose
 *                plannedStartTime falls on that calendar day
 *  - available = max(0, capacity - allocated)
 *
 * Throws NotFoundError if the lab does not exist.
 */
export async function getAvailableCapacity(
  labId: string,
  fromDate: Date,
  toDate: Date,
): Promise<{
  labId: string
  dates: Array<{
    date: Date
    capacity: number
    allocated: number
    available: number
  }>
}> {
  // Step 1: Get lab details
  const lab = await prisma.productionLab.findUnique({
    where: { id: labId },
    select: { id: true, capacity: true },
  })
  if (!lab) {
    throw new NotFoundError('ProductionLab', labId)
  }

  // Step 2: Get all active-status batches for this lab in the date range
  const batches = await prisma.productionBatch.findMany({
    where: {
      labId,
      status: { in: ACTIVE_BATCH_STATUSES },
      plannedStartTime: {
        gte: fromDate,
        lte: toDate,
      },
    },
    select: { plannedStartTime: true },
  })

  // Map date-string → count of batches on that day
  const allocationMap = new Map<string, number>()
  for (const batch of batches) {
    const dateKey = batch.plannedStartTime.toISOString().split('T')[0]
    allocationMap.set(dateKey, (allocationMap.get(dateKey) ?? 0) + 1)
  }

  // Step 3: Build daily breakdown
  const dates: Array<{
    date: Date
    capacity: number
    allocated: number
    available: number
  }> = []

  // Iterate day by day using UTC noon to avoid DST edge cases
  const current = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
      12,
      0,
      0,
      0,
    ),
  )
  const end = new Date(
    Date.UTC(
      toDate.getUTCFullYear(),
      toDate.getUTCMonth(),
      toDate.getUTCDate(),
      12,
      0,
      0,
      0,
    ),
  )

  while (current <= end) {
    const dateKey = current.toISOString().split('T')[0]
    const allocated = allocationMap.get(dateKey) ?? 0
    const available = Math.max(0, lab.capacity - allocated)

    dates.push({
      date: new Date(current),
      capacity: lab.capacity,
      allocated,
      available,
    })

    current.setUTCDate(current.getUTCDate() + 1)
  }

  return { labId, dates }
}

/**
 * Returns the stock level of a material across all labs that hold it.
 *
 * Status classification per lab:
 *  - ADEQUATE  if quantity > minThreshold * 1.5
 *  - LOW       if minThreshold <= quantity <= minThreshold * 1.5
 *  - CRITICAL  if quantity < minThreshold
 *
 * Throws NotFoundError if the material does not exist.
 */
export async function getMaterialStock(
  materialId: string,
): Promise<{
  materialId: string
  byLab: Array<{
    labId: string
    quantity: number
    minThreshold: number
    status: 'ADEQUATE' | 'LOW' | 'CRITICAL'
  }>
}> {
  // Verify material exists
  const material = await prisma.rawMaterial.findUnique({
    where: { id: materialId },
    select: { id: true },
  })
  if (!material) {
    throw new NotFoundError('RawMaterial', materialId)
  }

  // Get LabStock records for this material across all labs
  const labStocks = await prisma.labStock.findMany({
    where: { materialId },
    select: {
      labId: true,
      quantity: true,
      minThreshold: true,
    },
  })

  const byLab = labStocks.map((stock) => {
    const qty = Number(stock.quantity)
    const threshold = Number(stock.minThreshold)

    let status: 'ADEQUATE' | 'LOW' | 'CRITICAL'
    if (qty > threshold * 1.5) {
      status = 'ADEQUATE'
    } else if (qty < threshold) {
      status = 'CRITICAL'
    } else {
      // qty is in the range [threshold, threshold * 1.5]
      status = 'LOW'
    }

    return {
      labId: stock.labId,
      quantity: qty,
      minThreshold: threshold,
      status,
    }
  })

  return { materialId, byLab }
}
