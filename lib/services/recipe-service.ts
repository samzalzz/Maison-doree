/**
 * lib/services/recipe-service.ts
 *
 * Recipe Development (RD) business logic layer.
 *
 * Responsibilities:
 *  - Validate all inputs with schemas from lib/validators-rd.ts before
 *    touching the database.
 *  - Enforce version state-machine rules (sequential numbers, single active).
 *  - Enforce XOR ingredient source logic (rawMaterialId XOR intermediateProductId).
 *  - Verify that referenced resources (Recipe, RecipeVersion, RawMaterial)
 *    exist before creating or mutating child records.
 *  - Record meaningful changes (laborMinutes, notes, isActive) in
 *    RecipeVersionHistory with structured changeType labels.
 *  - Use Prisma transactions wherever multiple writes must be atomic
 *    (e.g., deactivating other versions before activating a new one).
 *
 * Error types thrown:
 *  - ValidationError  – malformed input or a rejected business-logic rule
 *  - NotFoundError    – the requested record does not exist
 *
 * DB field notes:
 *  RecipeVersionIngredient uses `intermediateId` (not intermediateProductId)
 *  in the Prisma schema. The public API / validator uses intermediateProductId;
 *  this service maps it to the DB column name on every write.
 */

import {
  type Recipe,
  type RecipeVersion,
  type RecipeVersionIngredient,
  type RecipeVersionHistory,
} from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  CreateRecipeSchema,
  UpdateRecipeSchema,
  CreateRecipeVersionSchema,
  UpdateRecipeVersionSchema,
  RecipeVersionFiltersSchema,
  CreateIngredientSchema,
  UpdateIngredientSchema,
  validateIngredientSource,
  validateVersionTransition,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type CreateRecipeVersionInput,
  type UpdateRecipeVersionInput,
  type RecipeVersionFiltersInput,
  type CreateIngredientInput,
  type UpdateIngredientInput,
} from '@/lib/validators-rd'

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class RecipeServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'RecipeServiceError'
    // Maintain proper prototype chain for instanceof checks across transpilation
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends RecipeServiceError {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends RecipeServiceError {
  constructor(resourceType: string, id: string) {
    super(`${resourceType} not found: ${id}`, 'NOT_FOUND')
    this.name = 'NotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Full version include — always load ingredients alongside a version so callers
 * receive a consistent, predictable shape.
 */
const VERSION_WITH_INGREDIENTS = {
  ingredients: {
    orderBy: { recipeVersionId: 'asc' as const },
  },
} as const

/**
 * Change types written to RecipeVersionHistory.
 * Using constants keeps the audit trail consistent and avoids raw string typos.
 */
const CHANGE_TYPE = {
  VERSION_CREATED: 'VERSION_CREATED',
  LABOR_MINUTES_UPDATED: 'LABOR_MINUTES_UPDATED',
  NOTES_UPDATED: 'NOTES_UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
} as const

// ============================================================================
// 1. RECIPE MANAGEMENT
// ============================================================================

/**
 * Creates a new top-level Recipe record.
 *
 * Validation order:
 *  1. Schema validation (Zod)
 *  2. Database insert
 */
export async function createRecipe(
  input: CreateRecipeInput,
  _userId: string,
): Promise<Recipe> {
  // --- Step 1: Schema validation ---
  const parseResult = CreateRecipeSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid recipe input', errors)
  }

  const validated = parseResult.data

  // --- Step 2: Persist ---
  const recipe = await prisma.recipe.create({
    data: {
      name: validated.name,
      description: validated.description ?? null,
      // laborMinutes on the Recipe model itself is required by the schema;
      // for new RD-managed recipes we seed it at 0 — the real value lives on
      // RecipeVersion.laborMinutes and is versioned independently.
      laborMinutes: 0,
    },
  })

  return recipe
}

/**
 * Fetches a single Recipe by ID, including all of its versions ordered newest
 * first (versionNumber DESC).
 * Returns null when the record does not exist.
 */
export async function getRecipe(
  recipeId: string,
): Promise<(Recipe & { versions: RecipeVersion[] }) | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  })

  return recipe
}

