/**
 * Workflow Engine
 *
 * Responsible for:
 *  - Executing a workflow end-to-end given trigger data
 *  - Evaluating conditions (with else-branch support)
 *  - Dispatching actions (TRANSFER_STOCK, CREATE_ORDER, SEND_NOTIFICATION, LOG_EVENT)
 *  - Persisting WorkflowExecution records with full result payloads
 *  - Providing triggerWorkflows() for integration with existing APIs
 */

import { prisma } from '@/lib/db/prisma'
import type { WorkflowConditionOperator, WorkflowActionType } from '@/lib/types-production'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type StepResult =
  | { type: 'condition'; field: string; operator: string; value: string; result: boolean }
  | { type: 'action'; actionType: WorkflowActionType; config: unknown; outcome: string }

// Shape of a hydrated step returned from Prisma include (used before client regen)
type HydratedStep = {
  id: string
  workflowId: string
  order: number
  type: string
  elseStepOrder: number | null
  condition: {
    id: string
    stepId: string
    field: string
    operator: WorkflowConditionOperator
    value: string
    createdAt: Date
  } | null
  action: {
    id: string
    stepId: string
    type: WorkflowActionType
    config: unknown
    createdAt: Date
  } | null
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/**
 * Resolves a dot-separated field path from an object.
 * e.g. "stock.quantity" on { stock: { quantity: 5 } } returns 5.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function evaluateCondition(
  field: string,
  operator: WorkflowConditionOperator,
  conditionValue: string,
  triggerData: Record<string, unknown>,
): boolean {
  const raw = resolvePath(triggerData, field)
  const actual = raw !== undefined && raw !== null ? String(raw) : ''

  switch (operator) {
    case 'EQUALS':
      return actual === conditionValue
    case 'GREATER_THAN':
      return parseFloat(actual) > parseFloat(conditionValue)
    case 'LESS_THAN':
      return parseFloat(actual) < parseFloat(conditionValue)
    case 'CONTAINS':
      return actual.includes(conditionValue)
    case 'STARTS_WITH':
      return actual.startsWith(conditionValue)
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Action execution
// ---------------------------------------------------------------------------

async function executeAction(
  actionType: WorkflowActionType,
  config: Record<string, unknown>,
  triggerData: Record<string, unknown>,
): Promise<string> {
  switch (actionType) {
    case 'TRANSFER_STOCK': {
      const { sourceLab, destLab, material, quantity } = config as {
        sourceLab: string
        destLab: string
        material: string
        quantity: number
      }

      if (!sourceLab || !destLab || !material || quantity === undefined) {
        throw new Error('TRANSFER_STOCK requires sourceLab, destLab, material, quantity')
      }

      await prisma.$transaction(async (tx) => {
        // Decrement source
        await tx.labStock.updateMany({
          where: { labId: sourceLab, materialId: material },
          data: { quantity: { decrement: quantity } },
        })
        // Increment destination (upsert to handle first-time transfer)
        const existing = await tx.labStock.findUnique({
          where: { labId_materialId: { labId: destLab, materialId: material } },
        })
        if (existing) {
          await tx.labStock.update({
            where: { labId_materialId: { labId: destLab, materialId: material } },
            data: { quantity: { increment: quantity } },
          })
        } else {
          await tx.labStock.create({
            data: {
              labId: destLab,
              materialId: material,
              quantity,
              minThreshold: 0,
            },
          })
        }
      })

      return `Transferred ${quantity} units of material ${material} from lab ${sourceLab} to lab ${destLab}`
    }

    case 'CREATE_ORDER': {
      const { supplier, material, quantity, expectedDelivery } = config as {
        supplier: string
        material: string
        quantity: number
        expectedDelivery?: string
      }

      // Mock implementation: log the order details
      // In production, this would create a PurchaseOrder record or call a procurement service
      const orderRef = `PO-${Date.now()}`
      console.info(
        `[WorkflowEngine] CREATE_ORDER — ref=${orderRef} supplier=${supplier} material=${material} qty=${quantity} delivery=${expectedDelivery ?? 'TBD'}`,
      )

      return `Purchase order ${orderRef} created for ${quantity} units of material ${material} from supplier ${supplier}`
    }

    case 'SEND_NOTIFICATION': {
      const { channel, recipient, message } = config as {
        channel: 'email' | 'webhook'
        recipient: string
        message: string
      }

      const resolvedMessage = message.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const val = resolvePath(triggerData as Record<string, unknown>, path)
        return val !== undefined && val !== null ? String(val) : `{{${path}}}`
      })

      if (channel === 'email') {
        // Mock: log email dispatch; swap for a real mailer (Resend, Nodemailer, etc.)
        console.info(`[WorkflowEngine] SEND_EMAIL → ${recipient}: ${resolvedMessage}`)
      } else if (channel === 'webhook') {
        // Mock: log webhook; swap for fetch() call in production
        console.info(`[WorkflowEngine] WEBHOOK → ${recipient}: ${resolvedMessage}`)
      }

      return `Notification sent via ${channel} to ${recipient}`
    }

    case 'LOG_EVENT': {
      const { description } = config as { description: string }
      const resolvedDescription = (description ?? '').replace(
        /\{\{(\w+(?:\.\w+)*)\}\}/g,
        (_, path) => {
          const val = resolvePath(triggerData as Record<string, unknown>, path)
          return val !== undefined && val !== null ? String(val) : `{{${path}}}`
        },
      )
      console.info(`[WorkflowEngine] LOG_EVENT: ${resolvedDescription}`)
      return `Event logged: ${resolvedDescription}`
    }

    default:
      throw new Error(`Unknown action type: ${actionType}`)
  }
}

// ---------------------------------------------------------------------------
// Core executor
// ---------------------------------------------------------------------------

/**
 * Executes a single workflow given its ID and the data that triggered it.
 * Returns the WorkflowExecution record (updated with final status + results).
 */
export async function executeWorkflow(
  workflowId: string,
  triggerData: Record<string, unknown>,
) {
  // Fetch workflow with all steps and their condition/action children
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
        include: {
          condition: true,
          action: true,
        },
      },
    },
  })

  if (!workflow) {
    throw new Error(`Workflow '${workflowId}' not found`)
  }

  // Create an execution record in "running" state
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      status: 'running',
      triggerData,
    },
  })

  const stepResults: StepResult[] = []
  let currentOrder = 1
  let failed = false
  let errorMessage: string | undefined

  try {
    // Build an order → step lookup for efficient else-branch jumping
    const hydratedSteps = workflow.steps as unknown as HydratedStep[]
    const stepByOrder = new Map(hydratedSteps.map((s) => [s.order, s]))
    const maxOrder = hydratedSteps.length > 0 ? Math.max(...hydratedSteps.map((s) => s.order)) : 0

    while (currentOrder <= maxOrder) {
      const step = stepByOrder.get(currentOrder)

      if (!step) {
        // Gap in step ordering — advance
        currentOrder++
        continue
      }

      if (step.type === 'condition') {
        if (!step.condition) {
          throw new Error(`Step ${step.order} is type 'condition' but has no condition record`)
        }

        const passed = evaluateCondition(
          step.condition.field,
          step.condition.operator,
          step.condition.value,
          triggerData,
        )

        stepResults.push({
          type: 'condition',
          field: step.condition.field,
          operator: step.condition.operator,
          value: step.condition.value,
          result: passed,
        })

        if (!passed && step.elseStepOrder !== null && step.elseStepOrder !== undefined) {
          // Jump to the else branch
          currentOrder = step.elseStepOrder
          continue
        } else if (!passed) {
          // No else branch defined — stop execution
          break
        }
      } else if (step.type === 'action') {
        if (!step.action) {
          throw new Error(`Step ${step.order} is type 'action' but has no action record`)
        }

        const outcome = await executeAction(
          step.action.type,
          step.action.config as Record<string, unknown>,
          triggerData,
        )

        stepResults.push({
          type: 'action',
          actionType: step.action.type,
          config: step.action.config,
          outcome,
        })
      }

      currentOrder++
    }
  } catch (err) {
    failed = true
    errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[WorkflowEngine] Execution ${execution.id} failed:`, err)
  }

  // Persist final state
  const now = new Date()
  const updatedExecution = await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: failed ? 'failed' : 'completed',
      errorMessage: errorMessage ?? null,
      results: { steps: stepResults },
      completedAt: now,
    },
  })

  // Update workflow metadata: increment counter, record last run time
  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      executionCount: { increment: 1 },
      lastExecuted: now,
    },
  })

  return updatedExecution
}

// ---------------------------------------------------------------------------
// Trigger dispatcher
// ---------------------------------------------------------------------------

/**
 * Finds all enabled workflows matching the given trigger type and executes them.
 * Executions run sequentially to avoid overwhelming the DB connection pool.
 *
 * For SCHEDULED workflows the cron expression in triggerConfig.cronExpression
 * is matched externally (e.g. by a cron job); this function simply executes
 * any workflow that has already been selected by the scheduler.
 */
export async function triggerWorkflows(
  triggerType:
    | 'BATCH_CREATED'
    | 'BATCH_COMPLETED'
    | 'LOW_STOCK'
    | 'SCHEDULED'
    | 'MANUAL',
  data: Record<string, unknown>,
): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    where: { enabled: true, triggerType },
  })

  for (const wf of workflows) {
    try {
      await executeWorkflow(wf.id, data)
    } catch (err) {
      // One failure must not block subsequent workflows
      console.error(`[WorkflowEngine] Failed to execute workflow '${wf.id}':`, err)
    }
  }
}
