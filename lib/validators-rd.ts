import { z } from 'zod'

// ============================================================================
// RECIPE VALIDATORS
// ============================================================================

/**
 * Input schema for POST /api/admin/recipes.
 *
 * Creates a new top-level Recipe record. Labor time and versioning details are
 * managed on RecipeVersion; only the human-facing name and description are
 * required at this stage.
 */
export const CreateRecipeSchema = z.object({
  name: z
    .string()
    .min(1, 'Recipe name is required')
    .max(100, 'Recipe name must not exceed 100 characters')
    .describe('Recipe name'),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
})

export type CreateRecipeInput = z.infer<typeof CreateRecipeSchema>

/**
 * Input schema for PATCH /api/admin/recipes/[id].
 *
 * All fields are optional — only provided fields are updated.
 */
export const UpdateRecipeSchema = z.object({
  name: z
    .string()
    .min(1, 'Recipe name is required')
    .max(100, 'Recipe name must not exceed 100 characters')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
})

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeSchema>

// ============================================================================
// RECIPE VERSION VALIDATORS
// ============================================================================

/**
 * Input schema for POST /api/admin/recipes/[id]/versions.
 *
 * Creates a new versioned snapshot of a recipe. Version numbers must be
 * sequential positive integers (1, 2, 3...). Cross-version ordering and
 * uniqueness are enforced by validateVersionTransition before persisting.
 */
export const CreateRecipeVersionSchema = z.object({
  recipeId: z.string().cuid('Invalid recipe ID'),
  versionNumber: z
    .number()
    .int('Version number must be an integer')
    .positive('Version number must be a positive integer')
    .describe('Semantic version: 1, 2, 3...'),
  laborMinutes: z
    .number()
    .int('Labor time must be a whole number of minutes')
    .nonnegative('Labor time cannot be negative')
    .describe('Total labor time in minutes'),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional()
    .describe('Version notes/changelog'),
  isActive: z
    .boolean()
    .default(false)
    .describe('Mark this version as current'),
})

export type CreateRecipeVersionInput = z.infer<typeof CreateRecipeVersionSchema>

/**
 * Input schema for PATCH /api/admin/recipes/versions/[id].
 *
 * All fields are optional — only provided fields are updated.
 * Use validateVersionTransition before applying an isActive change.
 */
export const UpdateRecipeVersionSchema = z.object({
  laborMinutes: z
    .number()
    .int('Labor time must be a whole number of minutes')
    .nonnegative('Labor time cannot be negative')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional(),
  isActive: z.boolean().optional(),
})

export type UpdateRecipeVersionInput = z.infer<typeof UpdateRecipeVersionSchema>

/**
 * Query parameter schema for GET /api/admin/recipes/versions.
 *
 * All filters are optional; pagination defaults apply.
 */
