import { z } from 'zod'

// ============================================================================
// ENUM VALIDATORS
// ============================================================================

/**
 * Zod validator for the WorkflowTriggerType enum.
 *
 * Values sourced directly from prisma/schema.prisma (Phase 3 Task 1):
 *   enum WorkflowTriggerType { MANUAL, SCHEDULED, EVENT_BASED }
 *
 * MANUAL      – explicit admin invocation (Phase 3 default)
 * SCHEDULED   – cron-based execution (Phase 4+)
 * EVENT_BASED – triggered by a system event, e.g. low stock (Phase 4+)
 */
export const WorkflowTriggerTypeSchema = z.enum([
  'MANUAL',
  'SCHEDULED',
  'EVENT_BASED',
])

/**
 * Zod validator for the WorkflowStepType enum.
 *
 * Values sourced directly from prisma/schema.prisma (Phase 3 Task 1):
 *   enum WorkflowStepType { ACTION, CONDITION }
 *
 * ACTION    – executes a side-effect (transfer, notify, email, …)
 * CONDITION – evaluates WorkflowConditions and branches
 */
export const WorkflowStepTypeSchema = z.enum(['ACTION', 'CONDITION'])

/**
 * Zod validator for the WorkflowConditionOperator enum.
 *
 * Values sourced directly from prisma/schema.prisma (Phase 3 Task 1):
 *   enum WorkflowConditionOperator { EQUALS, GREATER_THAN, LESS_THAN, CONTAINS }
 */
export const WorkflowConditionOperatorSchema = z.enum([
  'EQUALS',
  'GREATER_THAN',
  'LESS_THAN',
  'CONTAINS',
])

/**
 * Zod validator for the WorkflowActionStatus enum.
 *
 * Values sourced directly from prisma/schema.prisma (Phase 3 Task 1):
 *   enum WorkflowActionStatus { PENDING, IN_PROGRESS, COMPLETED, FAILED }
 *
 * Represents the lifecycle of a WorkflowAction execution record.
 */
export const WorkflowActionStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
])

/**
 * Zod validator for action template types (not execution status).
 *
 * These are the concrete handler identifiers stored in WorkflowStep.actionType.
 * Defined here as a Zod enum for exhaustive validation in CreateWorkflowStepSchema
 * and for documentation purposes. Corresponds to actionType on the WorkflowStep
 * model — the DB stores this as plain TEXT so new handlers can be added without
 * a migration.
 *
 * TRANSFER          – move stock between labs
 * UPDATE_INVENTORY  – adjust stock quantity for a material
 * NOTIFY            – send an in-app or webhook notification
 * EMAIL             – send an email via the nodemailer transport
 */
export const WorkflowActionTypeSchema = z.enum([
  'TRANSFER',
  'UPDATE_INVENTORY',
  'NOTIFY',
  'EMAIL',
])

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/workflows.
 *
 * Creates a new top-level Workflow record. Steps are managed separately via
 * WorkflowStep endpoints. The createdBy field is populated server-side from
 * the authenticated session and is therefore NOT part of this input schema.
 *
 * @example Valid — all fields:
 *   { name: 'Restock Alert', description: 'Triggers when stock is low', isActive: true, triggerType: 'EVENT_BASED' }
 *
 * @example Valid — minimal (name only):
 *   { name: 'Daily Report' }
 *   // isActive defaults to true, triggerType defaults to 'MANUAL'
 *
 * @example Invalid — name too long:
 *   { name: 'x'.repeat(201) }  // max 200 chars
 *
 * @example Invalid — name is blank:
 *   { name: '   ' }  // fails .trim().min(1)
 *
 * @example Invalid — description too long:
 *   { name: 'Test', description: 'x'.repeat(501) }  // max 500 chars
 *
 * @example Invalid — unknown triggerType:
 *   { name: 'Test', triggerType: 'ON_DEMAND' }  // not in enum
 */
