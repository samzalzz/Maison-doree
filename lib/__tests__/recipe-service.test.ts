/**
 * lib/__tests__/recipe-service.test.ts
 *
 * Unit / integration tests for lib/services/recipe-service.ts.
 *
 * Strategy:
 *  - The Prisma client is fully mocked via jest.mock so no real database is
 *    required. Every prisma.* call is replaced with a jest.fn() whose return
 *    value is configured per-test.
 *  - $transaction is mocked to execute its callback synchronously with the
 *    mocked client so multi-step transactional operations can be tested without
 *    a real DB connection.
 *  - Business-logic validators (validateIngredientSource,
 *    validateVersionTransition) are imported from the real validators-rd module
 *    so their behaviour is covered transitively.
 *  - The suite is grouped by service function, with sub-groups for the happy
 *    path, validation failures, and not-found scenarios.
 */

// ---------------------------------------------------------------------------
// Mock: Prisma client
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    recipe: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    recipeVersion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recipeVersionIngredient: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recipeVersionHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    rawMaterial: {
      findUnique: jest.fn(),
    },
    // $transaction executes the callback immediately with the mocked prisma
    // object, so multi-write operations can be tested without a real DB.
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) => {
      const { prisma: mockPrisma } = require('@/lib/db/prisma')
      return cb(mockPrisma)
    }),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import {
  createRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
  createRecipeVersion,
  getRecipeVersion,
  listRecipeVersions,
  updateRecipeVersion,
  addIngredient,
  getIngredients,
  updateIngredient,
  removeIngredient,
  getRecipeVersionHistory,
  getRecipeVersions,
  ValidationError,
  NotFoundError,
  RecipeServiceError,
} from '@/lib/services/recipe-service'

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockRecipe = prisma.recipe as jest.Mocked<typeof prisma.recipe>
const mockVersion = prisma.recipeVersion as jest.Mocked<typeof prisma.recipeVersion>
const mockIngredient = prisma.recipeVersionIngredient as jest.Mocked<
  typeof prisma.recipeVersionIngredient
>
const mockHistory = prisma.recipeVersionHistory as jest.Mocked<
  typeof prisma.recipeVersionHistory
>
const mockRawMaterial = prisma.rawMaterial as jest.Mocked<typeof prisma.rawMaterial>

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const RECIPE_ID    = 'clh3v2y0k0000356pk1b6vxxt'
const VERSION_ID   = 'clh3v2y0k0001356pk1b6vxxt'
const INGREDIENT_ID = 'clh3v2y0k0002356pk1b6vxxt'
const MATERIAL_ID  = 'clh3v2y0k0003356pk1b6vxxt'
const INTERMEDIATE_ID = 'clh3v2y0k0004356pk1b6vxxt'
const USER_ID      = 'clh3v2y0k0005356pk1b6vxxt'
const HISTORY_ID   = 'clh3v2y0k0006356pk1b6vxxt'

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: RECIPE_ID,
    name: 'Chebakia',
    description: 'Traditional Moroccan sesame cookie',
    laborMinutes: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    recipeId: RECIPE_ID,
    versionNumber: 1,
    versionName: null,
    description: null,
    laborMinutes: 90,
    estimatedCost: null,
    lastCostUpdate: null,
    isActive: false,
    deprecatedAt: null,
    previousVersionId: null,
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ingredients: [],
    ...overrides,
  }
}

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: INGREDIENT_ID,
    recipeVersionId: VERSION_ID,
    rawMaterialId: MATERIAL_ID,
    intermediateId: null,
    quantity: 2.5,
    unit: 'kg',
    costPerUnit: null,
    totalCost: null,
    notes: null,
    ...overrides,
  }
}

function makeHistoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: HISTORY_ID,
    recipeVersionId: VERSION_ID,
    changeType: 'VERSION_CREATED',
    fieldName: 'versionNumber',
    oldValue: null,
    newValue: '1',
    changedBy: USER_ID,
    changeDate: new Date('2026-01-01'),
    reason: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // resetAllMocks clears all queued mockResolvedValueOnce values so that
  // unconsumed return values from a failed test cannot bleed into the next
  // test. We then re-install the $transaction implementation because
  // resetAllMocks removes it.
  jest.resetAllMocks()
  ;(prisma.$transaction as jest.Mock).mockImplementation(
    (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
  )
})

