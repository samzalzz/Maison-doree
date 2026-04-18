import { z } from 'zod'

// ============================================================================
// REUSABLE ENUM VALIDATORS
// ============================================================================

/**
 * Zod validator for the MRPSuggestionStatus enum.
 *
 * Defined as a string literal tuple rather than imported from @prisma/client
 * because the Prisma client is regenerated only after `prisma generate` is
 * run for the PP phase. The values are sourced directly from prisma/schema.prisma:
 *   enum MRPSuggestionStatus { PENDING, ORDERED, COMPLETED, DISMISSED }
 */
export const MRPSuggestionStatusSchema = z.enum([
  'PENDING',
  'ORDERED',
  'COMPLETED',
  'DISMISSED',
])

/**
 * Zod validator for the TraceabilityEventType enum.
 *
 * Defined as a string literal tuple for the same reason as MRPSuggestionStatus.
 * Values sourced from prisma/schema.prisma:
 *   enum TraceabilityEventType {
 *     MATERIAL_ALLOCATED, PRODUCTION_STARTED, PRODUCTION_COMPLETED, SHIPPED, RECALL
 *   }
 */
export const TraceabilityEventTypeSchema = z.enum([
  'MATERIAL_ALLOCATED',
  'PRODUCTION_STARTED',
  'PRODUCTION_COMPLETED',
  'SHIPPED',
  'RECALL',
])

// ============================================================================
// ENHANCED FORECAST SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/production/forecast.
 *
 * Creates a new ML-assisted demand forecast entry for a specific recipe and
 * date. The algorithm field records which forecasting strategy was used
 * (e.g. SIMPLE_AVERAGE, SEASONAL, HYBRID_RULES_ML). Rolling averages and
 * seasonalFactor are optional enrichment data produced by the forecasting
 * pipeline.
 */
export const CreateEnhancedForecastSchema = z.object({
  date: z.coerce.date().describe('Forecast date'),
  recipeId: z.string().cuid('Invalid recipe ID'),
  predictedQuantity: z
    .number()
    .int('Predicted quantity must be a whole number')
    .positive('Predicted quantity must be positive')
    .describe('Predicted units'),
  confidence: z
    .number()
    .min(0, 'Confidence must be at least 0')
    .max(100, 'Confidence must not exceed 100')
    .describe('Confidence percentage 0-100'),
  algorithm: z
    .string()
    .min(1, 'Algorithm is required')
    .max(50, 'Algorithm must not exceed 50 characters')
    .describe('SIMPLE_AVERAGE, SEASONAL, HYBRID_RULES_ML, etc.'),
  reasoning: z
    .string()
    .max(500, 'Reasoning must not exceed 500 characters')
    .optional(),
  sevenDayAverage: z
    .number()
    .nonnegative('Seven-day average cannot be negative')
    .optional(),
  fourteenDayAverage: z
    .number()
    .nonnegative('Fourteen-day average cannot be negative')
    .optional(),
  thirtyDayAverage: z
    .number()
    .nonnegative('Thirty-day average cannot be negative')
    .optional(),
  seasonalFactor: z
    .number()
    .min(0, 'Seasonal factor cannot be negative')
    .max(5, 'Seasonal factor must not exceed 5')
    .optional()
    .describe('1.0 = normal, 1.5 = 50% higher'),
})

export type CreateEnhancedForecastInput = z.infer<typeof CreateEnhancedForecastSchema>

/**
 * Input schema for PATCH /api/admin/production/forecast/[id].
 *
 * Allows manual correction of a forecast's predicted quantity, confidence
 * level, or reasoning note. All fields are optional — only provided fields
 * are updated.
 */
export const UpdateEnhancedForecastSchema = z.object({
  predictedQuantity: z
    .number()
    .int('Predicted quantity must be a whole number')
    .positive('Predicted quantity must be positive')
    .optional(),
  confidence: z
    .number()
    .min(0, 'Confidence must be at least 0')
    .max(100, 'Confidence must not exceed 100')
    .optional(),
  reasoning: z
    .string()
    .max(500, 'Reasoning must not exceed 500 characters')
    .optional(),
})

export type UpdateEnhancedForecastInput = z.infer<typeof UpdateEnhancedForecastSchema>

/**
 * Query parameter schema for GET /api/admin/production/forecast.
 *
 * All filters are optional; pagination defaults apply.
 */
export const EnhancedForecastFiltersSchema = z.object({
  recipeId: z.string().cuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  minConfidence: z
    .number()
    .min(0, 'Minimum confidence must be at least 0')
    .max(100, 'Minimum confidence must not exceed 100')
    .optional(),
  algorithm: z.string().optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be a positive integer')
    .max(100, 'Maximum page size is 100')
    .default(50),
  offset: z
    .number()
    .int('Offset must be an integer')
    .nonnegative('Offset cannot be negative')
    .default(0),
})

export type EnhancedForecastFiltersInput = z.infer<typeof EnhancedForecastFiltersSchema>