export const CreateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(200, 'Workflow name must not exceed 200 characters')
    .describe('Human-readable name for this automation workflow'),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .describe('Optional description of what this workflow does'),
  isActive: z
    .boolean()
    .default(true)
    .describe('Whether this workflow is available for execution'),
  triggerType: WorkflowTriggerTypeSchema.default('MANUAL').describe(
    'How this workflow is triggered: MANUAL, SCHEDULED, or EVENT_BASED',
  ),
})

export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>

/**
 * Input schema for PATCH /api/admin/workflows/[id].
 *
 * All fields are optional — only provided fields are updated (partial update).
 * Defined separately rather than using .partial() on CreateWorkflowSchema
 * because CreateWorkflowSchema uses .default() which interacts with .partial()
 * in ways that produce unexpected TypeScript types.
 *
 * @example Valid — toggle active flag only:
 *   { isActive: false }
 *
 * @example Valid — rename and change trigger:
 *   { name: 'Daily Digest', triggerType: 'SCHEDULED' }
 *
 * @example Invalid — empty name string:
 *   { name: '' }  // min(1) still enforced when the field is present
 */
export const UpdateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(200, 'Workflow name must not exceed 200 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  isActive: z.boolean().optional(),
  triggerType: WorkflowTriggerTypeSchema.optional(),
})

export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>

/**
 * Query parameter schema for GET /api/admin/workflows.
 *
 * All filters are optional. Pagination uses page/limit semantics (page is
 * 0-based) rather than offset/limit to align with the workflow service layer.
 *
 * @example Defaults when no query params:
 *   {}  =>  { page: 0, limit: 50 }
 *
 * @example Filter active workflows, page 2:
 *   { isActive: true, page: 2, limit: 25 }
 *
 * @example Invalid — limit above maximum:
 *   { limit: 101 }  // max is 100
 *
 * @example Invalid — negative page:
 *   { page: -1 }  // must be non-negative
 */
export const WorkflowFiltersSchema = z.object({
  isActive: z
    .boolean()
    .optional()
    .describe('Filter to only active or only inactive workflows'),
  triggerType: WorkflowTriggerTypeSchema.optional().describe(
    'Filter by trigger mechanism',
  ),
  createdBy: z
    .string()
    .optional()
    .describe('Filter by creator user ID (plain text, no FK)'),
  page: z
    .number()
    .int('Page must be an integer')
    .nonnegative('Page must be non-negative')
    .default(0)
    .describe('0-based page index'),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Maximum page size is 100')
    .default(50)
    .describe('Number of records per page (1–100)'),
})

export type WorkflowFilters = z.infer<typeof WorkflowFiltersSchema>

// ============================================================================
// WORKFLOW STEP SCHEMAS
// ============================================================================

/**
 * Flexible payload schemas for each supported action handler.
 *
 * These are used internally to document the expected shape of
 * WorkflowStep.actionPayload for each actionType. At the API boundary the
 * entire actionPayload is accepted as a generic JSON object; detailed
 * payload-level validation happens in the workflow execution service.
 *
 * Exported so that the service layer can re-use them for pre-execution checks.
 */

/** Payload for actionType = 'TRANSFER'. */
export const TransferPayloadSchema = z.object({
  sourceLabId: z.string().cuid('sourceLabId must be a valid CUID'),
  destLabId: z.string().cuid('destLabId must be a valid CUID'),
  materialId: z.string().cuid('materialId must be a valid CUID'),
  quantity: z.number().positive('Transfer quantity must be positive'),
})

/** Payload for actionType = 'UPDATE_INVENTORY'. */
export const UpdateInventoryPayloadSchema = z.object({
  labId: z.string().cuid('labId must be a valid CUID'),
  materialId: z.string().cuid('materialId must be a valid CUID'),
  quantity: z
    .number()
    .finite('Quantity must be a finite number')
    .describe('Adjustment delta — positive to add, negative to subtract'),
  reason: z.string().min(1, 'Reason is required'),
})

/** Payload for actionType = 'NOTIFY'. */
export const NotifyPayloadSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(500, 'Message must not exceed 500 characters'),
  channels: z
    .array(z.string().min(1))
    .min(1, 'At least one notification channel is required'),
})

