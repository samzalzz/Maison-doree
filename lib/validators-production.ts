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
