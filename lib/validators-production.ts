import { z } from "zod";

// ============================================================================
// REUSABLE VALIDATORS
// ============================================================================

const unitValidator = z.string().min(1).max(20);

const BATCH_STATUS_VALUES = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;

// ============================================================================
// LAB SCHEMAS
// ============================================================================

export const CreateLabSchema = z.object({
  name: z
    .string()
    .min(1, "Lab name is required")
    .max(100, "Lab name must not exceed 100 characters"),
  type: z
    .enum(["PREPARATION", "ASSEMBLY", "FINISHING"])
    .describe("The functional type of the lab"),
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .positive("Capacity must be a positive integer")
    .describe("Maximum number of concurrent production tasks"),
});

export type CreateLabInput = z.infer<typeof CreateLabSchema>;

export const UpdateLabSchema = z.object({
  name: z
    .string()
    .min(1, "Lab name is required")
    .max(100, "Lab name must not exceed 100 characters")
    .optional(),
  capacity: z
    .number()
    .int("Capacity must be a whole number")
    .positive("Capacity must be a positive integer")
    .optional(),
});

export type UpdateLabInput = z.infer<typeof UpdateLabSchema>;

// ============================================================================
// EMPLOYEE SCHEMAS
// ============================================================================

export const CreateEmployeeSchema = z.object({
  labId: z
    .string()
    .cuid("labId must be a valid CUID")
    .describe("The lab this employee is assigned to"),
  name: z
    .string()
    .min(1, "Employee name is required")
    .max(100, "Employee name must not exceed 100 characters"),
  role: z
    .string()
    .min(1, "Role is required")
    .max(100, "Role must not exceed 100 characters")
    .describe("Job title or role within the lab"),
  availableHours: z
    .number()
    .int()
    .min(0, "Available hours cannot be negative")
    .max(168, "Available hours cannot exceed 168 per week")
    .describe("Available working hours per week (0–168)"),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

// ============================================================================
// MACHINE SCHEMAS
// ============================================================================

export const CreateMachineSchema = z.object({
  labId: z
    .string()
    .cuid("labId must be a valid CUID")
    .describe("The lab this machine belongs to"),
  name: z
    .string()
    .min(1, "Machine name is required")
    .max(100, "Machine name must not exceed 100 characters"),
  type: z
    .string()
    .min(1, "Machine type is required")
    .max(50, "Machine type must not exceed 50 characters")
    .describe('Machine category, e.g. "Oven", "Mixer"'),
  batchCapacity: z
    .number()
    .int("Batch capacity must be a whole number")
    .positive("Batch capacity must be a positive integer")
    .describe("Maximum number of units per production batch"),
  cycleTimeMinutes: z
    .number()
    .int("Cycle time must be a whole number of minutes")
    .positive("Cycle time must be a positive integer")
    .describe("Duration in minutes for a single production cycle"),
  available: z
    .boolean()
    .default(true)
    .optional()
    .describe("Whether the machine is available for use (defaults to true)"),
});

export type CreateMachineInput = z.infer<typeof CreateMachineSchema>;

export const UpdateMachineSchema = z.object({
  name: z
    .string()
    .min(1, "Machine name is required")
    .max(100, "Machine name must not exceed 100 characters")
    .optional(),
  available: z
    .boolean()
    .describe("Whether the machine is currently available for use")
    .optional(),
});

export type UpdateMachineInput = z.infer<typeof UpdateMachineSchema>;

// ============================================================================
// RECIPE SCHEMAS
// ============================================================================

const RecipeIngredientSchema = z
  .object({
    rawMaterialId: z
      .string()
      .cuid("rawMaterialId must be a valid CUID")
      .optional(),
    intermediateProductId: z
      .string()
      .cuid("intermediateProductId must be a valid CUID")
      .optional(),
    quantity: z
      .number()
      .positive("Ingredient quantity must be positive")
      .finite()
      .describe(
        "Amount of this ingredient required (matches Prisma Decimal(10,2) type)",
      ),
    unit: unitValidator.describe('Unit of measurement, e.g. "kg", "pieces"'),
  })
  .refine(
    (data) =>
      (data.rawMaterialId !== undefined) !==
      (data.intermediateProductId !== undefined),
    {
      message:
        "Each ingredient must have either rawMaterialId OR intermediateProductId, but not both",
      path: ["rawMaterialId"],
    },
  );

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const CreateRecipeSchema = z.object({
  name: z
    .string()
    .min(1, "Recipe name is required")
    .max(100, "Recipe name must not exceed 100 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  laborMinutes: z
    .number()
    .int("Labor time must be a whole number of minutes")
    .positive("Labor time must be a positive integer")
    .describe("Total labor time required in minutes"),
  ingredients: z
    .array(RecipeIngredientSchema)
    .min(1, "At least one ingredient is required"),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>;

// ============================================================================
// RAW MATERIAL SCHEMAS
// ============================================================================

export const CreateRawMaterialSchema = z
  .object({
    name: z
      .string()
      .min(1, "Material name is required")
      .max(100, "Material name must not exceed 100 characters"),
    type: z
      .string()
      .min(1, "Material type is required")
      .max(50, "Material type must not exceed 50 characters")
      .describe('Category of the material, e.g. "Flour", "Sugar"'),
    unit: unitValidator.describe('Unit of measurement, e.g. "kg", "liters"'),
    isIntermediate: z
      .boolean()
      .default(false)
      .describe("True if this material is itself produced in-house"),
    productionRecipeId: z
      .string()
      .cuid("productionRecipeId must be a valid CUID")
      .optional()
      .describe("Required when isIntermediate is true"),
  })
  .superRefine((data, ctx) => {
    if (data.isIntermediate && !data.productionRecipeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productionRecipeId is required when isIntermediate is true",
        path: ["productionRecipeId"],
      });
    }
    if (!data.isIntermediate && data.productionRecipeId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "productionRecipeId should only be set when isIntermediate is true",
        path: ["productionRecipeId"],
      });
    }
  });

export type CreateRawMaterialInput = z.infer<typeof CreateRawMaterialSchema>;

// Partial update schema — same fields, all optional, same cross-field rule.
// Defined separately from CreateRawMaterialSchema because ZodEffects (produced
// by .superRefine) does not expose .partial(), so we need a plain ZodObject base.
export const UpdateRawMaterialSchema = z
  .object({
    name: z
      .string()
      .min(1, "Material name is required")
      .max(100, "Material name must not exceed 100 characters")
      .optional(),
    type: z
      .string()
      .min(1, "Material type is required")
      .max(50, "Material type must not exceed 50 characters")
      .optional(),
    unit: unitValidator.optional(),
    isIntermediate: z.boolean().optional(),
    productionRecipeId: z
      .string()
      .cuid("productionRecipeId must be a valid CUID")
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Only enforce cross-field rules when both sides are present in the payload
    if (data.isIntermediate === true && !data.productionRecipeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "productionRecipeId is required when isIntermediate is true",
        path: ["productionRecipeId"],
      });
    }
    if (data.isIntermediate === false && data.productionRecipeId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "productionRecipeId should only be set when isIntermediate is true",
        path: ["productionRecipeId"],
      });
    }
  });

