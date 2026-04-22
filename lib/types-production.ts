import type { Decimal } from "@prisma/client/runtime/library";

// ============================================================================
// ENUMS
// Mirror the Prisma enums so consuming code can import from this module
// without depending directly on the generated Prisma client.
// ============================================================================

export enum LabType {
  PREPARATION = "PREPARATION",
  ASSEMBLY = "ASSEMBLY",
  FINISHING = "FINISHING",
}

export enum ProductionStatus {
  PLANNED = "PLANNED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  PAUSED = "PAUSED",
  CANCELLED = "CANCELLED",
}

export enum BatchItemStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export enum StockType {
  RAW_MATERIAL = "RAW_MATERIAL",
  MID_PROCESS = "MID_PROCESS",
  FINISHED_PRODUCT = "FINISHED_PRODUCT",
}

// ============================================================================
// CORE ENTITY TYPES
// Field names and nullability are derived directly from prisma/schema.prisma.
// ============================================================================

// 1. ProductionLab
export type ProductionLab = {
  id: string;
  name: string;
  type: LabType;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
};

// 2. LabEmployee
// Note: no createdAt in the Prisma model — intentionally omitted.
export type LabEmployee = {
  id: string;
  labId: string;
  name: string;
  role: string;
  availableHours: number;
};

// 3. Machine
export type Machine = {
  id: string;
  labId: string;
  name: string;
  type: string;
  batchCapacity: number;
  cycleTimeMinutes: number;
  available: boolean;
  createdAt: Date;
};

// 4. Recipe
export type Recipe = {
  id: string;
  name: string;
  description?: string;
  laborMinutes: number;
  createdAt: Date;
  updatedAt: Date;
};

// 5. RecipeIngredient
// quantity uses Prisma's Decimal type (Decimal(10,2) in the schema).
// Exactly one of rawMaterialId / intermediateProductId is set per row.
export type RecipeIngredient = {
  id: string;
  recipeId: string;
  rawMaterialId?: string;
  intermediateProductId?: string;
  quantity: Decimal;
  unit: string;
};

// 6. RawMaterial
// Note: no createdAt field in the Prisma model — intentionally omitted.
// productionRecipeId is present only when isIntermediate is true.
export type RawMaterial = {
  id: string;
  name: string;
  type: string;
  isIntermediate: boolean;
  unit: string;
  productionRecipeId?: string;
};

// 7. LabStock
// Prisma exposes updatedAt (via @updatedAt); aliased here as lastUpdated
// stockType categorizes: RAW_MATERIAL, MID_PROCESS, FINISHED_PRODUCT
// originBatchId tracks where the stock came from (for traceability)
export type LabStock = {
  id: string;
  labId: string;
  materialId: string;
  stockType: StockType;
  quantity: Decimal;
  minThreshold: Decimal;
  originBatchId?: string;
  lastUpdated: Date;
};