/**
 * Lists Recipes with offset-based pagination.
 * Returns both the page of records and the total count.
 */
export async function listRecipes(
  limit = 50,
  offset = 0,
): Promise<{ recipes: Recipe[]; total: number }> {
  const [total, recipes] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { recipes, total }
}

/**
 * Applies a partial update to a Recipe.
 * Throws NotFoundError if the recipe does not exist.
 * Throws ValidationError if the input fails schema validation.
 */
export async function updateRecipe(
  recipeId: string,
  input: UpdateRecipeInput,
  _userId: string,
): Promise<Recipe> {
  // --- Existence check ---
  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('Recipe', recipeId)
  }

  // --- Schema validation ---
  const parseResult = UpdateRecipeSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid recipe update input', errors)
  }

  const validated = parseResult.data

  // Build update payload — only include defined fields
  const updateData: Parameters<typeof prisma.recipe.update>[0]['data'] = {}
  if (validated.name !== undefined) {
    updateData.name = validated.name
  }
  if (validated.description !== undefined) {
    updateData.description = validated.description
  }

  const updated = await prisma.recipe.update({
    where: { id: recipeId },
    data: updateData,
  })

  return updated
}

// ============================================================================
// 2. RECIPE VERSION MANAGEMENT
// ============================================================================

/**
 * Creates a new RecipeVersion for the given recipe.
 *
 * Validation order:
 *  1. Verify recipe exists
 *  2. Schema validation (Zod)
 *  3. Version transition validation (sequential numbers, single-active rule)
 *  4. If isActive=true: deactivate all other versions in the same transaction
 *  5. Insert RecipeVersion + initial RecipeVersionHistory entry
 */
export async function createRecipeVersion(
  recipeId: string,
  input: CreateRecipeVersionInput,
  userId: string,
): Promise<RecipeVersion> {
  // --- Step 1: Verify recipe exists ---
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true },
  })
  if (!recipe) {
    throw new NotFoundError('Recipe', recipeId)
  }

  // --- Step 2: Schema validation ---
  // Normalise recipeId into the input so the schema can validate it too
  const normalizedInput = { ...input, recipeId }
  const parseResult = CreateRecipeVersionSchema.safeParse(normalizedInput)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid recipe version input', errors)
  }

  const validated = parseResult.data

  // --- Step 3: Version transition validation ---
  const existingVersions = await prisma.recipeVersion.findMany({
    where: { recipeId },
    select: { versionNumber: true, isActive: true },
  })

  // When the new version will be active, the service handles deactivating
  // other versions inside the transaction. Pass a snapshot that reflects the
  // post-deactivation state (all existing versions treated as inactive) so
  // validateVersionTransition only checks sequential/duplicate rules and does
  // not raise a false "another version already active" conflict.
  const snapshotForValidation = validated.isActive
    ? existingVersions.map((v) => ({ ...v, isActive: false }))
    : existingVersions

  const transitionResult = validateVersionTransition(
    snapshotForValidation,
    validated.versionNumber,
    validated.isActive,
  )
  if (!transitionResult.valid) {
    throw new ValidationError('Invalid version transition', transitionResult.errors)
  }

  // --- Steps 4 & 5: Atomic write ---
  const version = await prisma.$transaction(async (tx) => {
    // Deactivate all other versions if this one should be active
    if (validated.isActive) {
      await tx.recipeVersion.updateMany({
        where: { recipeId, isActive: true },
        data: { isActive: false },
      })
    }

    // Create the new version
    const newVersion = await tx.recipeVersion.create({
      data: {
        recipeId,
        versionNumber: validated.versionNumber,
        laborMinutes: validated.laborMinutes,
        notes: validated.notes ?? null,
        isActive: validated.isActive,
        createdBy: userId,
      },
    })

    // Record initial creation in the history log
    await tx.recipeVersionHistory.create({
      data: {
        recipeVersionId: newVersion.id,
        changeType: CHANGE_TYPE.VERSION_CREATED,
        fieldName: 'versionNumber',
        oldValue: null,
        newValue: String(validated.versionNumber),
        changedBy: userId,
        reason: validated.notes ?? null,
      },
    })

    return newVersion
  })

  return version
}