export type UpdateRawMaterialInput = z.infer<typeof UpdateRawMaterialSchema>;

// ============================================================================
// BATCH SCHEMAS
// ============================================================================

export const CreateBatchSchema = z
  .object({
    labId: z
      .string()
      .cuid("labId must be a valid CUID")
      .describe("The lab where this batch will be produced"),
    recipeId: z
      .string()
      .cuid("recipeId must be a valid CUID")
      .describe("The recipe to follow for this batch"),
    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .positive("Quantity must be a positive integer")
      .describe("Number of units to produce"),
    plannedStartTime: z
      .string()
      .datetime({ message: "plannedStartTime must be a valid ISO date string" })
      .describe("Scheduled start time; must be in the future"),
    machineId: z
      .string()
      .cuid("machineId must be a valid CUID")
      .optional()
      .describe("Machine assigned to this batch"),
    employeeId: z
      .string()
      .cuid("employeeId must be a valid CUID")
      .optional()
      .describe("Employee responsible for this batch"),
    estimatedCompletionTime: z
      .string()
      .datetime({
        message: "estimatedCompletionTime must be a valid ISO date string",
      })
      .describe("Expected completion time; must be after plannedStartTime"),
  })
  .superRefine((data, ctx) => {
    const now = new Date();
    const start = new Date(data.plannedStartTime);
    const end = new Date(data.estimatedCompletionTime);

    if (start <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "plannedStartTime must be in the future",
        path: ["plannedStartTime"],
      });
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "estimatedCompletionTime must be after plannedStartTime",
        path: ["estimatedCompletionTime"],
      });
    }
  });