/** Payload for actionType = 'EMAIL'. */
export const EmailPayloadSchema = z.object({
  to: z.string().email('to must be a valid email address'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must not exceed 200 characters'),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(2000, 'Body must not exceed 2000 characters'),
})

/**
 * Union schema that validates the actionPayload recursively based on actionType.
 *
 * Uses a discriminated approach: given an actionType, the schema selects the
 * corresponding payload validator. When actionType is not one of the four
 * known handlers (e.g. a custom extension), the payload is accepted as a
 * generic record (z.record(z.unknown())) without deep validation.
 *
 * Called from CreateWorkflowStepSchema's .superRefine when type === 'ACTION'.
 *
 * @example Valid TRANSFER step payload:
 *   {
 *     actionType: 'TRANSFER',
 *     actionPayload: {
 *       sourceLabId: 'clh3v2y0k0000356pk1b6vxxt',
 *       destLabId:   'clh3v2y0k0001356pk1b6vxxt',
 *       materialId:  'clh3v2y0k0002356pk1b6vxxt',
 *       quantity: 50,
 *     }
 *   }
 */
export const WorkflowStepPayloadSchema = z.discriminatedUnion('actionType', [
  z.object({
    actionType: z.literal('TRANSFER'),
    actionPayload: TransferPayloadSchema,
  }),
  z.object({
    actionType: z.literal('UPDATE_INVENTORY'),
    actionPayload: UpdateInventoryPayloadSchema,
  }),
  z.object({
    actionType: z.literal('NOTIFY'),
    actionPayload: NotifyPayloadSchema,
  }),
  z.object({
    actionType: z.literal('EMAIL'),
    actionPayload: EmailPayloadSchema,
  }),
])

export type WorkflowStepPayload = z.infer<typeof WorkflowStepPayloadSchema>

/**
 * Input schema for POST /api/admin/workflows/[id]/steps.
 *
 * Creates one ordered execution node within a workflow. For ACTION steps both
 * actionType and actionPayload are required. For CONDITION steps both must be
 * absent (conditions are attached via WorkflowCondition endpoints).
 *
 * The cross-field requirement (ACTION ↔ actionType+actionPayload) is enforced
 * by .superRefine so that error messages are field-specific.
 *
 * @example Valid — ACTION step with TRANSFER payload:
 *   {
 *     workflowId: 'clh3v2y0k0000356pk1b6vxxt',
 *     stepNumber: 1,
 *     type: 'ACTION',
 *     actionType: 'TRANSFER',
 *     actionPayload: { sourceLabId: '...', destLabId: '...', materialId: '...', quantity: 100 },
 *   }
 *
 * @example Valid — CONDITION step (no actionType/actionPayload):
 *   {
 *     workflowId: 'clh3v2y0k0000356pk1b6vxxt',
 *     stepNumber: 1,
 *     type: 'CONDITION',
 *   }
 *
 * @example Invalid — ACTION step missing actionType:
 *   { workflowId: '...', stepNumber: 1, type: 'ACTION', actionPayload: { ... } }
 *   // superRefine adds issue at path ["actionType"]
 *
 * @example Invalid — ACTION step missing actionPayload:
 *   { workflowId: '...', stepNumber: 1, type: 'ACTION', actionType: 'EMAIL' }
 *   // superRefine adds issue at path ["actionPayload"]
 */
export const CreateWorkflowStepSchema = z
  .object({
    workflowId: z
      .string()
      .cuid('workflowId must be a valid CUID')
      .describe('Parent workflow this step belongs to'),
    stepNumber: z
      .number()
      .int('Step number must be a whole number')
      .positive('Step number must be a positive integer')
      .describe('1-based execution order; unique per workflow'),
    type: WorkflowStepTypeSchema.describe(
      'ACTION executes a side-effect; CONDITION evaluates guards',
    ),
    actionType: z
      .string()
      .min(1, 'Action type must not be blank')
      .optional()
      .describe(
        'Concrete handler identifier, e.g. TRANSFER, EMAIL. Required when type=ACTION.',
      ),
    actionPayload: z
      .record(z.unknown())
      .optional()
      .describe(
        'JSON config for the action handler. Required when type=ACTION.',
      ),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'ACTION') {
      if (data.actionType === undefined || data.actionType === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'actionType is required for steps of type ACTION',
          path: ['actionType'],
        })
      }
      if (data.actionPayload === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'actionPayload is required for steps of type ACTION',
          path: ['actionPayload'],
        })
      }
    }
    if (data.type === 'CONDITION') {
      if (data.actionType !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'actionType must not be set on CONDITION steps',
          path: ['actionType'],
        })
      }
      if (data.actionPayload !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'actionPayload must not be set on CONDITION steps',
          path: ['actionPayload'],
        })
      }
    }
  })