export const RecipeVersionFiltersSchema = z.object({
  recipeId: z.string().cuid('Invalid recipe ID').optional(),
  isActive: z.boolean().optional(),
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

export type RecipeVersionFiltersInput = z.infer<typeof RecipeVersionFiltersSchema>

// ============================================================================
// RECIPE VERSION INGREDIENT VALIDATORS
// ============================================================================

/**
 * Input schema for POST /api/admin/recipes/versions/[id]/ingredients.
 *
 * Exactly one of rawMaterialId or intermediateProductId must be set.
 * Cross-field XOR enforcement is handled by validateIngredientSource before
 * persisting — the Zod schema keeps both optional so that error messages
 * remain field-specific rather than buried in a top-level refinement error.
 *
 * Note: the DB column is `intermediateId`; this input uses `intermediateProductId`
 * to match the public API contract and domain language.
 */
export const CreateIngredientSchema = z.object({
  recipeVersionId: z.string().cuid('Invalid recipe version ID'),
  rawMaterialId: z
    .string()
    .cuid('Invalid material ID')
    .optional()
    .describe('Required if not using intermediate product'),
  intermediateProductId: z
    .string()
    .cuid('Invalid intermediate ID')
    .optional()
    .describe('Required if not using raw material'),
  quantity: z
    .number()
    .positive('Quantity must be a positive number')
    .describe('Amount needed (e.g., 2.5 for 2.5 kg)'),
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(20, 'Unit must not exceed 20 characters')
    .describe('kg, pieces, liters, etc.'),
})

export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>

/**
 * Input schema for PATCH /api/admin/recipes/ingredients/[id].
 *
 * Only quantity and unit can be updated after creation. To change the linked
 * material, delete and re-create the ingredient line.
 */
export const UpdateIngredientSchema = z.object({
  quantity: z
    .number()
    .positive('Quantity must be a positive number')
    .optional(),
  unit: z
    .string()
    .min(1, 'Unit is required')
    .max(20, 'Unit must not exceed 20 characters')
    .optional(),
})

export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>

// ============================================================================
// BUSINESS LOGIC VALIDATORS
// ============================================================================

/** Return type shared by all business-logic validators in this module. */
export type RDValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: string[] }

/**
 * Enforces XOR (exclusive-or) logic for ingredient source references.
 *
 * Rules:
 *   - Exactly one of rawMaterialId or intermediateProductId must be provided.
 *   - Providing both is an error (ambiguous source).
 *   - Providing neither is an error (no ingredient source defined).
 *
 * Call this after CreateIngredientSchema.parse() succeeds, before writing to
 * the database.
 */
export function validateIngredientSource(
  rawMaterialId?: string,
  intermediateProductId?: string,
): RDValidationResult {
  const hasMaterial = rawMaterialId !== undefined && rawMaterialId !== ''
  const hasIntermediate =
    intermediateProductId !== undefined && intermediateProductId !== ''

  if (hasMaterial && hasIntermediate) {
    return {
      valid: false,
      errors: [
        'Ingredient must reference either rawMaterialId or intermediateProductId, not both',
      ],
    }
  }

  if (!hasMaterial && !hasIntermediate) {
    return {
      valid: false,
      errors: [
        'Ingredient must reference exactly one of rawMaterialId or intermediateProductId',
      ],
    }
  }

  return { valid: true, errors: [] }
}

/**
 * Enforces version state-transition rules when adding a new recipe version.
 *
 * Rules:
 *   1. The new version number must not already exist on this recipe.
 *   2. Version numbers must be sequential with no gaps (e.g. if the highest
 *      existing version is 2, the next allowed version is 3).
 *   3. Only one version can be active at a time. If newIsActive is true,
 *      the caller must deactivate the currently active version before
 *      (or in the same transaction as) inserting the new one.
 *   4. Cannot mark the new version active when another version is already
 *      active without first explicitly deactivating the old one — this
 *      function signals the conflict so the caller can handle it.
 *
 * @param currentVersions  Snapshot of existing versions for this recipe.
 * @param newVersionNumber Version number requested for the new version.
 * @param newIsActive      Whether the new version should be the active one.
 */
export function validateVersionTransition(
  currentVersions: { versionNumber: number; isActive: boolean }[],
  newVersionNumber: number,
  newIsActive: boolean,
): RDValidationResult {
  const errors: string[] = []

  // Rule 1: Version number must not already exist.
  const existingNumbers = currentVersions.map((v) => v.versionNumber)
  if (existingNumbers.includes(newVersionNumber)) {
    errors.push(
      `Version number ${newVersionNumber} already exists for this recipe`,
    )
  }

  // Rule 2: Sequential numbering — no gaps allowed.
  // When there are no existing versions, versionNumber must be 1.
  // When versions exist, the new number must equal max(existing) + 1.
  if (currentVersions.length === 0) {
    if (newVersionNumber !== 1) {
      errors.push(
        `First version must be version 1, got ${newVersionNumber}`,
      )
    }
  } else {
    const maxExisting = Math.max(...existingNumbers)
    const expectedNext = maxExisting + 1
    // Only enforce the gap rule when the number isn't already flagged as a
    // duplicate (to avoid redundant error messages).
    if (!existingNumbers.includes(newVersionNumber) && newVersionNumber !== expectedNext) {
      errors.push(
        `Version numbers must be sequential. Expected ${expectedNext}, got ${newVersionNumber}`,
      )
    }
  }

  // Rule 3: Only one active version at a time.
  if (newIsActive) {
    const currentlyActive = currentVersions.filter((v) => v.isActive)
    if (currentlyActive.length > 0) {
      errors.push(
        'Another version is already active. Deactivate it before marking this version as active',
      )
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