/**
 * Fetches a single RecipeVersion by ID, including its ingredient lines.
 * Returns null when the record does not exist.
 */
export async function getRecipeVersion(
  versionId: string,
): Promise<(RecipeVersion & { ingredients: RecipeVersionIngredient[] }) | null> {
  const version = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    include: VERSION_WITH_INGREDIENTS,
  })

  return version
}

/**
 * Lists RecipeVersions with optional filtering and pagination.
 *
 * Filters supported:
 *  - recipeId
 *  - isActive
 *  - date range: fromDate <= createdAt <= toDate
 *
 * Returns both the page of records and the total count matching the filters.
 */
export async function listRecipeVersions(
  filters: RecipeVersionFiltersInput,
): Promise<{ versions: RecipeVersion[]; total: number }> {
  // Validate + apply defaults (limit=50, offset=0)
  const parseResult = RecipeVersionFiltersSchema.safeParse(filters)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid filter parameters', errors)
  }

  const { recipeId, isActive, fromDate, toDate, limit, offset } = parseResult.data

  // Build dynamic where clause
  const where: Parameters<typeof prisma.recipeVersion.findMany>[0]['where'] = {}

  if (recipeId !== undefined) {
    where.recipeId = recipeId
  }
  if (isActive !== undefined) {
    where.isActive = isActive
  }
  if (fromDate !== undefined || toDate !== undefined) {
    where.createdAt = {}
    if (fromDate !== undefined) {
      where.createdAt.gte = fromDate
    }
    if (toDate !== undefined) {
      where.createdAt.lte = toDate
    }
  }

  // Run count and data fetch in parallel for efficiency
  const [total, versions] = await Promise.all([
    prisma.recipeVersion.count({ where }),
    prisma.recipeVersion.findMany({
      where,
      orderBy: { versionNumber: 'desc' },
      take: limit,
      skip: offset,
    }),
  ])

  return { versions, total }
}

/**
 * Applies a partial update to a RecipeVersion.
 *
 * If isActive=true the single-active rule is validated; all other versions for
 * the parent recipe are deactivated in the same transaction.
 * Meaningful field changes (laborMinutes, notes, isActive) are recorded in
 * RecipeVersionHistory.
 *
 * Throws NotFoundError if the version does not exist.
 * Throws ValidationError if the input or state transition is invalid.
 */
