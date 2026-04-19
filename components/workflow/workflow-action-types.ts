// ---------------------------------------------------------------------------
// Shared types for workflow action display components
// ---------------------------------------------------------------------------

export type ActionStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PENDING'
export type ActionType = 'TRANSFER' | 'UPDATE_INVENTORY' | 'NOTIFY' | 'EMAIL'

export interface WorkflowActionResponse {
  id: string
  workflowExecutionId: string
  stepId: string
  status: ActionStatus
  result: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  executedAt: string | null
}

export interface WorkflowStep {
  id: string
  workflowId: string
  stepNumber: number
  type: 'ACTION' | 'CONDITION'
  actionType?: ActionType | null
  actionPayload?: Record<string, unknown> | null
  conditions?: Array<{
    id: string
    field: string
    operator: string
    value: string
  }>
  createdAt: string
  updatedAt: string
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'
  steps?: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Result shape helpers (typed views of result field per action type)
// ---------------------------------------------------------------------------

export interface TransferResult {
  transferredQuantity: number
  sourceStock: number
  destStock: number
}

export interface InventoryResult {
  newQuantity: number
  oldQuantity: number
  reason: string
}

export interface NotifyResult {
  notifiedChannels: string[]
  timestamp: string
}

export interface EmailResult {
  to: string
  subject: string
  sentAt: string
  messageId: string
}