// ============================================================================
// MRP SUGGESTION SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/production/mrp.
 *
 * Creates a Material Requirements Planning reorder recommendation. The caller
 * provides the current stock snapshot and projected usage so the system can
 * record the context in which the suggestion was generated.
 *
 * Business-rule consistency (e.g. projectedUsage > currentStock) is enforced
 * separately by validateMRPSuggestion; the Zod schema only performs structural
 * validation so that error messages remain field-specific.
 */
export const CreateMRPSuggestionSchema = z.object({
  materialId: z.string().cuid('Invalid material ID'),
  currentStock: z
    .number()
    .nonnegative('Current stock cannot be negative')
    .describe('Current available quantity'),
  minThreshold: z
    .number()
    .nonnegative('Minimum threshold cannot be negative')
    .describe('Reorder point'),
  projectedUsage: z
    .number()
    .nonnegative('Projected usage cannot be negative')
    .describe('Expected consumption'),
  projectedDate: z.coerce.date().describe('When to order by'),
  recommendedQty: z
    .number()
    .positive('Recommended quantity must be positive')
    .describe('Suggested order quantity'),
  supplierId: z
    .string()
    .cuid('Invalid supplier ID')
    .optional(),
  maxCapacity: z
    .number()
    .positive('Max capacity must be positive')
    .optional()
    .describe('Max units per order'),
})

export type CreateMRPSuggestionInput = z.infer<typeof CreateMRPSuggestionSchema>

/**
 * Input schema for PATCH /api/admin/production/mrp/[id].
 *
 * Supports status transitions and corrections to projected date and recommended
 * quantity. All fields are optional — only provided fields are updated.
 */
export const UpdateMRPSuggestionSchema = z.object({
  status: MRPSuggestionStatusSchema.optional(),
  projectedDate: z.coerce.date().optional(),
  recommendedQty: z
    .number()
    .positive('Recommended quantity must be positive')
    .optional(),
})

export type UpdateMRPSuggestionInput = z.infer<typeof UpdateMRPSuggestionSchema>

/**
 * Query parameter schema for GET /api/admin/production/mrp.
 *
 * All filters are optional; pagination defaults apply.
 */
export const MRPSuggestionFiltersSchema = z.object({
  materialId: z.string().cuid().optional(),
  status: MRPSuggestionStatusSchema.optional(),
  supplierId: z.string().cuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be a positive integer')
    .max(100, 'Maximum page size is 100')
    .default(50),
  offset: z
    .number()
    .int('Offset must be an integer')
    .nonnegative('Offset cannot be negative')
    .default(0),
})

export type MRPSuggestionFiltersInput = z.infer<typeof MRPSuggestionFiltersSchema>

// ============================================================================
// MATERIAL ALLOCATION SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/production/allocations.
 *
 * Reserves a quantity of raw material against a specific production batch.
 * Stock availability (allocatedQty + alreadyAllocated <= availableStock) is
 * enforced separately by validateMaterialAllocation before persisting.
 */
export const CreateMaterialAllocationSchema = z.object({
  batchId: z.string().cuid('Invalid batch ID'),
  materialId: z.string().cuid('Invalid material ID'),
  allocatedQty: z
    .number()
    .positive('Allocated quantity must be positive')
    .describe('Amount to reserve'),
})

export type CreateMaterialAllocationInput = z.infer<typeof CreateMaterialAllocationSchema>

/**
 * Input schema for PATCH /api/admin/production/allocations/[id].
 *
 * Records the actual quantity of material consumed once the production run
 * completes. actualQty may be 0 when material was reserved but ultimately
 * unused.
 */
export const UpdateMaterialAllocationSchema = z.object({
  actualQty: z
    .number()
    .nonnegative('Actual quantity cannot be negative')
    .optional()
    .describe('Actual amount used'),
})

export type UpdateMaterialAllocationInput = z.infer<typeof UpdateMaterialAllocationSchema>

/**
 * Query parameter schema for GET /api/admin/production/allocations.
 *
 * All filters are optional; pagination defaults apply.
 */
export const MaterialAllocationFiltersSchema = z.object({
  batchId: z.string().cuid().optional(),
  materialId: z.string().cuid().optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be a positive integer')
    .max(100, 'Maximum page size is 100')
    .default(50),
  offset: z
    .number()
    .int('Offset must be an integer')
    .nonnegative('Offset cannot be negative')
    .default(0),
})

export type MaterialAllocationFiltersInput = z.infer<typeof MaterialAllocationFiltersSchema>

// ============================================================================
// TRACEABILITY RECORD SCHEMAS
// ============================================================================

/**
 * Input schema for internal traceability event creation.
 *
 * TraceabilityRecord rows are written by the system during batch lifecycle
 * transitions (e.g. when a batch starts, completes, or is recalled). This
 * schema is intentionally minimal — it is NOT exposed as a user-facing API
 * endpoint; API routes that trigger events call the relevant batch action
 * endpoints, which persist traceability records as a side effect.
 */