// 8. ProductionBatch
// estimatedCompletionTime is nullable in the Prisma schema (DateTime?).
export type ProductionBatch = {
  id: string;
  batchNumber: string;
  labId: string;
  recipeId: string;
  machineId?: string;
  employeeId?: string;
  quantity: number;
  status: ProductionStatus;
  plannedStartTime: Date;
  actualStartTime?: Date;
  estimatedCompletionTime?: Date;
  actualCompletionTime?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

// 9. BatchItem
// status is stored as a plain String in Prisma; we enforce the literal union here.
export type BatchItem = {
  id: string;
  batchId: string;
  description: string;
  quantity: number;
  status: BatchItemStatus;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// EXTENDED TYPES FOR API RESPONSES
// ============================================================================

// 10. LabWithRelations — used by GET /api/admin/labs/[id]
export type LabWithRelations = ProductionLab & {
  employees: LabEmployee[];
  machines: Machine[];
  stock: LabStock[];
  batches: ProductionBatch[];
};

// 11. RecipeWithIngredients — used by GET /api/admin/recipes/[id]
export type RecipeWithIngredients = Recipe & {
  ingredients: RecipeIngredient[];
};

// 12. BatchWithItems — used by GET /api/admin/production/batches/[id]
export type BatchWithItems = ProductionBatch & {
  items: BatchItem[];
};

// 13. LabCapacity — used by GET /api/admin/production/lab-capacity
export type LabCapacity = {
  labId: string;
  labName: string;
  currentBatches: number;
  maxCapacity: number;
  utilizationPercent: number;
};

// 10. DailyForecast — persisted demand forecast per recipe per day
export type DailyForecast = {
  id: string;
  date: Date;
  recipeId: string;
  recipe?: { id: string; name: string };
  predictedQuantity: number;
  confidence: number; // 0-100
  reasoning?: string;
  sevenDayAverage?: number;
  fourteenDayAverage?: number;
  thirtyDayAverage?: number;
  createdAt: Date;
  updatedAt: Date;
};

// 11. ForecastResponse — the shape returned by GET /api/admin/production/forecast
export type ForecastResponse = {
  date: Date;
  recipeId: string;
  recipe: { id: string; name: string };
  predictedQuantity: number;
  confidence: number;
  reasoning?: string;
  sevenDayAverage?: number;
  fourteenDayAverage?: number;
  thirtyDayAverage?: number;
};

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export type WorkflowTriggerType =
  | 'BATCH_CREATED'
  | 'BATCH_COMPLETED'
  | 'LOW_STOCK'
  | 'SCHEDULED'
  | 'MANUAL'

export type WorkflowActionType =
  | 'TRANSFER_STOCK'
  | 'CREATE_ORDER'
  | 'SEND_NOTIFICATION'
  | 'LOG_EVENT'

export type WorkflowConditionOperator =
  | 'EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS'
  | 'STARTS_WITH'

export type WorkflowCondition = {
  id: string
  stepId: string
  field: string
  operator: WorkflowConditionOperator
  value: string
  createdAt: Date
}

export type WorkflowAction = {
  id: string
  stepId: string
  type: WorkflowActionType
  config: Record<string, unknown>
  createdAt: Date
}

export type WorkflowStep = {
  id: string
  workflowId: string
  order: number
  type: 'condition' | 'action'
  condition?: WorkflowCondition
  action?: WorkflowAction
  elseStepOrder?: number | null
  createdAt: Date
  updatedAt: Date
}

export type Workflow = {
  id: string
  name: string
  description?: string | null
  enabled: boolean
  triggerType: WorkflowTriggerType
  triggerConfig: Record<string, unknown>
  createdBy: string
  lastExecuted?: Date | null
  executionCount: number
  createdAt: Date
  updatedAt: Date
}

export type WorkflowWithSteps = Workflow & {
  steps: WorkflowStep[]
}

export type WorkflowExecution = {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  errorMessage?: string | null
  triggerData: Record<string, unknown>
  results?: Record<string, unknown> | null
  startedAt: Date
  completedAt?: Date | null
}

// Shapes used in the visual canvas editor
export type CanvasNodeType = 'START' | 'CONDITION' | 'ACTION' | 'END'

export type CanvasNode = {
  id: string
  type: CanvasNodeType
  label: string
  x: number
  y: number
  stepOrder?: number
  conditionConfig?: {
    field: string
    operator: WorkflowConditionOperator
    value: string
  }
  actionConfig?: {
    type: WorkflowActionType
    config: Record<string, unknown>
  }
  elseStepOrder?: number
}

export type CanvasEdge = {
  id: string
  fromNodeId: string
  toNodeId: string
  label?: string // e.g. "true" | "false" | "else"
}

// ============================================================================
// RECIPE WORKFLOW TYPES
// ============================================================================

export type RecipeWorkflowStepType = 'material_check' | 'machine_operation' | 'output'

export type MaterialCheckStep = {
  type: 'material_check'
  materialIds: string[]
  operator: 'all_available'
}

export type MachineOperationStep = {
  type: 'machine_operation'
  machineId: string
  labId: string
  durationMinutes: number
  outputMaterialId?: string | null
}

export type OutputStep = {
  type: 'output'
  materialId: string
  quantity: number
}

export type RecipeWorkflowStep = MaterialCheckStep | MachineOperationStep | OutputStep

export type RecipeWorkflow = {
  id: string
  recipeId: string
  steps: RecipeWorkflowStep[]
  labId?: string | null
  createdAt: Date
  updatedAt: Date
}

export type RecipeWorkflowResponse = {
  id: string
  recipeId: string
  labId: string | null
  steps: RecipeWorkflowStep[]
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// PHASE 4: ADVANCED FEATURE TYPES
// ============================================================================

// P4-1. TransferSuggestion
export type TransferSuggestionStatus = 'pending' | 'executed' | 'dismissed'

export type TransferSuggestion = {
  id: string
  sourceLabId: string
  destLabId: string
  materialId: string
  suggestedQuantity: Decimal
  reasoning: string
  status: TransferSuggestionStatus
  executedAt?: Date | null
  createdAt: Date
  expiresAt: Date
}

export type TransferSuggestionWithRelations = TransferSuggestion & {
  sourceLab: { id: string; name: string }
  destLab: { id: string; name: string }
  material: { id: string; name: string; unit: string }
}

// P4-2. Supplier
export type Supplier = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  leadTimeDays: number
  categories: string[]
  createdAt: Date
}

// P4-3. PurchaseOrder
export type PurchaseOrderStatus = 'pending' | 'ordered' | 'delivered' | 'cancelled'

export type PurchaseOrder = {
  id: string
  poNumber: string
  supplierId: string
  materialId: string
  quantity: Decimal
  deliveryDate: Date
  status: PurchaseOrderStatus
  cost?: Decimal | null
  createdAt: Date
  deliveredAt?: Date | null
}

export type PurchaseOrderWithRelations = PurchaseOrder & {
  supplier: { id: string; name: string }
  material: { id: string; name: string; unit: string }
}

// P4-4. ML Forecast (mirrors MlForecastResult from lib/ml-forecaster.ts)
export type MlForecastResponse = {
  recipeId: string
  recipe: { id: string; name: string }
  predictions: number[]
  confidence: number
  model: string
}

// ============================================================================
// ERROR / RESPONSE TYPES
// ============================================================================

// 14. ApiResponse<T> — standard envelope for all API responses
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

// 15. PaginatedResponse<T> — envelope for paginated list endpoints
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    skip: number;
    take: number;
    total: number;
    hasMore: boolean;
  };
};