// ============================================================================
// ERROR CLASSES
// ============================================================================

describe('Error classes', () => {
  it('RecipeServiceError carries code and name', () => {
    const err = new RecipeServiceError('something failed', 'SOME_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(RecipeServiceError)
    expect(err.code).toBe('SOME_CODE')
    expect(err.name).toBe('RecipeServiceError')
    expect(err.message).toBe('something failed')
  })

  it('ValidationError is a RecipeServiceError with VALIDATION_ERROR code', () => {
    const err = new ValidationError('bad input', ['field: required'])
    expect(err).toBeInstanceOf(RecipeServiceError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.name).toBe('ValidationError')
    expect(err.errors).toEqual(['field: required'])
  })

  it('NotFoundError formats message correctly', () => {
    const err = new NotFoundError('Recipe', 'abc123')
    expect(err).toBeInstanceOf(RecipeServiceError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.message).toBe('Recipe not found: abc123')
  })
})

// ============================================================================
// createRecipe
// ============================================================================

describe('createRecipe', () => {
  describe('happy path', () => {
    it('creates a recipe with name only', async () => {
      const expected = makeRecipe({ description: null })
      mockRecipe.create.mockResolvedValueOnce(expected)

      const result = await createRecipe({ name: 'Chebakia' }, USER_ID)

      expect(result).toEqual(expected)
      expect(mockRecipe.create).toHaveBeenCalledTimes(1)
      const createCall = mockRecipe.create.mock.calls[0][0]
      expect(createCall.data.name).toBe('Chebakia')
      expect(createCall.data.laborMinutes).toBe(0)
    })

    it('creates a recipe with name and description', async () => {
      const expected = makeRecipe()
      mockRecipe.create.mockResolvedValueOnce(expected)

      const result = await createRecipe(
        { name: 'Chebakia', description: 'Traditional Moroccan sesame cookie' },
        USER_ID,
      )

      expect(result).toEqual(expected)
      const createCall = mockRecipe.create.mock.calls[0][0]
      expect(createCall.data.description).toBe('Traditional Moroccan sesame cookie')
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError when name is missing', async () => {
      await expect(
        createRecipe(
          // @ts-expect-error intentional bad input
          {},
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when name is an empty string', async () => {
      await expect(
        createRecipe({ name: '' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when name exceeds 100 characters', async () => {
      await expect(
        createRecipe({ name: 'a'.repeat(101) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when description exceeds 1000 characters', async () => {
      await expect(
        createRecipe({ name: 'Valid', description: 'x'.repeat(1001) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getRecipe
// ============================================================================

describe('getRecipe', () => {
  it('returns recipe with versions when found', async () => {
    const recipe = { ...makeRecipe(), versions: [makeVersion()] }
    mockRecipe.findUnique.mockResolvedValueOnce(recipe)

    const result = await getRecipe(RECIPE_ID)

    expect(result).toEqual(recipe)
    expect(mockRecipe.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RECIPE_ID } }),
    )
  })

  it('returns null when recipe does not exist', async () => {
    mockRecipe.findUnique.mockResolvedValueOnce(null)

    const result = await getRecipe('nonexistent-id')
    expect(result).toBeNull()
  })

  it('requests versions ordered by versionNumber DESC', async () => {
    mockRecipe.findUnique.mockResolvedValueOnce(null)

    await getRecipe(RECIPE_ID)

    const call = mockRecipe.findUnique.mock.calls[0][0] as {
      include?: { versions?: { orderBy?: unknown } }
    }
    expect(call.include?.versions?.orderBy).toEqual({ versionNumber: 'desc' })
  })
})

// ============================================================================
// listRecipes
// ============================================================================

describe('listRecipes', () => {
  it('returns recipes and total with default pagination', async () => {
    const recipes = [makeRecipe()]
    mockRecipe.count.mockResolvedValueOnce(1)
    mockRecipe.findMany.mockResolvedValueOnce(recipes)

    const result = await listRecipes()

    expect(result.total).toBe(1)
    expect(result.recipes).toHaveLength(1)
  })

  it('passes limit and offset to Prisma', async () => {
    mockRecipe.count.mockResolvedValueOnce(100)
    mockRecipe.findMany.mockResolvedValueOnce([])

    await listRecipes(10, 20)

    const findManyCall = mockRecipe.findMany.mock.calls[0][0] as {
      take?: number
      skip?: number
    }
    expect(findManyCall.take).toBe(10)
    expect(findManyCall.skip).toBe(20)
  })

  it('returns empty array when no recipes exist', async () => {
    mockRecipe.count.mockResolvedValueOnce(0)
    mockRecipe.findMany.mockResolvedValueOnce([])

    const result = await listRecipes()
    expect(result.total).toBe(0)
    expect(result.recipes).toEqual([])
  })
})

// ============================================================================
// updateRecipe
// ============================================================================

describe('updateRecipe', () => {
  describe('happy path', () => {
    it('updates name only', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      const updated = makeRecipe({ name: 'New Name' })
      mockRecipe.update.mockResolvedValueOnce(updated)

      const result = await updateRecipe(RECIPE_ID, { name: 'New Name' }, USER_ID)

      expect(result.name).toBe('New Name')
      const updateCall = mockRecipe.update.mock.calls[0][0]
      expect(updateCall.data.name).toBe('New Name')
      // description should NOT be in the payload
      expect(updateCall.data.description).toBeUndefined()
    })

    it('updates description only', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      const updated = makeRecipe({ description: 'Updated desc' })
      mockRecipe.update.mockResolvedValueOnce(updated)

      await updateRecipe(RECIPE_ID, { description: 'Updated desc' }, USER_ID)

      const updateCall = mockRecipe.update.mock.calls[0][0]
      expect(updateCall.data.description).toBe('Updated desc')
      expect(updateCall.data.name).toBeUndefined()
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when recipe does not exist', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce(null)

      await expect(
        updateRecipe(RECIPE_ID, { name: 'New Name' }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError for empty name', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })

      await expect(
        updateRecipe(RECIPE_ID, { name: '' }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for name exceeding 100 characters', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })

      await expect(
        updateRecipe(RECIPE_ID, { name: 'n'.repeat(101) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for description exceeding 1000 characters', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })

      await expect(
        updateRecipe(RECIPE_ID, { description: 'd'.repeat(1001) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// createRecipeVersion
// ============================================================================

describe('createRecipeVersion', () => {
  describe('happy path', () => {
    it('creates the first version (versionNumber=1, isActive=false)', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      // No existing versions
      mockVersion.findMany.mockResolvedValueOnce([])
      const newVersion = makeVersion()
      mockVersion.create.mockResolvedValueOnce(newVersion)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      const result = await createRecipeVersion(
        RECIPE_ID,
        { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: 90 },
        USER_ID,
      )

      expect(result).toEqual(newVersion)
      expect(mockVersion.create).toHaveBeenCalledTimes(1)
      const createCall = mockVersion.create.mock.calls[0][0]
      expect(createCall.data.versionNumber).toBe(1)
      expect(createCall.data.laborMinutes).toBe(90)
      expect(createCall.data.createdBy).toBe(USER_ID)
    })

    it('creates a second version and deactivates the first when isActive=true', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      // Existing v1 is active
      mockVersion.findMany.mockResolvedValueOnce([
        { versionNumber: 1, isActive: true },
      ])
      mockVersion.updateMany.mockResolvedValueOnce({ count: 1 })
      const newVersion = makeVersion({ versionNumber: 2, isActive: true })
      mockVersion.create.mockResolvedValueOnce(newVersion)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry({ newValue: '2' }))

      const result = await createRecipeVersion(
        RECIPE_ID,
        { recipeId: RECIPE_ID, versionNumber: 2, laborMinutes: 100, isActive: true },
        USER_ID,
      )

      expect(result.versionNumber).toBe(2)
      expect(result.isActive).toBe(true)
      // updateMany must have been called to deactivate other versions
      expect(mockVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ recipeId: RECIPE_ID, isActive: true }),
          data: { isActive: false },
        }),
      )
    })

    it('creates a version with notes and records them in history', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([])
      const newVersion = makeVersion({ notes: 'Initial release' })
      mockVersion.create.mockResolvedValueOnce(newVersion)
      mockHistory.create.mockResolvedValueOnce(
        makeHistoryEntry({ reason: 'Initial release' }),
      )

      await createRecipeVersion(
        RECIPE_ID,
        { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: 90, notes: 'Initial release' },
        USER_ID,
      )

      expect(mockHistory.create).toHaveBeenCalledTimes(1)
      const histCall = mockHistory.create.mock.calls[0][0]
      expect(histCall.data.changeType).toBe('VERSION_CREATED')
      expect(histCall.data.reason).toBe('Initial release')
    })

    it('does NOT call updateMany when isActive=false', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([])
      mockVersion.create.mockResolvedValueOnce(makeVersion())
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      await createRecipeVersion(
        RECIPE_ID,
        { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: 60, isActive: false },
        USER_ID,
      )

      expect(mockVersion.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when recipe does not exist', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce(null)

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: 90 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('version transition validation', () => {
    it('throws ValidationError for duplicate versionNumber', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([
        { versionNumber: 1, isActive: false },
      ])

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: 90 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for non-sequential versionNumber (gap)', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([
        { versionNumber: 1, isActive: false },
      ])

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          { recipeId: RECIPE_ID, versionNumber: 3, laborMinutes: 90 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('deactivates the existing active version and creates new active version', async () => {
      // The service handles deactivation atomically inside the transaction;
      // no ValidationError is thrown — the active conflict is resolved
      // by updateMany before the new version is inserted.
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([
        { versionNumber: 1, isActive: true },
      ])
      mockVersion.updateMany.mockResolvedValueOnce({ count: 1 })
      const newVersion = makeVersion({ versionNumber: 2, isActive: true })
      mockVersion.create.mockResolvedValueOnce(newVersion)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry({ newValue: '2' }))

      const result = await createRecipeVersion(
        RECIPE_ID,
        { recipeId: RECIPE_ID, versionNumber: 2, laborMinutes: 90, isActive: true },
        USER_ID,
      )

      expect(result.versionNumber).toBe(2)
      expect(result.isActive).toBe(true)
      expect(mockVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ recipeId: RECIPE_ID, isActive: true }),
          data: { isActive: false },
        }),
      )
    })

    it('throws ValidationError when first version is not 1', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([])

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          { recipeId: RECIPE_ID, versionNumber: 2, laborMinutes: 90 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError for negative laborMinutes', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([])

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          { recipeId: RECIPE_ID, versionNumber: 1, laborMinutes: -10 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for notes exceeding 500 characters', async () => {
      mockRecipe.findUnique.mockResolvedValueOnce({ id: RECIPE_ID })
      mockVersion.findMany.mockResolvedValueOnce([])

      await expect(
        createRecipeVersion(
          RECIPE_ID,
          {
            recipeId: RECIPE_ID,
            versionNumber: 1,
            laborMinutes: 90,
            notes: 'n'.repeat(501),
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getRecipeVersion
// ============================================================================

describe('getRecipeVersion', () => {
  it('returns version with ingredients when found', async () => {
    const version = makeVersion({ ingredients: [makeIngredient()] })
    mockVersion.findUnique.mockResolvedValueOnce(version)

    const result = await getRecipeVersion(VERSION_ID)

    expect(result).toEqual(version)
    expect(mockVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: VERSION_ID } }),
    )
  })

  it('returns null when version does not exist', async () => {
    mockVersion.findUnique.mockResolvedValueOnce(null)

    const result = await getRecipeVersion('nonexistent-id')
    expect(result).toBeNull()
  })
})

// ============================================================================
// listRecipeVersions
// ============================================================================

describe('listRecipeVersions', () => {
  it('returns versions and total for empty filters (applies defaults)', async () => {
    const versions = [makeVersion()]
    mockVersion.count.mockResolvedValueOnce(1)
    mockVersion.findMany.mockResolvedValueOnce(versions)

    const result = await listRecipeVersions({})
    expect(result.total).toBe(1)
    expect(result.versions).toHaveLength(1)
  })

  it('passes recipeId filter to Prisma', async () => {
    mockVersion.count.mockResolvedValueOnce(0)
    mockVersion.findMany.mockResolvedValueOnce([])

    await listRecipeVersions({ recipeId: RECIPE_ID })

    const whereArg = (mockVersion.count.mock.calls[0][0] as { where?: unknown })?.where
    expect(whereArg).toMatchObject({ recipeId: RECIPE_ID })
  })

  it('passes isActive filter to Prisma', async () => {
    mockVersion.count.mockResolvedValueOnce(0)
    mockVersion.findMany.mockResolvedValueOnce([])

    await listRecipeVersions({ isActive: true })

    const whereArg = (mockVersion.count.mock.calls[0][0] as { where?: unknown })?.where
    expect(whereArg).toMatchObject({ isActive: true })
  })

  it('passes date range filter to Prisma', async () => {
    mockVersion.count.mockResolvedValueOnce(0)
    mockVersion.findMany.mockResolvedValueOnce([])

    const fromDate = new Date('2026-01-01')
    const toDate = new Date('2026-12-31')
    await listRecipeVersions({ fromDate, toDate })

    const whereArg = (mockVersion.count.mock.calls[0][0] as { where?: unknown })
      ?.where as Record<string, unknown>
    expect(whereArg?.createdAt).toMatchObject({ gte: fromDate, lte: toDate })
  })

  it('passes pagination (take / skip) to Prisma', async () => {
    mockVersion.count.mockResolvedValueOnce(100)
    mockVersion.findMany.mockResolvedValueOnce([])

    await listRecipeVersions({ limit: 10, offset: 20 })

    const findManyCall = mockVersion.findMany.mock.calls[0][0] as {
      take?: number
      skip?: number
    }
    expect(findManyCall.take).toBe(10)
    expect(findManyCall.skip).toBe(20)
  })

  it('throws ValidationError for limit greater than 100', async () => {
    await expect(listRecipeVersions({ limit: 999 })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('throws ValidationError for negative offset', async () => {
    await expect(listRecipeVersions({ offset: -1 })).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('throws ValidationError for invalid recipeId (not a CUID)', async () => {
    await expect(
      listRecipeVersions({ recipeId: 'not-a-cuid' }),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// updateRecipeVersion
// ============================================================================

describe('updateRecipeVersion', () => {
  describe('happy path — field updates', () => {
    it('updates laborMinutes and records a history entry', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ laborMinutes: 90, notes: null, isActive: false }),
      )
      mockVersion.updateMany.mockResolvedValueOnce({ count: 0 })
      const updated = makeVersion({ laborMinutes: 120 })
      mockVersion.update.mockResolvedValueOnce(updated)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      const result = await updateRecipeVersion(
        VERSION_ID,
        { laborMinutes: 120 },
        USER_ID,
      )

      expect(result.laborMinutes).toBe(120)
      expect(mockHistory.create).toHaveBeenCalledTimes(1)
      const histCall = mockHistory.create.mock.calls[0][0]
      expect(histCall.data.changeType).toBe('LABOR_MINUTES_UPDATED')
      expect(histCall.data.oldValue).toBe('90')
      expect(histCall.data.newValue).toBe('120')
    })

    it('updates notes and records a history entry', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ laborMinutes: 90, notes: 'old note', isActive: false }),
      )
      mockVersion.updateMany.mockResolvedValueOnce({ count: 0 })
      const updated = makeVersion({ notes: 'new note' })
      mockVersion.update.mockResolvedValueOnce(updated)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      await updateRecipeVersion(VERSION_ID, { notes: 'new note' }, USER_ID)

      const histCall = mockHistory.create.mock.calls[0][0]
      expect(histCall.data.changeType).toBe('NOTES_UPDATED')
      expect(histCall.data.oldValue).toBe('old note')
      expect(histCall.data.newValue).toBe('new note')
    })

    it('records STATUS_CHANGED history entry when isActive changes', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ isActive: false }),
      )
      // No other active versions
      mockVersion.findMany.mockResolvedValueOnce([])
      mockVersion.updateMany.mockResolvedValueOnce({ count: 0 })
      const updated = makeVersion({ isActive: true })
      mockVersion.update.mockResolvedValueOnce(updated)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      await updateRecipeVersion(VERSION_ID, { isActive: true }, USER_ID)

      const histCall = mockHistory.create.mock.calls[0][0]
      expect(histCall.data.changeType).toBe('STATUS_CHANGED')
      expect(histCall.data.oldValue).toBe('false')
      expect(histCall.data.newValue).toBe('true')
    })

    it('does NOT write a history entry when value is unchanged', async () => {
      // laborMinutes is already 90; sending 90 again should produce no history
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ laborMinutes: 90 }),
      )
      mockVersion.updateMany.mockResolvedValueOnce({ count: 0 })
      const updated = makeVersion({ laborMinutes: 90 })
      mockVersion.update.mockResolvedValueOnce(updated)

      await updateRecipeVersion(VERSION_ID, { laborMinutes: 90 }, USER_ID)

      expect(mockHistory.create).not.toHaveBeenCalled()
    })

    it('deactivates other versions when marking this one active', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ isActive: false, recipeId: RECIPE_ID }),
      )
      // Simulate one currently active sibling
      mockVersion.findMany.mockResolvedValueOnce([])
      mockVersion.updateMany.mockResolvedValueOnce({ count: 1 })
      const updated = makeVersion({ isActive: true })
      mockVersion.update.mockResolvedValueOnce(updated)
      mockHistory.create.mockResolvedValueOnce(makeHistoryEntry())

      await updateRecipeVersion(VERSION_ID, { isActive: true }, USER_ID)

      expect(mockVersion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
          data: { isActive: false },
        }),
      )
    })
  })

  describe('not found', () => {
    it('throws NotFoundError when version does not exist', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(null)

      await expect(
        updateRecipeVersion(VERSION_ID, { laborMinutes: 60 }, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('single-active rule enforcement', () => {
    it('throws ValidationError when another version is already active', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ isActive: false, recipeId: RECIPE_ID }),
      )
      // Another version is currently active
      mockVersion.findMany.mockResolvedValueOnce([
        { versionNumber: 1, isActive: true },
      ])

      await expect(
        updateRecipeVersion(VERSION_ID, { isActive: true }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('does NOT throw when making already-active version "active" again', async () => {
      // When the target version is already active, the guard should not trigger
      mockVersion.findUnique.mockResolvedValueOnce(
        makeVersion({ isActive: true, recipeId: RECIPE_ID }),
      )
      mockVersion.updateMany.mockResolvedValueOnce({ count: 0 })
      const updated = makeVersion({ isActive: true })
      mockVersion.update.mockResolvedValueOnce(updated)
      // isActive unchanged → no history entry

      const result = await updateRecipeVersion(
        VERSION_ID,
        { isActive: true },
        USER_ID,
      )

      expect(result.isActive).toBe(true)
      expect(mockHistory.create).not.toHaveBeenCalled()
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError for negative laborMinutes', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(makeVersion())

      await expect(
        updateRecipeVersion(VERSION_ID, { laborMinutes: -5 }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for notes exceeding 500 characters', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(makeVersion())

      await expect(
        updateRecipeVersion(VERSION_ID, { notes: 'n'.repeat(501) }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for non-boolean isActive', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(makeVersion())

      await expect(
        updateRecipeVersion(
          VERSION_ID,
          // @ts-expect-error intentional bad input
          { isActive: 'yes' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// addIngredient
// ============================================================================

describe('addIngredient', () => {
  describe('happy path — rawMaterialId', () => {
    it('creates an ingredient referencing a raw material', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: MATERIAL_ID })
      const expected = makeIngredient()
      mockIngredient.create.mockResolvedValueOnce(expected)

      const result = await addIngredient(
        VERSION_ID,
        {
          recipeVersionId: VERSION_ID,
          rawMaterialId: MATERIAL_ID,
          quantity: 2.5,
          unit: 'kg',
        },
        USER_ID,
      )

      expect(result).toEqual(expected)
      const createCall = mockIngredient.create.mock.calls[0][0]
      expect(createCall.data.rawMaterialId).toBe(MATERIAL_ID)
      expect(createCall.data.intermediateId).toBeNull()
      expect(createCall.data.quantity).toBe(2.5)
      expect(createCall.data.unit).toBe('kg')
    })
  })

  describe('happy path — intermediateProductId', () => {
    it('creates an ingredient referencing an intermediate product', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce({ id: INTERMEDIATE_ID })
      const expected = makeIngredient({
        rawMaterialId: null,
        intermediateId: INTERMEDIATE_ID,
      })
      mockIngredient.create.mockResolvedValueOnce(expected)

      const result = await addIngredient(
        VERSION_ID,
        {
          recipeVersionId: VERSION_ID,
          intermediateProductId: INTERMEDIATE_ID,
          quantity: 1,
          unit: 'pieces',
        },
        USER_ID,
      )

      expect(result.intermediateId).toBe(INTERMEDIATE_ID)
      expect(result.rawMaterialId).toBeNull()
    })
  })

  describe('not found errors', () => {
    it('throws NotFoundError when version does not exist', async () => {
      mockVersion.findUnique.mockResolvedValueOnce(null)

      await expect(
        addIngredient(
          VERSION_ID,
          { recipeVersionId: VERSION_ID, rawMaterialId: MATERIAL_ID, quantity: 1, unit: 'kg' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when rawMaterial does not exist', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce(null)

      await expect(
        addIngredient(
          VERSION_ID,
          { recipeVersionId: VERSION_ID, rawMaterialId: MATERIAL_ID, quantity: 1, unit: 'kg' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('throws NotFoundError when intermediate material does not exist', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })
      mockRawMaterial.findUnique.mockResolvedValueOnce(null)

      await expect(
        addIngredient(
          VERSION_ID,
          {
            recipeVersionId: VERSION_ID,
            intermediateProductId: INTERMEDIATE_ID,
            quantity: 1,
            unit: 'pieces',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('XOR source validation', () => {
    it('throws ValidationError when both rawMaterialId and intermediateProductId are provided', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })

      await expect(
        addIngredient(
          VERSION_ID,
          {
            recipeVersionId: VERSION_ID,
            rawMaterialId: MATERIAL_ID,
            intermediateProductId: INTERMEDIATE_ID,
            quantity: 1,
            unit: 'kg',
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError when neither rawMaterialId nor intermediateProductId is provided', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })

      await expect(
        addIngredient(
          VERSION_ID,
          { recipeVersionId: VERSION_ID, quantity: 1, unit: 'kg' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })

  describe('schema validation failures', () => {
    it('throws ValidationError for zero quantity', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })

      await expect(
        addIngredient(
          VERSION_ID,
          { recipeVersionId: VERSION_ID, rawMaterialId: MATERIAL_ID, quantity: 0, unit: 'kg' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for empty unit', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })

      await expect(
        addIngredient(
          VERSION_ID,
          { recipeVersionId: VERSION_ID, rawMaterialId: MATERIAL_ID, quantity: 1, unit: '' },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('throws ValidationError for unit exceeding 20 characters', async () => {
      mockVersion.findUnique.mockResolvedValueOnce({ id: VERSION_ID })

      await expect(
        addIngredient(
          VERSION_ID,
          {
            recipeVersionId: VERSION_ID,
            rawMaterialId: MATERIAL_ID,
            quantity: 1,
            unit: 'u'.repeat(21),
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })
  })
})

// ============================================================================
// getIngredients
// ============================================================================

describe('getIngredients', () => {
  it('returns all ingredients for a version', async () => {
    const ingredients = [makeIngredient(), makeIngredient({ id: 'another-id', quantity: 1 })]
    mockIngredient.findMany.mockResolvedValueOnce(ingredients)

    const result = await getIngredients(VERSION_ID)

    expect(result).toHaveLength(2)
    expect(mockIngredient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipeVersionId: VERSION_ID } }),
    )
  })

  it('returns an empty array when no ingredients exist', async () => {
    mockIngredient.findMany.mockResolvedValueOnce([])

    const result = await getIngredients(VERSION_ID)
    expect(result).toEqual([])
  })
})

// ============================================================================
// updateIngredient
// ============================================================================

describe('updateIngredient', () => {
  it('updates quantity only', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })
    const updated = makeIngredient({ quantity: 5 })
    mockIngredient.update.mockResolvedValueOnce(updated)

    const result = await updateIngredient(INGREDIENT_ID, { quantity: 5 }, USER_ID)

    expect(result.quantity).toBe(5)
    const updateCall = mockIngredient.update.mock.calls[0][0]
    expect(updateCall.data.quantity).toBe(5)
    expect(updateCall.data.unit).toBeUndefined()
  })

  it('updates unit only', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })
    const updated = makeIngredient({ unit: 'liters' })
    mockIngredient.update.mockResolvedValueOnce(updated)

    await updateIngredient(INGREDIENT_ID, { unit: 'liters' }, USER_ID)

    const updateCall = mockIngredient.update.mock.calls[0][0]
    expect(updateCall.data.unit).toBe('liters')
    expect(updateCall.data.quantity).toBeUndefined()
  })

  it('updates both quantity and unit', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })
    const updated = makeIngredient({ quantity: 3, unit: 'liters' })
    mockIngredient.update.mockResolvedValueOnce(updated)

    const result = await updateIngredient(
      INGREDIENT_ID,
      { quantity: 3, unit: 'liters' },
      USER_ID,
    )

    expect(result.quantity).toBe(3)
    expect(result.unit).toBe('liters')
  })

  it('throws NotFoundError when ingredient does not exist', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce(null)

    await expect(
      updateIngredient(INGREDIENT_ID, { quantity: 1 }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for zero quantity', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })

    await expect(
      updateIngredient(INGREDIENT_ID, { quantity: 0 }, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for empty unit', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })

    await expect(
      updateIngredient(INGREDIENT_ID, { unit: '' }, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError for unit exceeding 20 characters', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })

    await expect(
      updateIngredient(INGREDIENT_ID, { unit: 'u'.repeat(21) }, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// ============================================================================
// removeIngredient
// ============================================================================

describe('removeIngredient', () => {
  it('deletes the ingredient when it exists', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })
    mockIngredient.delete.mockResolvedValueOnce(makeIngredient())

    await removeIngredient(INGREDIENT_ID, USER_ID)

    expect(mockIngredient.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INGREDIENT_ID } }),
    )
  })

  it('throws NotFoundError when ingredient does not exist', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce(null)

    await expect(
      removeIngredient(INGREDIENT_ID, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('returns void (undefined) on success', async () => {
    mockIngredient.findUnique.mockResolvedValueOnce({ id: INGREDIENT_ID })
    mockIngredient.delete.mockResolvedValueOnce(makeIngredient())

    const result = await removeIngredient(INGREDIENT_ID, USER_ID)
    expect(result).toBeUndefined()
  })
})

// ============================================================================
// getRecipeVersionHistory
// ============================================================================

describe('getRecipeVersionHistory', () => {
  it('returns history entries ordered by changeDate DESC (newest first)', async () => {
    const entries = [
      makeHistoryEntry({ changeDate: new Date('2026-03-01') }),
      makeHistoryEntry({ id: 'h2', changeDate: new Date('2026-01-01') }),
    ]
    mockHistory.findMany.mockResolvedValueOnce(entries)

    const result = await getRecipeVersionHistory(VERSION_ID)

    expect(result).toHaveLength(2)
    expect(mockHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipeVersionId: VERSION_ID },
        orderBy: { changeDate: 'desc' },
      }),
    )
  })

  it('returns an empty array when no history exists', async () => {
    mockHistory.findMany.mockResolvedValueOnce([])

    const result = await getRecipeVersionHistory(VERSION_ID)
    expect(result).toEqual([])
  })
})

// ============================================================================
// getRecipeVersions (for diff/comparison)
// ============================================================================

describe('getRecipeVersions', () => {
  it('returns all versions for a recipe ordered by versionNumber ASC', async () => {
    const versions = [
      makeVersion({ versionNumber: 1 }),
      makeVersion({ id: 'v2', versionNumber: 2 }),
      makeVersion({ id: 'v3', versionNumber: 3 }),
    ]
    mockVersion.findMany.mockResolvedValueOnce(versions)

    const result = await getRecipeVersions(RECIPE_ID)

    expect(result).toHaveLength(3)
    expect(mockVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipeId: RECIPE_ID },
        orderBy: { versionNumber: 'asc' },
      }),
    )
  })

  it('returns an empty array when no versions exist', async () => {
    mockVersion.findMany.mockResolvedValueOnce([])

    const result = await getRecipeVersions(RECIPE_ID)
    expect(result).toEqual([])
  })
})
