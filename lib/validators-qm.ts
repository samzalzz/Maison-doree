import { z } from 'zod'
import { InspectionType, InspectionStatus } from '@prisma/client'

// ============================================================================
// REUSABLE ENUM VALIDATORS
// ============================================================================

/**
 * Zod validator for the InspectionType enum.
 * Mirrors: enum InspectionType { INCOMING, IN_PROCESS, FINAL }
 */
export const InspectionTypeSchema = z.enum([
  InspectionType.INCOMING,
  InspectionType.IN_PROCESS,
  InspectionType.FINAL,
])

/**
 * Zod validator for the InspectionStatus enum.
 * Mirrors: enum InspectionStatus { PLANNED, IN_PROGRESS, PASSED, FAILED, CONDITIONAL }
 */
export const InspectionStatusSchema = z.enum([
  InspectionStatus.PLANNED,
  InspectionStatus.IN_PROGRESS,
  InspectionStatus.PASSED,
  InspectionStatus.FAILED,
  InspectionStatus.CONDITIONAL,
])

// ============================================================================
// QUALITY INSPECTION SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/quality/inspections.
 *
 * Field semantics (cross-field business rules are enforced separately via
 * validateInspectionContext; Zod only handles structural validity here so
 * that error messages are always field-specific):
 *   - batchId   required for IN_PROCESS and FINAL inspections
 *   - supplierId required for INCOMING inspections
 */
export const CreateQualityInspectionSchema = z.object({
  inspectionType: InspectionTypeSchema.describe('INCOMING, IN_PROCESS, or FINAL'),
  materialId: z.string().cuid('Invalid material ID'),
  batchId: z
    .string()
    .cuid('Invalid batch ID')
    .optional()
    .describe('Required for IN_PROCESS and FINAL inspections'),
  supplierId: z
    .string()
    .cuid('Invalid supplier ID')
    .optional()
    .describe('Required for INCOMING inspections'),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  scheduledDate: z.coerce.date().describe('When the inspection is scheduled'),
})

export type CreateQualityInspectionInput = z.infer<typeof CreateQualityInspectionSchema>

/**
 * Input schema for PATCH /api/admin/quality/inspections/[id].
 * All fields are optional — only the provided fields are updated.
 * Use validateInspectionTransition before applying a status change.
 */
export const UpdateQualityInspectionSchema = z.object({
  inspectionStatus: InspectionStatusSchema.optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  completedDate: z.coerce.date().optional(),
})

export type UpdateQualityInspectionInput = z.infer<typeof UpdateQualityInspectionSchema>

/**
 * Query parameter schema for GET /api/admin/quality/inspections.
 * All filters are optional; pagination defaults apply.
 */
export const QualityInspectionFiltersSchema = z.object({
  inspectionType: InspectionTypeSchema.optional(),
  inspectionStatus: InspectionStatusSchema.optional(),
  materialId: z.string().cuid().optional(),
  batchId: z.string().cuid().optional(),
  supplierId: z.string().cuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z
    .number()
    .int()
    .positive()
    .max(100, 'Maximum page size is 100')
    .default(50),
  offset: z
    .number()
    .int()
    .nonnegative('Offset cannot be negative')
    .default(0),
})

export type QualityInspectionFiltersInput = z.infer<typeof QualityInspectionFiltersSchema>

// ============================================================================
// INSPECTION CHECKPOINT SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/quality/inspections/[id]/checkpoints.
 * checkpointName maps to the `checkName` column in InspectionCheckpoint.
 */
export const CreateInspectionCheckpointSchema = z.object({
  inspectionId: z.string().cuid('Invalid inspection ID'),
  checkpointName: z
    .string()
    .min(1, 'Checkpoint name is required')
    .max(100, 'Checkpoint name must not exceed 100 characters')
    .describe('e.g. "Appearance Check", "Weight Verification"'),
  passed: z.boolean(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
})

export type CreateInspectionCheckpointInput = z.infer<typeof CreateInspectionCheckpointSchema>

/**
 * Input schema for PATCH /api/admin/quality/inspections/checkpoints/[id].
 */
export const UpdateInspectionCheckpointSchema = z.object({
  passed: z.boolean().optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
})

export type UpdateInspectionCheckpointInput = z.infer<typeof UpdateInspectionCheckpointSchema>

// ============================================================================
// BUSINESS LOGIC VALIDATORS
// ============================================================================

/**
 * State-machine rules for inspection status transitions.
 *
 * Allowed forward transitions:
 *   PLANNED      → IN_PROGRESS
 *   IN_PROGRESS  → PASSED | FAILED | CONDITIONAL
 *
 * All other combinations (including backwards transitions and self-loops) are
 * rejected.
 */
const VALID_TRANSITIONS: Partial<
  Record<InspectionStatus, ReadonlyArray<InspectionStatus>>
> = {
  [InspectionStatus.PLANNED]: [InspectionStatus.IN_PROGRESS],
  [InspectionStatus.IN_PROGRESS]: [
    InspectionStatus.PASSED,
    InspectionStatus.FAILED,
    InspectionStatus.CONDITIONAL,
  ],
}

/**
 * Returns true when transitioning from `currentStatus` to `newStatus` is
 * permitted by the QM state machine.
 *
 * Terminal statuses (PASSED, FAILED, CONDITIONAL) have no allowed next states;
 * the function returns false for any transition away from them.
 */
export function validateInspectionTransition(
  currentStatus: InspectionStatus,
  newStatus: InspectionStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed) {
    return false
  }
  return (allowed as ReadonlyArray<InspectionStatus>).includes(newStatus)
}

// Return type for validateInspectionContext, re-used in tests and API routes.
export type InspectionContextResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] }

/**
 * Validates that the supplied IDs are consistent with the inspection type.
 *
 * Rules:
 *   INCOMING   requires materialId + supplierId; batchId must be absent.
 *   IN_PROCESS requires materialId + batchId;   supplierId must be absent.
 *   FINAL      requires materialId + batchId;   supplierId must be absent.
 *
 * materialId is always required and its presence is assumed (enforced upstream
 * by CreateQualityInspectionSchema).
 */
export function validateInspectionContext(
  inspectionType: InspectionType,
  materialId: string,
  batchId?: string,
  supplierId?: string,
): InspectionContextResult {
  const errors: string[] = []

  if (!materialId || materialId.trim() === '') {
    errors.push('materialId is required for all inspection types')
  }

  switch (inspectionType) {
    case InspectionType.INCOMING: {
      if (!supplierId) {
        errors.push('supplierId is required for INCOMING inspections')
      }
      if (batchId) {
        errors.push('batchId must not be provided for INCOMING inspections')
      }
      break
    }

    case InspectionType.IN_PROCESS:
    case InspectionType.FINAL: {
      if (!batchId) {
        errors.push(
          `batchId is required for ${inspectionType} inspections`,
        )
      }
      if (supplierId) {
        errors.push(
          `supplierId must not be provided for ${inspectionType} inspections`,
        )
      }
      break
    }

    default: {
      // Exhaustiveness guard — TypeScript will warn if a new enum value is
      // added to InspectionType without updating this switch.
      const _exhaustive: never = inspectionType
      errors.push(`Unknown inspection type: ${_exhaustive}`)
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
