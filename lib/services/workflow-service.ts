/**
 * lib/services/workflow-service.ts
 *
 * Workflow Management CRUD service — Phase 3 Task 4
 *
 * Responsibilities:
 *  - Validate all inputs with schemas from lib/validators-workflow.ts before
 *    touching the database.
 *  - Enforce FK integrity (workflow → step → condition chain) before creating
 *    child records.
 *  - Enforce stepNumber uniqueness per workflow on both create and update.
 *  - Provide paginated list endpoints for workflows and execution action history.
 *  - Return fully hydrated response objects (steps include conditions, etc.)
 *
 * Error types thrown:
 *  - ValidationError  – malformed input, failed Zod parse, or FK/uniqueness conflict
 *  - NotFoundError    – the requested record does not exist
 *
 * Pagination semantics:
 *  - page is 0-based; offset = page × limit
 *  - Default: page=0, limit=50
 *  - Maximum limit: 100 (enforced by WorkflowFiltersSchema)
 *
 * Cascade behaviour:
 *  - Deleting a Workflow cascades to all WorkflowStep rows (DB onDelete: Cascade)
 *  - Deleting a WorkflowStep cascades to WorkflowCondition and WorkflowAction rows
 *  - Service methods do not need to manually delete children
 *
 * TypeScript note:
 *  The generated Prisma client predates the Phase 3 Task 1 migration — the
 *  generated types do not yet reflect the new Workflow schema (isActive vs.
 *  enabled, stepNumber, actionType, actionPayload, WorkflowAction audit fields,
 *  etc.). All Prisma calls are therefore cast through `unknown` following the
 *  same pattern used in workflow-engine.ts. Once `prisma generate` is re-run
 *  after the migration, the casts can be narrowed to the generated types.
 *
 * DB field notes:
 *  WorkflowStep.order mirrors stepNumber — both are written on create/update
 */

import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import {
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  WorkflowFiltersSchema,
  CreateWorkflowStepSchema,
  UpdateWorkflowStepSchema,
  CreateWorkflowConditionSchema,
  UpdateWorkflowConditionSchema,
  type UpdateWorkflow,
  type UpdateWorkflowStep,
  type UpdateWorkflowCondition,
} from '@/lib/validators-workflow'

// Use z.input<> for types that have .default() fields so callers are not
// forced to supply fields that have schema-level defaults (isActive, triggerType,
// page, limit). The defaults are applied inside safeParse before DB writes.
type CreateWorkflowInput     = z.input<typeof CreateWorkflowSchema>
type WorkflowFiltersInput    = z.input<typeof WorkflowFiltersSchema>
type CreateWorkflowStepInput = z.input<typeof CreateWorkflowStepSchema>