export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;

export const UpdateBatchStatusSchema = z.object({
  status: z
    .enum(BATCH_STATUS_VALUES)
    .describe("New lifecycle status for the batch"),
  actualStartTime: z
    .string()
    .datetime({ message: "actualStartTime must be a valid ISO date string" })
    .optional()
    .describe("Timestamp when the batch actually started"),
  actualCompletionTime: z
    .string()
    .datetime({
      message: "actualCompletionTime must be a valid ISO date string",
    })
    .optional()
    .describe("Timestamp when the batch actually completed"),
});

export type UpdateBatchStatusInput = z.infer<typeof UpdateBatchStatusSchema>;

// ============================================================================
// LAB STOCK SCHEMAS
// ============================================================================

export const UpdateLabStockSchema = z.object({
  quantity: z
    .number()
    .nonnegative("Quantity cannot be negative; use 0 to clear stock")
    .describe("Absolute stock level after manual adjustment"),
  stockType: z
    .enum(["RAW_MATERIAL", "MID_PROCESS", "FINISHED_PRODUCT"])
    .default("RAW_MATERIAL")
    .optional()
    .describe("Stock categorization"),
});

export type UpdateLabStockInput = z.infer<typeof UpdateLabStockSchema>;

// ============================================================================
// BATCH ITEM SCHEMAS
// ============================================================================

export const CreateBatchItemSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Description must not exceed 200 characters")
    .describe("Brief description of the work item or progress note"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be a positive integer")
    .describe("Number of units this item covers"),
  status: z
    .enum(["pending", "in_progress", "completed"])
    .describe("Current worker-reported status for this item"),
});

export type CreateBatchItemInput = z.infer<typeof CreateBatchItemSchema>;

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

const WorkflowConditionSchema = z.object({
  field: z
    .string()
    .min(1, "Condition field is required")
    .max(200, "Condition field must not exceed 200 characters")
    .describe('Dot-separated path into the trigger data, e.g. "stock.quantity"'),
  operator: z
    .enum(["EQUALS", "GREATER_THAN", "LESS_THAN", "CONTAINS", "STARTS_WITH"])
    .describe("Comparison operator applied to the field value"),
  value: z
    .string()
    .min(1, "Condition value is required")
    .max(500, "Condition value must not exceed 500 characters")
    .describe("The right-hand value of the comparison"),
})

const WorkflowActionTransferStockConfigSchema = z.object({
  sourceLab: z.string().min(1),
  destLab: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().positive(),
})

const WorkflowActionCreateOrderConfigSchema = z.object({
  supplier: z.string().min(1),
  material: z.string().min(1),
  quantity: z.number().positive(),
  expectedDelivery: z.string().datetime().optional(),
})

const WorkflowActionNotificationConfigSchema = z.object({
  channel: z.enum(["email", "webhook"]),
  recipient: z.string().min(1),
  message: z.string().min(1).max(2000),
})

const WorkflowActionLogEventConfigSchema = z.object({
  description: z.string().min(1).max(1000),
})