export const CreateTraceabilityRecordSchema = z.object({
  batchId: z.string().cuid('Invalid batch ID'),
  event: TraceabilityEventTypeSchema,
  location: z
    .string()
    .max(100, 'Location must not exceed 100 characters')
    .optional(),
  details: z
    .string()
    .max(500, 'Details must not exceed 500 characters')
    .optional(),
  recordedBy: z
    .string()
    .min(1, 'recordedBy is required')
    .max(100, 'recordedBy must not exceed 100 characters')
    .describe('User ID or name'),
})

export type CreateTraceabilityRecordInput = z.infer<typeof CreateTraceabilityRecordSchema>

/**
 * Query parameter schema for GET /api/admin/production/traceability.
 *
 * Supports filtering batch genealogy records by batch, event type, and date
 * range. All filters are optional; pagination defaults apply.
 */
export const TraceabilityRecordFiltersSchema = z.object({
  batchId: z.string().cuid().optional(),
  event: TraceabilityEventTypeSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be a positive integer')
    .max(100, 'Maximum page size is 100')
    .default(50),
  offset: z
    .number()
    .int('Offset must be an integer')
    .nonnegative('Offset cannot be negative')
    .default(0),
})

export type TraceabilityRecordFiltersInput = z.infer<typeof TraceabilityRecordFiltersSchema>

// ============================================================================
// BUSINESS LOGIC VALIDATORS
// ============================================================================

/** Return type shared by all business-logic validators in this module. */
export type PPValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] }

/**
 * Validates that an MRP suggestion is internally consistent before persisting.
 *
 * Rules:
 *   1. projectedUsage must exceed currentStock — if stock already covers usage
 *      there is no reason to raise an order suggestion.
 *   2. recommendedQty must be >= minThreshold — ordering below the reorder
 *      threshold would immediately trigger another suggestion.
 *   3. If maxCapacity is provided, recommendedQty must not exceed it.
 *   4. If maxCapacity is provided, minThreshold must be less than maxCapacity
 *      (a threshold at or above max capacity is an unsatisfiable configuration).
 *
 * Call this after CreateMRPSuggestionSchema.parse() or
 * UpdateMRPSuggestionSchema.parse() succeeds, before writing to the database.
 */
export function validateMRPSuggestion(
  currentStock: number,
  minThreshold: number,
  projectedUsage: number,
  recommendedQty: number,
  maxCapacity?: number,
): PPValidationResult {
  const errors: string[] = []

  // Rule 1: Ordering is only justified when projected usage exceeds current stock.
  if (projectedUsage <= currentStock) {
    errors.push(
      'projectedUsage must be greater than currentStock — no order is needed when stock covers projected consumption',
    )
  }

  // Rule 2: Order quantity must meet the reorder threshold.
  if (recommendedQty < minThreshold) {
    errors.push(
      'recommendedQty must be greater than or equal to minThreshold — ordering below the threshold does not resolve the shortage',
    )
  }

  // Rules 3 & 4: maxCapacity constraints.
  if (maxCapacity !== undefined) {
    if (recommendedQty > maxCapacity) {
      errors.push(
        'recommendedQty must not exceed maxCapacity — the supplier or storage cannot accommodate the suggested order size',
      )
    }

    if (minThreshold >= maxCapacity) {
      errors.push(
        'minThreshold must be less than maxCapacity — a threshold at or above the maximum capacity is an unsatisfiable configuration',
      )
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * Validates that a material allocation does not exceed the available stock.
 *
 * Rules:
 *   1. allocatedQty must be greater than 0 (structural; confirmed here as a
 *      defence-in-depth check beyond the Zod schema).
 *   2. The sum of the new allocation and all existing allocations for this
 *      material must not exceed availableStock.
 *
 * Call this after CreateMaterialAllocationSchema.parse() succeeds and after
 * querying the current alreadyAllocated figure from the database, before
 * writing to the database.
 *
 * @param allocatedQty      The quantity requested by the new allocation.
 * @param availableStock    Total on-hand stock for this material.
 * @param alreadyAllocated  Sum of all existing allocations for this material
 *                          across all active batches.
 */
export function validateMaterialAllocation(
  allocatedQty: number,
  availableStock: number,
  alreadyAllocated: number,
): PPValidationResult {
  const errors: string[] = []

  // Rule 1: Quantity must be strictly positive.
  if (allocatedQty <= 0) {
    errors.push('allocatedQty must be greater than 0')
  }

  // Rule 2: Total allocation (existing + new) must not exceed available stock.
  if (allocatedQty + alreadyAllocated > availableStock) {
    errors.push(
      `Insufficient stock: allocatedQty (${allocatedQty}) + alreadyAllocated (${alreadyAllocated}) = ${allocatedQty + alreadyAllocated} exceeds availableStock (${availableStock})`,
    )
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