// These have no .default() fields so z.infer and z.input are equivalent;
// re-export as readable aliases for the method signatures below.
type CreateWorkflowCondition = z.infer<typeof CreateWorkflowConditionSchema>
type CreateWorkflowStep      = z.infer<typeof CreateWorkflowStepSchema>

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class WorkflowServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'WorkflowServiceError'
    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends WorkflowServiceError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends WorkflowServiceError {
  constructor(resourceType: string, id: string) {
    super(`${resourceType} not found: ${id}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface WorkflowConditionResponse {
  id: string
  stepId: string
  field: string
  operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS'
  value: string
  createdAt: Date
}

export interface WorkflowStepResponse {
  id: string
  workflowId: string
  stepNumber: number
  type: 'ACTION' | 'CONDITION'
  actionType?: string | null
  actionPayload?: Record<string, unknown> | null
  conditions?: WorkflowConditionResponse[]
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowResponse {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'
  steps: WorkflowStepResponse[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowActionResponse {
  id: string
  workflowId: string
  stepId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  executedAt?: Date | null
  result?: Record<string, unknown> | null
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TYPED PRISMA ACCESSOR HELPERS
//
// Cast through unknown to sidestep the stale generated-client types until
// `prisma generate` is re-run after the Phase 3 migration. This mirrors the
// pattern already established in lib/services/workflow-engine.ts.
// ============================================================================

type AnyFn = (...args: unknown[]) => Promise<unknown>

/** Returns a dynamically-typed delegate for prisma.workflow */
function wf() {
  return prisma.workflow as unknown as {
    create:     AnyFn
    findUnique: AnyFn
    findMany:   AnyFn
    count:      AnyFn
    update:     AnyFn
    delete:     AnyFn
  }
}

/** Returns a dynamically-typed delegate for prisma.workflowStep */
function wfStep() {
  return prisma.workflowStep as unknown as {
    create:     AnyFn
    findUnique: AnyFn
    findFirst:  AnyFn
    findMany:   AnyFn
    count:      AnyFn
    update:     AnyFn
    delete:     AnyFn
  }
}

/** Returns a dynamically-typed delegate for prisma.workflowCondition */
function wfCond() {
  return prisma.workflowCondition as unknown as {
    create:     AnyFn
    findUnique: AnyFn
    findMany:   AnyFn
    count:      AnyFn
    update:     AnyFn
    delete:     AnyFn
  }
}

/** Returns a dynamically-typed delegate for prisma.workflowAction */
function wfAction() {
  return prisma.workflowAction as unknown as {
    create:     AnyFn
    findUnique: AnyFn
    findMany:   AnyFn
    count:      AnyFn
    update:     AnyFn
    delete:     AnyFn
  }
}

// ============================================================================
// INTERNAL PRISMA INCLUDE CONSTANTS
// ============================================================================

/**
 * Always load conditions nested inside each step, ordered by id (creation order).
 * Steps are ordered by stepNumber ascending for consistent execution ordering.
 */
const WORKFLOW_WITH_STEPS = {
  steps: {
    orderBy: { stepNumber: 'asc' as const },
    include: {
      conditions: {
        orderBy: { id: 'asc' as const },
      },
    },
  },
}

const STEP_WITH_CONDITIONS = {
  conditions: {
    orderBy: { id: 'asc' as const },
  },
}

// ============================================================================
// WORKFLOW SERVICE CLASS
// ============================================================================

export class WorkflowService {
  // --------------------------------------------------------------------------
  // 1. WORKFLOW CRUD
  // --------------------------------------------------------------------------

  /**
   * Creates a new top-level Workflow record.
   *
   * Validation order:
   *  1. Schema validation (Zod — CreateWorkflowSchema)
   *  2. Database insert
   *
   * @param input - Workflow creation fields (name, description?, isActive?, triggerType?)
   * @param userId - Admin user ID stamped onto createdBy (plain text, no FK)
   */
  async createWorkflow(
    input: CreateWorkflowInput,
    userId: string,
  ): Promise<WorkflowResponse> {
    // --- Step 1: Schema validation ---
    const parseResult = CreateWorkflowSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow input', errors)
    }

    const validated = parseResult.data

    // --- Step 2: Persist ---
    const workflow = await wf().create({
      data: {
        name: validated.name,
        description: validated.description ?? null,
        isActive: validated.isActive,
        triggerType: validated.triggerType,
        createdBy: userId,
      },
      include: WORKFLOW_WITH_STEPS,
    })

    return workflow as WorkflowResponse
  }

  /**
   * Fetches a single Workflow by ID with its ordered steps and their conditions.
   *
   * @throws NotFoundError if the workflow does not exist
   */
  async getWorkflow(id: string): Promise<WorkflowResponse> {
    const workflow = await wf().findUnique({
      where: { id },
      include: WORKFLOW_WITH_STEPS,
    })

    if (!workflow) {
      throw new NotFoundError('Workflow', id)
    }

    return workflow as WorkflowResponse
  }

  /**
   * Lists Workflows with optional filters and offset-based pagination.
   *
   * Filters:
   *  - isActive: true | false
   *  - triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'
   *  - createdBy: user ID string (exact match)
   *  - page: 0-based page index (default 0)
   *  - limit: page size 1–100 (default 50)
   *
   * Offset is computed as page × limit.
   * Results are ordered by createdAt DESC (newest first).
   */
  async listWorkflows(
    filters: WorkflowFiltersInput,
  ): Promise<{ workflows: WorkflowResponse[]; total: number }> {
    // Apply defaults via schema parse
    const parseResult = WorkflowFiltersSchema.safeParse(filters)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid filter parameters', errors)
    }

    const { isActive, triggerType, createdBy, page, limit } = parseResult.data
    const offset = page * limit

    // Build dynamic where clause
    const where: Record<string, unknown> = {}

    if (isActive !== undefined) {
      where.isActive = isActive
    }
    if (triggerType !== undefined) {
      where.triggerType = triggerType
    }
    if (createdBy !== undefined) {
      where.createdBy = createdBy
    }

    // Run count and data fetch in parallel for efficiency
    const [total, workflows] = await Promise.all([
      wf().count({ where }),
      wf().findMany({
        where,
        include: WORKFLOW_WITH_STEPS,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ])

    return { workflows: workflows as WorkflowResponse[], total: total as number }
  }

  /**
   * Applies a partial update to a Workflow.
   *
   * Validation order:
   *  1. Existence check (NotFoundError if not found)
   *  2. Schema validation (UpdateWorkflowSchema)
   *  3. Update only provided fields
   *  4. Return updated workflow with related steps
   *
   * @throws NotFoundError if the workflow does not exist
   * @throws ValidationError if the input fails schema validation
   */
  async updateWorkflow(
    id: string,
    input: UpdateWorkflow,
    _userId: string,
  ): Promise<WorkflowResponse> {
    // --- Step 1: Existence check ---
    const existing = await wf().findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundError('Workflow', id)
    }

    // --- Step 2: Schema validation ---
    const parseResult = UpdateWorkflowSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow update input', errors)
    }

    const validated = parseResult.data

    // Build update payload — only include explicitly provided fields
    const updateData: Record<string, unknown> = {}
    if (validated.name !== undefined) {
      updateData.name = validated.name
    }
    if (validated.description !== undefined) {
      updateData.description = validated.description
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive
    }
    if (validated.triggerType !== undefined) {
      updateData.triggerType = validated.triggerType
    }

    // --- Step 3: Persist ---
    const updated = await wf().update({
      where: { id },
      data: updateData,
      include: WORKFLOW_WITH_STEPS,
    })

    return updated as WorkflowResponse
  }

  /**
   * Deletes a Workflow and all related steps, conditions, and action history.
   * Cascade is handled at the DB level (onDelete: Cascade on WorkflowStep
   * and WorkflowAction).
   *
   * @throws NotFoundError if the workflow does not exist
   */
  async deleteWorkflow(id: string): Promise<void> {
    const existing = await wf().findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundError('Workflow', id)
    }

    await wf().delete({ where: { id } })
  }

  // --------------------------------------------------------------------------
  // 2. WORKFLOW STEP CRUD
  // --------------------------------------------------------------------------

  /**
   * Creates a new WorkflowStep within an existing workflow.
   *
   * Validation order:
   *  1. Verify workflow exists (NotFoundError)
   *  2. Schema validation (CreateWorkflowStepSchema)
   *  3. stepNumber uniqueness check within the workflow (ValidationError)
   *  4. Database insert — writes both stepNumber and order fields
   *  5. Return step with its conditions (empty array on creation)
   *
   * @throws NotFoundError if the parent workflow does not exist
   * @throws ValidationError on schema failure or duplicate stepNumber
   */
  async createWorkflowStep(
    input: CreateWorkflowStepInput,
  ): Promise<WorkflowStepResponse> {
    // --- Step 1: Verify workflow exists ---
    const workflow = await wf().findUnique({
      where: { id: input.workflowId },
      select: { id: true },
    })
    if (!workflow) {
      throw new NotFoundError('Workflow', input.workflowId)
    }

    // --- Step 2: Schema validation ---
    const parseResult = CreateWorkflowStepSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow step input', errors)
    }

    const validated = parseResult.data

    // --- Step 3: Uniqueness check — stepNumber must be unique per workflow ---
    const duplicate = await wfStep().findFirst({
      where: {
        workflowId: validated.workflowId,
        stepNumber: validated.stepNumber,
      },
      select: { id: true },
    })
    if (duplicate) {
      throw new ValidationError('Duplicate step number', [
        `stepNumber ${validated.stepNumber} already exists in workflow ${validated.workflowId}`,
      ])
    }

    // --- Step 4: Persist ---
    const step = await wfStep().create({
      data: {
        workflowId: validated.workflowId,
        stepNumber: validated.stepNumber,
        // order mirrors stepNumber for API ergonomics (as per DB schema comment)
        order: validated.stepNumber,
        type: validated.type,
        actionType: validated.actionType ?? null,
        actionPayload: validated.actionPayload ?? null,
      },
      include: STEP_WITH_CONDITIONS,
    })

    return step as WorkflowStepResponse
  }

  /**
   * Applies a partial update to a WorkflowStep.
   *
   * If stepNumber is being changed, uniqueness within the parent workflow is
   * re-validated (excluding the current step from the duplicate check).
   *
   * @throws NotFoundError if the step does not exist
   * @throws ValidationError on schema failure or duplicate stepNumber
   */
  async updateWorkflowStep(
    id: string,
    input: UpdateWorkflowStep,
  ): Promise<WorkflowStepResponse> {
    // --- Existence check ---
    const existing = await wfStep().findUnique({
      where: { id },
      select: { id: true, workflowId: true, stepNumber: true },
    })
    if (!existing) {
      throw new NotFoundError('WorkflowStep', id)
    }

    const existingRecord = existing as {
      id: string
      workflowId: string
      stepNumber: number
    }

    // --- Schema validation ---
    const parseResult = UpdateWorkflowStepSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow step update input', errors)
    }

    const validated = parseResult.data

    // --- Uniqueness check when stepNumber is changing ---
    if (
      validated.stepNumber !== undefined &&
      validated.stepNumber !== existingRecord.stepNumber
    ) {
      const targetWorkflowId = validated.workflowId ?? existingRecord.workflowId
      const duplicate = await wfStep().findFirst({
        where: {
          workflowId: targetWorkflowId,
          stepNumber: validated.stepNumber,
          // Exclude the current step from the uniqueness check
          NOT: { id },
        },
        select: { id: true },
      })
      if (duplicate) {
        throw new ValidationError('Duplicate step number', [
          `stepNumber ${validated.stepNumber} already exists in workflow ${targetWorkflowId}`,
        ])
      }
    }

    // Build update payload — only include defined fields
    const updateData: Record<string, unknown> = {}
    if (validated.workflowId !== undefined) {
      updateData.workflowId = validated.workflowId
    }
    if (validated.stepNumber !== undefined) {
      updateData.stepNumber = validated.stepNumber
      // Keep order in sync with stepNumber
      updateData.order = validated.stepNumber
    }
    if (validated.type !== undefined) {
      updateData.type = validated.type
    }
    if (validated.actionType !== undefined) {
      updateData.actionType = validated.actionType
    }
    if (validated.actionPayload !== undefined) {
      updateData.actionPayload = validated.actionPayload
    }

    const updated = await wfStep().update({
      where: { id },
      data: updateData,
      include: STEP_WITH_CONDITIONS,
    })

    return updated as WorkflowStepResponse
  }

  /**
   * Deletes a WorkflowStep and its related conditions and action history.
   * Cascade is handled at the DB level (onDelete: Cascade on WorkflowCondition
   * and WorkflowAction).
   *
   * @throws NotFoundError if the step does not exist
   */
  async deleteWorkflowStep(id: string): Promise<void> {
    const existing = await wfStep().findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundError('WorkflowStep', id)
    }

    await wfStep().delete({ where: { id } })
  }

  // --------------------------------------------------------------------------
  // 3. WORKFLOW CONDITION CRUD
  // --------------------------------------------------------------------------

  /**
   * Creates a WorkflowCondition attached to an existing CONDITION step.
   *
   * Validation order:
   *  1. Verify the parent step exists (NotFoundError)
   *  2. Schema validation (CreateWorkflowConditionSchema)
   *  3. Database insert
   *
   * @throws NotFoundError if the parent step does not exist
   * @throws ValidationError on schema failure
   */
  async createWorkflowCondition(
    input: CreateWorkflowCondition,
  ): Promise<WorkflowConditionResponse> {
    // --- Step 1: Verify step exists ---
    const step = await wfStep().findUnique({
      where: { id: input.stepId },
      select: { id: true },
    })
    if (!step) {
      throw new NotFoundError('WorkflowStep', input.stepId)
    }

    // --- Step 2: Schema validation ---
    const parseResult = CreateWorkflowConditionSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow condition input', errors)
    }

    const validated = parseResult.data

    // --- Step 3: Persist ---
    const condition = await wfCond().create({
      data: {
        stepId: validated.stepId,
        field: validated.field,
        operator: validated.operator,
        value: validated.value,
      },
    })

    return condition as WorkflowConditionResponse
  }

  /**
   * Applies a partial update to a WorkflowCondition.
   *
   * @throws NotFoundError if the condition does not exist
   * @throws ValidationError on schema failure
   */
  async updateWorkflowCondition(
    id: string,
    input: UpdateWorkflowCondition,
  ): Promise<WorkflowConditionResponse> {
    // --- Existence check ---
    const existing = await wfCond().findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundError('WorkflowCondition', id)
    }

    // --- Schema validation ---
    const parseResult = UpdateWorkflowConditionSchema.safeParse(input)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      )
      throw new ValidationError('Invalid workflow condition update input', errors)
    }

    const validated = parseResult.data

    // Build update payload — only include defined fields
    const updateData: Record<string, unknown> = {}
    if (validated.stepId !== undefined) {
      updateData.stepId = validated.stepId
    }
    if (validated.field !== undefined) {
      updateData.field = validated.field
    }
    if (validated.operator !== undefined) {
      updateData.operator = validated.operator
    }
    if (validated.value !== undefined) {
      updateData.value = validated.value
    }

    const updated = await wfCond().update({
      where: { id },
      data: updateData,
    })

    return updated as WorkflowConditionResponse
  }

  /**
   * Deletes a WorkflowCondition.
   *
   * @throws NotFoundError if the condition does not exist
   */
  async deleteWorkflowCondition(id: string): Promise<void> {
    const existing = await wfCond().findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundError('WorkflowCondition', id)
    }

    await wfCond().delete({ where: { id } })
  }

  // --------------------------------------------------------------------------
  // 4. WORKFLOW ACTION (EXECUTION HISTORY) — READ-ONLY
  // --------------------------------------------------------------------------

  /**
   * Lists WorkflowAction execution history records for a workflow.
   *
   * Filters:
   *  - status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
   *  - page: 0-based page index (default 0)
   *  - limit: page size (default 50)
   *
   * Results are ordered by createdAt DESC (most recent first).
   * The workflow must exist (NotFoundError thrown otherwise).
   *
   * @throws NotFoundError if the workflow does not exist
   */
  async listWorkflowActions(
    workflowId: string,
    filters: {
      status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
      page?: number
      limit?: number
    } = {},
  ): Promise<{ actions: WorkflowActionResponse[]; total: number }> {
    // Verify parent workflow exists
    const workflow = await wf().findUnique({
      where: { id: workflowId },
      select: { id: true },
    })
    if (!workflow) {
      throw new NotFoundError('Workflow', workflowId)
    }

    const page = filters.page ?? 0
    const limit = filters.limit ?? 50
    const offset = page * limit

    // Build dynamic where clause
    const where: Record<string, unknown> = { workflowId }
    if (filters.status !== undefined) {
      where.status = filters.status
    }

    const [total, actions] = await Promise.all([
      wfAction().count({ where }),
      wfAction().findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ])

    return { actions: actions as WorkflowActionResponse[], total: total as number }
  }

  /**
   * Fetches a single WorkflowAction record by its ID.
   *
   * @throws NotFoundError if the action record does not exist
   */
  async getWorkflowAction(id: string): Promise<WorkflowActionResponse> {
    const action = await wfAction().findUnique({
      where: { id },
    })

    if (!action) {
      throw new NotFoundError('WorkflowAction', id)
    }

    return action as WorkflowActionResponse
  }
}

// ============================================================================
// DEFAULT EXPORT — singleton instance
// ============================================================================

export const workflowService = new WorkflowService()
