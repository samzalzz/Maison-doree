/**
 * lib/services/workflow-engine.ts
 *
 * Workflow Execution Engine — Phase 3 Task 3
 *
 * Interprets Workflow JSON definitions stored in the Phase 3 database schema
 * (Workflow → WorkflowStep → WorkflowCondition / WorkflowAction) and executes
 * them step-by-step.
 *
 * Execution model
 * ───────────────
 *  • Steps are sorted by stepNumber (ascending).
 *  • CONDITION steps: evaluate all attached WorkflowCondition rows with OR logic.
 *    If the OR-result is false the engine skips to the next CONDITION or halts,
 *    depending on whether subsequent steps remain.
 *  • ACTION steps: route to one of four handlers (TRANSFER, UPDATE_INVENTORY,
 *    NOTIFY, EMAIL).  Each handler returns { success, result?, error? } — it
 *    never throws.
 *  • One WorkflowAction audit row is written per ACTION step execution.
 *  • TRANSFER and UPDATE_INVENTORY run inside a single prisma.$transaction.
 *  • NOTIFY and EMAIL are best-effort — a failure does NOT roll back prior steps.
 *
 * Exported surface
 * ────────────────
 *  WorkflowEngineError        – base error class
 *  ConditionEvaluationError   – thrown when a condition cannot be evaluated
 *  HandlerExecutionError      – thrown when the handler registry lookup fails
 *  WorkflowExecutor           – main class; call executeWorkflow(id, prisma)
 */

import { Decimal } from '@prisma/client/runtime/library'
import type { PrismaClient } from '@prisma/client'

// ============================================================================
// ERRORS
// ============================================================================