export async function updateRecipeVersion(
  versionId: string,
  input: UpdateRecipeVersionInput,
  userId: string,
): Promise<RecipeVersion> {
  // --- Existence check ---
  const existing = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      recipeId: true,
      laborMinutes: true,
      notes: true,
      isActive: true,
      versionNumber: true,
    },
  })
  if (!existing) {
    throw new NotFoundError('RecipeVersion', versionId)
  }

  // --- Schema validation ---
  const parseResult = UpdateRecipeVersionSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid version update input', errors)
  }

  const validated = parseResult.data

  // --- Single-active rule guard ---
  if (validated.isActive === true && !existing.isActive) {
    // Check whether any other version for this recipe is currently active
    const siblingVersions = await prisma.recipeVersion.findMany({
      where: { recipeId: existing.recipeId },
      select: { versionNumber: true, isActive: true },
    })

    const activeCount = siblingVersions.filter((v) => v.isActive).length
    if (activeCount > 0) {
      throw new ValidationError('Invalid version state', [
        'Another version is already active. Deactivate it before marking this version as active',
      ])
    }
  }

  // --- Build history entries for meaningful changes ---
  const historyEntries: Array<{
    changeType: string
    fieldName: string
    oldValue: string | null
    newValue: string | null
  }> = []

  if (
    validated.laborMinutes !== undefined &&
    validated.laborMinutes !== existing.laborMinutes
  ) {
    historyEntries.push({
      changeType: CHANGE_TYPE.LABOR_MINUTES_UPDATED,
      fieldName: 'laborMinutes',
      oldValue: String(existing.laborMinutes),
      newValue: String(validated.laborMinutes),
    })
  }

  if (validated.notes !== undefined && validated.notes !== existing.notes) {
    historyEntries.push({
      changeType: CHANGE_TYPE.NOTES_UPDATED,
      fieldName: 'notes',
      oldValue: existing.notes,
      newValue: validated.notes,
    })
  }

  if (
    validated.isActive !== undefined &&
    validated.isActive !== existing.isActive
  ) {
    historyEntries.push({
      changeType: CHANGE_TYPE.STATUS_CHANGED,
      fieldName: 'isActive',
      oldValue: String(existing.isActive),
      newValue: String(validated.isActive),
    })
  }

  // --- Atomic write ---
  const updated = await prisma.$transaction(async (tx) => {
    // If activating, deactivate all siblings first
    if (validated.isActive === true) {
      await tx.recipeVersion.updateMany({
        where: { recipeId: existing.recipeId, isActive: true },
        data: { isActive: false },
      })
    }

    // Build update payload — only include defined fields
    const updateData: Parameters<typeof tx.recipeVersion.update>[0]['data'] = {}
    if (validated.laborMinutes !== undefined) {
      updateData.laborMinutes = validated.laborMinutes
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive
    }

    const updatedVersion = await tx.recipeVersion.update({
      where: { id: versionId },
      data: updateData,
    })

    // Persist history entries for each meaningful change
    for (const entry of historyEntries) {
      await tx.recipeVersionHistory.create({
        data: {
          recipeVersionId: versionId,
          changeType: entry.changeType,
          fieldName: entry.fieldName,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          changedBy: userId,
        },
      })
    }

    return updatedVersion
  })

  return updated
}

// ============================================================================
// 3. RECIPE VERSION INGREDIENTS
// ============================================================================

/**
 * Adds an ingredient line to a RecipeVersion.
 *
 * Validation order:
 *  1. Verify RecipeVersion exists
 *  2. Schema validation (Zod)
 *  3. XOR source validation (validateIngredientSource)
 *  4. Verify referenced material exists (RawMaterial)
 *  5. Insert RecipeVersionIngredient
 */
export async function addIngredient(
  versionId: string,
  input: CreateIngredientInput,
  _userId: string,
): Promise<RecipeVersionIngredient> {
  // --- Step 1: Verify version exists ---
  const version = await prisma.recipeVersion.findUnique({
    where: { id: versionId },
    select: { id: true },
  })
  if (!version) {
    throw new NotFoundError('RecipeVersion', versionId)
  }

  // --- Step 2: Schema validation ---
  // Normalise recipeVersionId into the input for consistent validation
  const normalizedInput = { ...input, recipeVersionId: versionId }
  const parseResult = CreateIngredientSchema.safeParse(normalizedInput)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid ingredient input', errors)
  }

  const validated = parseResult.data

  // --- Step 3: XOR source validation ---
  const sourceResult = validateIngredientSource(
    validated.rawMaterialId,
    validated.intermediateProductId,
  )
  if (!sourceResult.valid) {
    throw new ValidationError('Invalid ingredient source', sourceResult.errors)
  }

  // --- Step 4: Verify referenced material exists ---
  if (validated.rawMaterialId) {
    const material = await prisma.rawMaterial.findUnique({
      where: { id: validated.rawMaterialId },
      select: { id: true },
    })
    if (!material) {
      throw new NotFoundError('RawMaterial', validated.rawMaterialId)
    }
  }

  if (validated.intermediateProductId) {
    const intermediate = await prisma.rawMaterial.findUnique({
      where: { id: validated.intermediateProductId },
      select: { id: true },
    })
    if (!intermediate) {
      throw new NotFoundError('RawMaterial (intermediate)', validated.intermediateProductId)
    }
  }

  // --- Step 5: Persist ---
  // Note: the DB column is `intermediateId`, not intermediateProductId
  const ingredient = await prisma.recipeVersionIngredient.create({
    data: {
      recipeVersionId: versionId,
      rawMaterialId: validated.rawMaterialId ?? null,
      intermediateId: validated.intermediateProductId ?? null,
      quantity: validated.quantity,
      unit: validated.unit,
    },
  })

  return ingredient
}