const WorkflowActionSchema = z.object({
  type: z.enum([
    "TRANSFER_STOCK",
    "CREATE_ORDER",
    "SEND_NOTIFICATION",
    "LOG_EVENT",
  ]),
  config: z.record(z.any()).describe("Action-specific configuration object"),
})

const WorkflowStepSchema = z
  .object({
    order: z
      .number()
      .int("Step order must be a whole number")
      .positive("Step order must be a positive integer"),
    type: z.enum(["condition", "action"]),
    condition: WorkflowConditionSchema.optional(),
    action: WorkflowActionSchema.optional(),
    elseStepOrder: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Step order to jump to when this condition is false"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "condition" && !data.condition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "condition is required for steps of type 'condition'",
        path: ["condition"],
      })
    }
    if (data.type === "action" && !data.action) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "action is required for steps of type 'action'",
        path: ["action"],
      })
    }
    if (data.type === "condition" && data.action) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A condition step must not include an action",
        path: ["action"],
      })
    }
    if (data.type === "action" && data.condition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An action step must not include a condition",
        path: ["condition"],
      })
    }
  })

export const CreateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Workflow name is required")
    .max(100, "Workflow name must not exceed 100 characters"),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  triggerType: z.enum([
    "BATCH_CREATED",
    "BATCH_COMPLETED",
    "LOW_STOCK",
    "SCHEDULED",
    "MANUAL",
  ]),
  triggerConfig: z
    .record(z.any())
    .describe(
      'Trigger-specific config, e.g. { recipeId: "..." } or { cronExpression: "0 9 * * MON" }',
    ),
  steps: z
    .array(WorkflowStepSchema)
    .min(1, "At least one step is required")
    .describe("Ordered array of condition and action steps"),
})

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>

export const UpdateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, "Workflow name is required")
    .max(100, "Workflow name must not exceed 100 characters")
    .optional(),
  description: z
    .string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),
  enabled: z.boolean().optional(),
  triggerType: z
    .enum(["BATCH_CREATED", "BATCH_COMPLETED", "LOW_STOCK", "SCHEDULED", "MANUAL"])
    .optional(),
  triggerConfig: z.record(z.any()).optional(),
  steps: z.array(WorkflowStepSchema).min(1).optional(),
})

export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>

export {
  WorkflowConditionSchema,
  WorkflowActionSchema,
  WorkflowStepSchema,
  WorkflowActionTransferStockConfigSchema,
  WorkflowActionCreateOrderConfigSchema,
  WorkflowActionNotificationConfigSchema,
  WorkflowActionLogEventConfigSchema,
}

// ============================================================================
// PHASE 4 SCHEMAS
// ============================================================================

// --- Supplier ---

export const CreateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, 'Supplier name is required')
    .max(100, 'Supplier name must not exceed 100 characters'),
  email: z
    .string()
    .email('Must be a valid email address')
    .optional(),
  phone: z
    .string()
    .max(30, 'Phone must not exceed 30 characters')
    .optional(),
  leadTimeDays: z
    .number()
    .int('Lead time must be a whole number of days')
    .positive('Lead time must be at least 1 day'),
  categories: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one category is required')
    .describe('Types of materials this supplier provides'),
})

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>

export const UpdateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, 'Supplier name is required')
    .max(100, 'Supplier name must not exceed 100 characters')
    .optional(),
  email: z.string().email('Must be a valid email address').optional(),
  phone: z.string().max(30, 'Phone must not exceed 30 characters').optional(),
  leadTimeDays: z
    .number()
    .int('Lead time must be a whole number of days')
    .positive('Lead time must be at least 1 day')
    .optional(),
  categories: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one category is required')
    .optional(),
})

export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>

// --- PurchaseOrder ---

// Line item in a purchase order
export const CreatePurchaseOrderItemSchema = z.object({
  materialId: z
    .string()
    .cuid('materialId must be a valid CUID'),
  quantity: z
    .number()
    .positive('Quantity must be positive')
    .describe('Quantity to order'),
  unitPrice: z
    .number()
    .positive('Unit price must be positive')
    .describe('Price per unit'),
})