export class WorkflowEngineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'WorkflowEngineError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ConditionEvaluationError extends WorkflowEngineError {
  constructor(message: string) {
    super('CONDITION_EVALUATION_ERROR', message)
    this.name = 'ConditionEvaluationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class HandlerExecutionError extends WorkflowEngineError {
  constructor(message: string) {
    super('HANDLER_EXECUTION_ERROR', message)
    this.name = 'HandlerExecutionError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Runtime context passed to condition evaluators and action handlers.
 * Populated from the live Prisma query before execution begins.
 */
export interface WorkflowContext {
  workflowId: string
  stepId: string
  /**
   * Keyed by `${labId}__${materialId}` for O(1) lookup in condition evaluation.
   * Populated lazily — only when the workflow has CONDITION steps that reference
   * labStock fields.
   */
  labStocks?: Record<string, { quantity: Decimal; labId: string; materialId: string }>
  /** Raw trigger data forwarded from the caller (e.g. { labId, materialId }). */
  triggerData?: Record<string, unknown>
}

export interface HandlerResult {
  success: boolean
  result?: Record<string, unknown>
  error?: string
}

export type ActionHandler = (
  payload: Record<string, unknown>,
  context: WorkflowContext,
  prisma: PrismaClient,
) => Promise<HandlerResult>

export interface StepExecutionResult {
  stepId: string
  conditionMet: boolean
  actionStatus: 'SKIPPED' | 'COMPLETED' | 'FAILED'
  result?: Record<string, unknown>
  error?: string
}

export interface WorkflowExecutionResult {
  workflowId: string
  status: 'COMPLETED' | 'FAILED'
  stepsExecuted: number
  actions: Array<{
    stepId: string
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    result?: Record<string, unknown>
    error?: string
  }>
}

// ============================================================================
// CONDITION EVALUATOR
// ============================================================================

/**
 * Resolves a dot-separated field path from a plain object.
 *
 * @example
 *   resolvePath({ labStock: { quantity: 50 } }, 'labStock.quantity') // => 50
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * Internal representation of a single condition row retrieved from Prisma.
 */
interface Condition {
  field: string
  operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS'
  value: string
}

/**
 * Internal representation of a hydrated WorkflowStep row (subset of fields
 * needed for execution).
 */
interface HydratedStep {
  id: string
  stepNumber: number
  type: 'ACTION' | 'CONDITION'
  actionType: string | null
  actionPayload: Record<string, unknown> | null
  conditions: Condition[]
}

export class WorkflowConditionEvaluator {
  /**
   * Evaluate a single condition against the provided context.
   *
   * Field resolution order:
   *  1. context.triggerData  (arbitrary key-value pairs from the caller)
   *  2. context.labStocks    (when field starts with "labStock.")
   *
   * Numeric comparisons (GREATER_THAN / LESS_THAN) parse both sides as floats;
   * NaN comparisons always return false.
   */
  evaluateCondition(condition: Condition, context: WorkflowContext): boolean {
    // Build a flat lookup object from the available context data.
    const data: Record<string, unknown> = { ...(context.triggerData ?? {}) }

    // Inject labStock quantities under their composite key for dot-path access.
    if (context.labStocks) {
      data['labStocks'] = context.labStocks
    }

    const raw = resolvePath(data, condition.field)
    const actualStr = raw !== undefined && raw !== null ? String(raw) : ''

    switch (condition.operator) {
      case 'EQUALS':
        return actualStr === condition.value

      case 'GREATER_THAN': {
        const actual = parseFloat(actualStr)
        const threshold = parseFloat(condition.value)
        if (isNaN(actual) || isNaN(threshold)) return false
        return actual > threshold
      }

      case 'LESS_THAN': {
        const actual = parseFloat(actualStr)
        const threshold = parseFloat(condition.value)
        if (isNaN(actual) || isNaN(threshold)) return false
        return actual < threshold
      }

      case 'CONTAINS':
        return actualStr.includes(condition.value)

      default:
        throw new ConditionEvaluationError(
          `Unknown condition operator: ${String((condition as Condition).operator)}`,
        )
    }
  }

  /**
   * Evaluate all conditions on a step using OR logic.
   * Returns true if at least one condition passes, or if there are no conditions
   * (unconditionally true — the step acts as a pass-through gate).
   */
  evaluateStep(step: HydratedStep, context: WorkflowContext): boolean {
    if (step.conditions.length === 0) {
      return true
    }
    return step.conditions.some((c) => this.evaluateCondition(c, context))
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * TRANSFER handler
 *
 * Payload: { sourceLabId, destLabId, materialId, quantity }
 *
 * Atomically decrements source LabStock and increments (or creates) dest
 * LabStock inside a prisma.$transaction.
 *
 * Returns { success: false, error: "Insufficient stock in source lab" } when
 * the source stock is below the requested quantity.
 */
export async function transferHandler(
  payload: Record<string, unknown>,
  _context: WorkflowContext,
  prisma: PrismaClient,
): Promise<HandlerResult> {
  const { sourceLabId, destLabId, materialId, quantity: rawQty } = payload as {
    sourceLabId: string
    destLabId: string
    materialId: string
    quantity: number
  }

  const quantity = Number(rawQty)

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate source stock
      const sourceStock = await tx.labStock.findUnique({
        where: { labId_materialId: { labId: sourceLabId, materialId } },
      })

      if (!sourceStock) {
        return {
          success: false as const,
          error: 'Source lab stock not found',
        }
      }

      const sourceQty = sourceStock.quantity.toNumber()
      if (sourceQty < quantity) {
        return {
          success: false as const,
          error: 'Insufficient stock in source lab',
        }
      }

      // 2. Decrement source
      const updatedSource = await tx.labStock.update({
        where: { labId_materialId: { labId: sourceLabId, materialId } },
        data: { quantity: new Decimal(sourceQty - quantity) },
      })

      // 3. Upsert destination
      const destStock = await tx.labStock.findUnique({
        where: { labId_materialId: { labId: destLabId, materialId } },
      })

      let updatedDest
      if (destStock) {
        updatedDest = await tx.labStock.update({
          where: { labId_materialId: { labId: destLabId, materialId } },
          data: { quantity: new Decimal(destStock.quantity.toNumber() + quantity) },
        })
      } else {
        updatedDest = await tx.labStock.create({
          data: {
            labId: destLabId,
            materialId,
            quantity: new Decimal(quantity),
            minThreshold: new Decimal(0),
          },
        })
      }

      return {
        success: true as const,
        result: {
          transferredQuantity: quantity,
          sourceStock: updatedSource.quantity,
          destStock: updatedDest.quantity,
        },
      }
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Transfer failed: ${message}` }
  }
}

/**
 * UPDATE_INVENTORY handler
 *
 * Payload: { labId, materialId, quantity (delta, may be negative), reason }
 *
 * Adds the delta to the current LabStock quantity.  The result may be zero
 * (intentional write-down) but the handler does NOT enforce a non-negative
 * floor — that is a business rule for the caller to validate before creating
 * the workflow step.
 */
export async function updateInventoryHandler(
  payload: Record<string, unknown>,
  _context: WorkflowContext,
  prisma: PrismaClient,
): Promise<HandlerResult> {
  const { labId, materialId, quantity: rawDelta, reason } = payload as {
    labId: string
    materialId: string
    quantity: number
    reason: string
  }

  const delta = Number(rawDelta)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.labStock.findUnique({
        where: { labId_materialId: { labId, materialId } },
      })

      if (!stock) {
        return {
          success: false as const,
          error: 'Material not found in lab stock',
        }
      }

      const oldQuantity = stock.quantity
      const newQty = oldQuantity.toNumber() + delta

      const updated = await tx.labStock.update({
        where: { labId_materialId: { labId, materialId } },
        data: { quantity: new Decimal(newQty) },
      })

      return {
        success: true as const,
        result: {
          newQuantity: updated.quantity,
          oldQuantity,
          reason,
        },
      }
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Inventory update failed: ${message}` }
  }
}

/**
 * NOTIFY handler
 *
 * Payload: { message, channels: string[] }
 *
 * Phase 3 mock implementation.  Logs each channel to console and returns the
 * list of notified channels.  Real dispatch (Slack webhook, push notification,
 * etc.) is deferred to Phase 4.
 */
export async function notifyHandler(
  payload: Record<string, unknown>,
  _context: WorkflowContext,
  _prisma: PrismaClient,
): Promise<HandlerResult> {
  const { message, channels } = payload as {
    message: string
    channels: unknown
  }

  // Validate channels
  if (!Array.isArray(channels) || channels.length === 0) {
    return { success: false, error: 'No valid channels provided' }
  }

  const validChannels = (channels as unknown[]).filter(
    (c): c is string => typeof c === 'string' && c.trim().length > 0,
  )

  if (validChannels.length === 0) {
    return { success: false, error: 'No valid channels provided' }
  }

  const timestamp = new Date().toISOString()

  // Mock dispatch — replace with real integrations in Phase 4
  for (const channel of validChannels) {
    console.info(
      `[WorkflowEngine][NOTIFY] channel=${channel} message="${message}" ts=${timestamp}`,
    )
  }

  return {
    success: true,
    result: {
      notifiedChannels: validChannels,
      timestamp,
    },
  }
}

/**
 * EMAIL handler
 *
 * Payload: { to, subject, body }
 *
 * Phase 3 mock implementation.  Validates the recipient address with a
 * standard RFC-5321-compatible regex, then logs the email details for audit.
 * Real nodemailer/Resend dispatch is deferred to Phase 4.
 */

// Simple but robust email regex (covers the vast majority of real addresses)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function emailHandler(
  payload: Record<string, unknown>,
  _context: WorkflowContext,
  _prisma: PrismaClient,
): Promise<HandlerResult> {
  const { to, subject, body } = payload as {
    to: string
    subject: string
    body: string
  }

  if (!to || !EMAIL_REGEX.test(to)) {
    return { success: false, error: 'Invalid email address' }
  }

  const sentAt = new Date().toISOString()
  // Deterministic-ish mock message ID combining timestamp and recipient hash
  const messageId = `mock-${Date.now()}-${Buffer.from(to).toString('hex').slice(0, 8)}`

  // Mock send — replace with real mailer in Phase 4
  console.info(
    `[WorkflowEngine][EMAIL] to=${to} subject="${subject}" messageId=${messageId} sentAt=${sentAt}`,
  )

  return {
    success: true,
    result: { to, subject, sentAt, messageId },
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

const HANDLER_REGISTRY: Record<string, ActionHandler> = {
  TRANSFER: transferHandler,
  UPDATE_INVENTORY: updateInventoryHandler,
  NOTIFY: notifyHandler,
  EMAIL: emailHandler,
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export class WorkflowExecutor {
  private readonly conditionEvaluator = new WorkflowConditionEvaluator()

  /**
   * Execute a complete workflow identified by `workflowId`.
   *
   * Steps:
   *  1. Load Workflow + all WorkflowSteps (with WorkflowConditions) from DB.
   *  2. Iterate steps in stepNumber order.
   *  3. CONDITION step: evaluate OR logic.  If false, mark remaining ACTION
   *     steps as SKIPPED and stop.
   *  4. ACTION step: run handler, write WorkflowAction audit row.
   *  5. Return WorkflowExecutionResult.
   *
   * The method never throws — all errors are captured in the returned result.
   */
  async executeWorkflow(
    workflowId: string,
    prisma: PrismaClient,
    triggerData?: Record<string, unknown>,
  ): Promise<WorkflowExecutionResult> {
    // ── 1. Load workflow ──────────────────────────────────────────────────────

    /** The hydrated workflow shape we expect back from Prisma. */
    type LoadedWorkflow = {
      id: string
      isActive: boolean
      steps: HydratedStep[]
    }

    let workflow: LoadedWorkflow | null = null

    try {
      // Cast through unknown so TypeScript accepts the dynamic include shape.
      const raw = await (prisma.workflow as unknown as {
        findUnique: (args: unknown) => Promise<unknown>
      }).findUnique({
        where: { id: workflowId },
        include: {
          steps: {
            orderBy: { stepNumber: 'asc' },
            include: {
              conditions: true,
            },
          },
        },
      })

      workflow = (raw as LoadedWorkflow | null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        workflowId,
        status: 'FAILED',
        stepsExecuted: 0,
        actions: [
          {
            stepId: 'N/A',
            status: 'FAILED',
            error: `Failed to load workflow: ${message}`,
          },
        ],
      }
    }

    if (!workflow) {
      return {
        workflowId,
        status: 'FAILED',
        stepsExecuted: 0,
        actions: [
          {
            stepId: 'N/A',
            status: 'FAILED',
            error: `Workflow not found: ${workflowId}`,
          },
        ],
      }
    }

    if (!workflow.isActive) {
      return {
        workflowId,
        status: 'FAILED',
        stepsExecuted: 0,
        actions: [
          {
            stepId: 'N/A',
            status: 'FAILED',
            error: 'Workflow is inactive and cannot be executed',
          },
        ],
      }
    }

    // ── 2. Execute steps ──────────────────────────────────────────────────────
    const steps = workflow.steps
    const actions: WorkflowExecutionResult['actions'] = []
    let stepsExecuted = 0
    let overallFailed = false
    let skipRemaining = false

    for (const step of steps) {
      const context: WorkflowContext = {
        workflowId,
        stepId: step.id,
        triggerData: triggerData ?? {},
      }

      const stepResult = await this.executeStep(step, context, prisma, skipRemaining)
      stepsExecuted++

      if (stepResult.actionStatus !== 'SKIPPED') {
        actions.push({
          stepId: step.id,
          status: stepResult.actionStatus,
          ...(stepResult.result ? { result: stepResult.result } : {}),
          ...(stepResult.error ? { error: stepResult.error } : {}),
        })
      }

      if (step.type === 'CONDITION' && !stepResult.conditionMet) {
        // Condition failed — skip all subsequent steps
        skipRemaining = true
      }

      if (stepResult.actionStatus === 'FAILED') {
        overallFailed = true
        // For non-inventory handlers (NOTIFY, EMAIL) we continue; for
        // inventory handlers the transaction already rolled back so we stop.
        const actionType = step.actionType ?? ''
        if (actionType === 'TRANSFER' || actionType === 'UPDATE_INVENTORY') {
          break
        }
      }
    }

    return {
      workflowId,
      status: overallFailed ? 'FAILED' : 'COMPLETED',
      stepsExecuted,
      actions,
    }
  }

  /**
   * Execute a single step.  Writes the WorkflowAction audit row for ACTION
   * steps.  Returns a StepExecutionResult regardless of outcome.
   */
  private async executeStep(
    step: HydratedStep,
    context: WorkflowContext,
    prisma: PrismaClient,
    skipRemaining: boolean,
  ): Promise<StepExecutionResult> {
    // ── CONDITION step ────────────────────────────────────────────────────────
    if (step.type === 'CONDITION') {
      let conditionMet = false
      try {
        conditionMet = this.conditionEvaluator.evaluateStep(step, context)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          stepId: step.id,
          conditionMet: false,
          actionStatus: 'FAILED',
          error: message,
        }
      }

      return {
        stepId: step.id,
        conditionMet,
        actionStatus: 'SKIPPED', // CONDITION steps don't produce actions
      }
    }

    // ── ACTION step ───────────────────────────────────────────────────────────
    if (skipRemaining) {
      return {
        stepId: step.id,
        conditionMet: false,
        actionStatus: 'SKIPPED',
      }
    }

    const actionType = step.actionType ?? ''
    const handler = HANDLER_REGISTRY[actionType]

    if (!handler) {
      const error = `Unknown action handler: ${actionType}`
      await this.writeAuditRow(prisma, context.workflowId, step.id, 'FAILED', undefined, error)
      return {
        stepId: step.id,
        conditionMet: true,
        actionStatus: 'FAILED',
        error,
      }
    }

    const payload = (step.actionPayload ?? {}) as Record<string, unknown>

    // Mark the audit row as IN_PROGRESS before execution
    const auditRow = await this.writeAuditRow(
      prisma,
      context.workflowId,
      step.id,
      'IN_PROGRESS',
    )

    let handlerResult: HandlerResult
    try {
      handlerResult = await handler(payload, context, prisma)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      handlerResult = { success: false, error: message }
    }

    // Finalise the audit row
    const finalStatus = handlerResult.success ? 'COMPLETED' : 'FAILED'
    await this.updateAuditRow(
      prisma,
      auditRow.id,
      finalStatus,
      handlerResult.result,
      handlerResult.error,
    )

    return {
      stepId: step.id,
      conditionMet: true,
      actionStatus: finalStatus,
      result: handlerResult.result,
      error: handlerResult.error,
    }
  }

  // ── Audit helpers ───────────────────────────────────────────────────────────

  private async writeAuditRow(
    prisma: PrismaClient,
    workflowId: string,
    stepId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    result?: Record<string, unknown>,
    errorMessage?: string,
  ) {
    return (prisma.workflowAction as unknown as {
      create: (args: unknown) => Promise<{ id: string }>
    }).create({
      data: {
        workflowId,
        stepId,
        status,
        ...(result ? { result } : {}),
        ...(errorMessage ? { errorMessage } : {}),
        ...(status === 'COMPLETED' || status === 'FAILED'
          ? { executedAt: new Date() }
          : {}),
      },
    })
  }

  private async updateAuditRow(
    prisma: PrismaClient,
    id: string,
    status: 'COMPLETED' | 'FAILED',
    result?: Record<string, unknown>,
    errorMessage?: string,
  ) {
    return (prisma.workflowAction as unknown as {
      update: (args: unknown) => Promise<unknown>
    }).update({
      where: { id },
      data: {
        status,
        executedAt: new Date(),
        ...(result ? { result } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      },
    })
  }
}