export type CreateWorkflowStep = z.infer<typeof CreateWorkflowStepSchema>

/**
 * Input schema for PATCH /api/admin/workflows/steps/[id].
 *
 * All fields are optional — only provided fields are updated.
 * Cross-field rules (ACTION requires actionType + actionPayload) are NOT
 * enforced here: a partial update may legitimately set actionType without
 * touching actionPayload. Service-layer logic handles cross-field consistency
 * after merging the patch with the persisted record.
 *
 * @example Valid — update stepNumber only:
 *   { stepNumber: 3 }
 *
 * @example Valid — change action type and payload together:
 *   { actionType: 'EMAIL', actionPayload: { to: '...', subject: '...', body: '...' } }
 */
export const UpdateWorkflowStepSchema = z.object({
  workflowId: z.string().cuid('workflowId must be a valid CUID').optional(),
  stepNumber: z
    .number()
    .int('Step number must be a whole number')
    .positive('Step number must be a positive integer')
    .optional(),
  type: WorkflowStepTypeSchema.optional(),
  actionType: z
    .string()
    .min(1, 'Action type must not be blank')
    .optional(),
  actionPayload: z.record(z.unknown()).optional(),
})

export type UpdateWorkflowStep = z.infer<typeof UpdateWorkflowStepSchema>

// ============================================================================
// WORKFLOW CONDITION SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/workflows/steps/[id]/conditions.
 *
 * Creates a boolean guard on a CONDITION step. Multiple conditions on the same
 * step are OR'd at runtime; conditions across steps are AND'd.
 *
 * @example Valid — EQUALS operator:
 *   { stepId: 'clh3v2y0k...', field: 'labStock.quantity', operator: 'EQUALS', value: '0' }
 *
 * @example Valid — all four operators accepted:
 *   operator: 'EQUALS'       — exact match
 *   operator: 'GREATER_THAN' — numeric greater-than
 *   operator: 'LESS_THAN'    — numeric less-than
 *   operator: 'CONTAINS'     — substring check
 *
 * @example Invalid — operator not in enum:
 *   { ..., operator: 'STARTS_WITH' }  // not a known operator
 *
 * @example Invalid — empty field path:
 *   { stepId: '...', field: '', operator: 'EQUALS', value: '10' }
 */
export const CreateWorkflowConditionSchema = z.object({
  stepId: z
    .string()
    .cuid('stepId must be a valid CUID')
    .describe('The CONDITION step this guard is attached to'),
  field: z
    .string()
    .min(1, 'Field path is required')
    .max(100, 'Field path must not exceed 100 characters')
    .describe(
      'Dot-separated path into the trigger data, e.g. "labStock.quantity"',
    ),
  operator: WorkflowConditionOperatorSchema.describe(
    'Comparison operator applied between field value and the rhs value',
  ),
  value: z
    .string()
    .min(1, 'Condition value is required')
    .max(500, 'Condition value must not exceed 500 characters')
    .describe('Right-hand side value of the comparison; stored as string, parsed at runtime'),
})

export type CreateWorkflowCondition = z.infer<
  typeof CreateWorkflowConditionSchema
>

/**
 * Input schema for PATCH /api/admin/workflows/conditions/[id].
 *
 * All fields are optional — only provided fields are updated.
 *
 * @example Valid — change operator and value together:
 *   { operator: 'GREATER_THAN', value: '100' }
 *
 * @example Invalid — empty value string when provided:
 *   { value: '' }  // min(1) still enforced
 */