export type CreatePurchaseOrderItemInput = z.infer<typeof CreatePurchaseOrderItemSchema>

// Multi-item purchase order (NEW SCHEMA)
export const CreatePurchaseOrderSchema = z
  .object({
    supplierId: z
      .string()
      .cuid('supplierId must be a valid CUID'),
    items: z
      .array(CreatePurchaseOrderItemSchema)
      .min(1, 'At least one item is required')
      .describe('Line items to order from the supplier'),
    deliveryDate: z
      .string()
      .datetime({ message: 'deliveryDate must be a valid ISO date string' })
      .describe('Expected delivery date (must be in the future)'),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.deliveryDate) <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'deliveryDate must be in the future',
        path: ['deliveryDate'],
      })
    }
    // Check for duplicate materials in items
    const materialIds = new Set<string>()
    data.items.forEach((item, index) => {
      if (materialIds.has(item.materialId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate material in items',
          path: ['items', index, 'materialId'],
        })
      }
      materialIds.add(item.materialId)
    })
  })

export type CreatePurchaseOrderInput = z.infer<typeof CreatePurchaseOrderSchema>

// DEPRECATED: Old single-item schema for backwards compatibility
export const CreatePurchaseOrderSingleSchema = z
  .object({
    supplierId: z
      .string()
      .cuid('supplierId must be a valid CUID'),
    materialId: z
      .string()
      .cuid('materialId must be a valid CUID'),
    quantity: z
      .number()
      .positive('Quantity must be positive'),
    deliveryDate: z
      .string()
      .datetime({ message: 'deliveryDate must be a valid ISO date string' })
      .describe('Expected delivery date (must be in the future)'),
    cost: z
      .number()
      .positive('Cost must be positive')
      .optional()
      .describe('Total cost of the order in local currency'),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.deliveryDate) <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'deliveryDate must be in the future',
        path: ['deliveryDate'],
      })
    }
  })

export type CreatePurchaseOrderSingleInput = z.infer<typeof CreatePurchaseOrderSingleSchema>

export const UpdatePurchaseOrderStatusSchema = z.object({
  status: z
    .enum(['pending', 'ordered', 'delivered', 'cancelled'])
    .describe('New lifecycle status for the purchase order'),
  deliveredAt: z
    .string()
    .datetime({ message: 'deliveredAt must be a valid ISO date string' })
    .optional()
    .describe('Timestamp when the order was physically delivered'),
})

export type UpdatePurchaseOrderStatusInput = z.infer<typeof UpdatePurchaseOrderStatusSchema>

// --- Transfer Suggestion ---

export const DismissTransferSuggestionSchema = z.object({
  reason: z
    .string()
    .max(500, 'Reason must not exceed 500 characters')
    .optional()
    .describe('Optional reason for dismissing the suggestion'),
})

export type DismissTransferSuggestionInput = z.infer<typeof DismissTransferSuggestionSchema>

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export type BatchPreflightResult =
  | { valid: true }
  | { valid: false; errors: string[] };

/**
 * Performs pre-flight business-rule checks on a CreateBatchInput before
 * persisting it. Schema-level validation (date ordering, positive integers,
 * etc.) is already handled by CreateBatchSchema; this function is the place
 * for checks that require database lookups or cross-service data that cannot
 * be expressed in a pure Zod schema (e.g. confirming the lab exists, the
 * machine belongs to the lab, the employee is available in that time window).
 *
 * Call this after `CreateBatchSchema.parse(input)` succeeds.
 */
export function validateCreateBatchInput(
  input: CreateBatchInput,
): BatchPreflightResult {
  const errors: string[] = [];

  // Placeholder: add async database-backed checks here, for example:
  //   - Verify labId references an existing, active lab
  //   - Verify recipeId references an existing recipe
  //   - If machineId provided, confirm it belongs to labId and is available
  //   - If employeeId provided, confirm they are assigned to labId
  //   - Check that the lab has no conflicting PLANNED/IN_PROGRESS batches
  //     that would exceed its stated capacity in the requested time window

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