// 16. BatchValidationError — returned when a batch preflight check fails
export type BatchValidationError = {
  code:
    | "INSUFFICIENT_MATERIALS"
    | "NO_CAPACITY"
    | "MACHINE_UNAVAILABLE"
    | "EMPLOYEE_UNAVAILABLE";
  message: string;
  shortages?: Array<{
    materialId: string;
    required: number;
    available: number;
  }>;
  suggestions?: string[];
};

// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

// Stock Management Page
export type LabStockSummary = {
  totalMaterials: number;
  lowStockCount: number;
};

export type LabCount = {
  employees: number;
  machines: number;
  batches: number;
};

/**
 * Complete Lab with all relations for lab management pages
 */
export type LabWithCount = ProductionLab & {
  stockSummary: LabStockSummary;
  _count: LabCount;
};

/**
 * Lab with stock entries for stock management page
 */
export type LabWithStock = {
  lab: ProductionLab;
  stock: (LabStock & {
    material: RawMaterial;
  })[];
  lowStockCount: number;
};

// Form Data Types
export type LabFormData = {
  name: string;
  type: LabType | '';
  capacity: string;
};

// Component Prop Types
export type LabFormModalProps = {
  initial?: LabWithCount | null;
  onClose: () => void;
  onSaved: () => void;
};

export type DeleteConfirmModalProps = {
  lab: LabWithCount;
  onClose: () => void;
  onConfirmed: () => void;
};

export type StockAdjustModalProps = {
  labId: string;
  labName: string;
  stock: LabStock & { material: RawMaterial };
  onClose: () => void;
  onSaved: () => void;
};

export type LabStockSectionProps = {
  labWithStock: LabWithStock;
  onRefresh: () => void;
  onAdjustStock: (stock: LabStock & { material: RawMaterial }) => void;
  onAddStock?: (labId: string, labName: string) => void;
};