/**
 * Returns all ingredient lines for a RecipeVersion, ordered by creation time.
 */
export async function getIngredients(
  versionId: string,
): Promise<RecipeVersionIngredient[]> {
  const ingredients = await prisma.recipeVersionIngredient.findMany({
    where: { recipeVersionId: versionId },
    orderBy: { recipeVersionId: 'asc' },
  })

  return ingredients
}

/**
 * Updates the quantity and/or unit of an ingredient line.
 *
 * Material source changes (rawMaterialId / intermediateProductId) require
 * deleting and re-creating the ingredient — this function only accepts
 * quantity/unit updates to enforce that contract.
 *
 * Throws NotFoundError if the ingredient does not exist.
 * Throws ValidationError if the input is invalid.
 */
export async function updateIngredient(
  ingredientId: string,
  input: UpdateIngredientInput,
  _userId: string,
): Promise<RecipeVersionIngredient> {
  // --- Existence check ---
  const existing = await prisma.recipeVersionIngredient.findUnique({
    where: { id: ingredientId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('RecipeVersionIngredient', ingredientId)
  }

  // --- Schema validation ---
  const parseResult = UpdateIngredientSchema.safeParse(input)
  if (!parseResult.success) {
    const errors = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    throw new ValidationError('Invalid ingredient update input', errors)
  }

  const validated = parseResult.data

  // Build update payload — only quantity and unit are allowed
  const updateData: Parameters<typeof prisma.recipeVersionIngredient.update>[0]['data'] = {}
  if (validated.quantity !== undefined) {
    updateData.quantity = validated.quantity
  }
  if (validated.unit !== undefined) {
    updateData.unit = validated.unit
  }

  const updated = await prisma.recipeVersionIngredient.update({
    where: { id: ingredientId },
    data: updateData,
  })

  return updated
}

/**
 * Deletes an ingredient line from a RecipeVersion.
 * Throws NotFoundError if the ingredient does not exist.
 */
export async function removeIngredient(
  ingredientId: string,
  _userId: string,
): Promise<void> {
  // --- Existence check ---
  const existing = await prisma.recipeVersionIngredient.findUnique({
    where: { id: ingredientId },
    select: { id: true },
  })
  if (!existing) {
    throw new NotFoundError('RecipeVersionIngredient', ingredientId)
  }

  await prisma.recipeVersionIngredient.delete({
    where: { id: ingredientId },
  })
}

// ============================================================================
// 4. RECIPE VERSION HISTORY & ANALYTICS
// ============================================================================

/**
 * Returns all RecipeVersionHistory entries for a given version, ordered
 * newest first (changeDate DESC).
 */
export async function getRecipeVersionHistory(
  versionId: string,
): Promise<RecipeVersionHistory[]> {
  const history = await prisma.recipeVersionHistory.findMany({
    where: { recipeVersionId: versionId },
    orderBy: { changeDate: 'desc' },
  })

  return history
}

/**
 * Returns all versions for a recipe ordered by versionNumber ASC.
 * Intended for side-by-side diff/comparison views where ascending order
 * makes it easy to walk the version timeline.
 */
export async function getRecipeVersions(
  recipeId: string,
): Promise<RecipeVersion[]> {
  const versions = await prisma.recipeVersion.findMany({
    where: { recipeId },
    orderBy: { versionNumber: 'asc' },
  })

  return versions
}