export const UpdateWorkflowConditionSchema = z.object({
  stepId: z.string().cuid('stepId must be a valid CUID').optional(),
  field: z
    .string()
    .min(1, 'Field path is required')
    .max(100, 'Field path must not exceed 100 characters')
    .optional(),
  operator: WorkflowConditionOperatorSchema.optional(),
  value: z
    .string()
    .min(1, 'Condition value is required')
    .max(500, 'Condition value must not exceed 500 characters')
    .optional(),
})

export type UpdateWorkflowCondition = z.infer<
  typeof UpdateWorkflowConditionSchema
>

// ============================================================================
// WORKFLOW ACTION (EXECUTION RECORD) SCHEMAS
// ============================================================================

/**
 * Input schema for POST /api/admin/workflows/actions.
 *
 * Creates an execution history record (audit row) for one step run. This is
 * written by the workflow engine at the start of each step execution, then
 * updated via UpdateWorkflowActionSchema as the step progresses.
 *
 * @example Valid — minimal (status defaults to PENDING):
 *   {
 *     workflowId: 'clh3v2y0k0000356pk1b6vxxt',
 *     stepId:     'clh3v2y0k0001356pk1b6vxxt',
 *   }
 *
 * @example Valid — explicit IN_PROGRESS on creation:
 *   { workflowId: '...', stepId: '...', status: 'IN_PROGRESS' }
 *
 * @example Invalid — unknown status:
 *   { workflowId: '...', stepId: '...', status: 'RUNNING' }  // not in enum
 */
export const CreateWorkflowActionSchema = z.object({
  workflowId: z
    .string()
    .cuid('workflowId must be a valid CUID')
    .describe('Denormalised workflowId for efficient per-workflow history queries'),
  stepId: z
    .string()
    .cuid('stepId must be a valid CUID')
    .describe('The step whose execution this record tracks'),
  status: WorkflowActionStatusSchema.default('PENDING').describe(
    'Initial lifecycle status; typically PENDING on creation',
  ),
})

export type CreateWorkflowAction = z.infer<typeof CreateWorkflowActionSchema>

/**
 * Input schema for PATCH /api/admin/workflows/actions/[id].
 *
 * Used by the workflow engine to advance an action record through its
 * lifecycle (PENDING → IN_PROGRESS → COMPLETED | FAILED) and to attach
 * execution results or error details.
 *
 * @example Valid — PENDING → IN_PROGRESS transition:
 *   { status: 'IN_PROGRESS' }
 *
 * @example Valid — mark COMPLETED with result payload:
 *   {
 *     status: 'COMPLETED',
 *     executedAt: '2026-04-19T10:30:00.000Z',
 *     result: { transferredQuantity: 100, sourceStock: 50, destStock: 250 },
 *   }
 *
 * @example Valid — mark FAILED with error message:
 *   {
 *     status: 'FAILED',
 *     executedAt: '2026-04-19T10:30:05.000Z',
 *     errorMessage: 'Insufficient stock in source lab',
 *   }
 *
 * @example Invalid — executedAt is not a valid ISO date string:
 *   { executedAt: 'not-a-date' }
 *
 * @example Invalid — unknown status value:
 *   { status: 'CANCELLED' }  // not in WorkflowActionStatus enum
 */
export const UpdateWorkflowActionSchema = z.object({
  status: WorkflowActionStatusSchema.optional().describe(
    'New lifecycle status for this execution record',
  ),
  executedAt: z
    .string()
    .datetime({ message: 'executedAt must be a valid ISO 8601 date string' })
    .optional()
    .describe('Timestamp when the action reached COMPLETED or FAILED'),
  result: z
    .record(z.unknown())
    .optional()
    .describe(
      'Flexible JSON result payload, e.g. { transferredQuantity: 100 }',
    ),
  errorMessage: z
    .string()
    .optional()
    .describe('Human-readable error description when status = FAILED'),
})

export type UpdateWorkflowAction = z.infer<typeof UpdateWorkflowActionSchema>
