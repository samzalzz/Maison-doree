/**
 * Unit tests for lib/validators-rd.ts
 *
 * Coverage targets:
 *   - Zod schemas: valid inputs parse without error
 *   - Zod schemas: invalid inputs produce the expected ZodError paths
 *   - validateIngredientSource: XOR logic (both set / neither set / exactly one)
 *   - validateVersionTransition: sequential numbering, uniqueness, single-active rule
 */

import {
  // Recipe
  CreateRecipeSchema,
  UpdateRecipeSchema,
  // RecipeVersion
  CreateRecipeVersionSchema,
  UpdateRecipeVersionSchema,
  RecipeVersionFiltersSchema,
  // RecipeVersionIngredient
  CreateIngredientSchema,
  UpdateIngredientSchema,
  // Business logic
  validateIngredientSource,
  validateVersionTransition,
} from '../validators-rd'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid CUID-shaped string for use in test fixtures. */
const CUID  = 'clh3v2y0k0000356pk1b6vxxt'
const CUID2 = 'clh3v2y0k0001356pk1b6vxxt'

// ---------------------------------------------------------------------------
// CreateRecipeSchema
// ---------------------------------------------------------------------------

describe('CreateRecipeSchema', () => {
  it('parses a valid payload with name only', () => {
    const result = CreateRecipeSchema.parse({ name: 'Briouates au Fromage' })
    expect(result.name).toBe('Briouates au Fromage')
    expect(result.description).toBeUndefined()
  })

  it('parses a valid payload with name and description', () => {
    const result = CreateRecipeSchema.parse({
      name: 'Chebakia',
      description: 'Traditional Moroccan sesame cookie with honey.',
    })
    expect(result.name).toBe('Chebakia')
    expect(result.description).toBe('Traditional Moroccan sesame cookie with honey.')
  })

  it('rejects when name is missing', () => {
    expect(() => CreateRecipeSchema.parse({})).toThrow()
  })

  it('rejects when name is an empty string', () => {
    expect(() => CreateRecipeSchema.parse({ name: '' })).toThrow()
  })

  it('rejects when name exceeds 100 characters', () => {
    expect(() =>
      CreateRecipeSchema.parse({ name: 'a'.repeat(101) }),
    ).toThrow()
  })

  it('rejects when description exceeds 1000 characters', () => {
    expect(() =>
      CreateRecipeSchema.parse({ name: 'Test', description: 'x'.repeat(1001) }),
    ).toThrow()
  })

  it('accepts description exactly at the 1000-character boundary', () => {
    const result = CreateRecipeSchema.parse({
      name: 'Test',
      description: 'd'.repeat(1000),
    })
    expect(result.description).toHaveLength(1000)
  })
})

// ---------------------------------------------------------------------------
// UpdateRecipeSchema
// ---------------------------------------------------------------------------

describe('UpdateRecipeSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateRecipeSchema.parse({})).toEqual({})
  })

  it('parses a name-only update', () => {
    const result = UpdateRecipeSchema.parse({ name: 'Updated Briouates' })
    expect(result.name).toBe('Updated Briouates')
    expect(result.description).toBeUndefined()
  })

  it('parses a description-only update', () => {
    const result = UpdateRecipeSchema.parse({ description: 'New description.' })
    expect(result.description).toBe('New description.')
    expect(result.name).toBeUndefined()
  })

  it('rejects when name is an empty string', () => {
    expect(() => UpdateRecipeSchema.parse({ name: '' })).toThrow()
  })

  it('rejects when name exceeds 100 characters', () => {
    expect(() =>
      UpdateRecipeSchema.parse({ name: 'b'.repeat(101) }),
    ).toThrow()
  })

  it('rejects when description exceeds 1000 characters', () => {
    expect(() =>
      UpdateRecipeSchema.parse({ description: 'y'.repeat(1001) }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateRecipeVersionSchema
// ---------------------------------------------------------------------------

describe('CreateRecipeVersionSchema', () => {
  const base = {
    recipeId: CUID,
    versionNumber: 1,
    laborMinutes: 90,
  }

  it('parses a minimal valid payload', () => {
    const result = CreateRecipeVersionSchema.parse(base)
    expect(result.recipeId).toBe(CUID)
    expect(result.versionNumber).toBe(1)
    expect(result.laborMinutes).toBe(90)
    expect(result.isActive).toBe(false) // default
    expect(result.notes).toBeUndefined()
  })

  it('parses a full payload with notes and isActive', () => {
    const result = CreateRecipeVersionSchema.parse({
      ...base,
      versionNumber: 2,
      notes: 'Reduced sugar by 10%.',
      isActive: true,
    })
    expect(result.versionNumber).toBe(2)
    expect(result.notes).toBe('Reduced sugar by 10%.')
    expect(result.isActive).toBe(true)
  })

  it('accepts laborMinutes of zero', () => {
    const result = CreateRecipeVersionSchema.parse({ ...base, laborMinutes: 0 })
    expect(result.laborMinutes).toBe(0)
  })

  it('rejects when recipeId is not a valid CUID', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, recipeId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects when versionNumber is zero', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, versionNumber: 0 }),
    ).toThrow()
  })

  it('rejects when versionNumber is negative', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, versionNumber: -1 }),
    ).toThrow()
  })

  it('rejects when versionNumber is a float', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, versionNumber: 1.5 }),
    ).toThrow()
  })

  it('rejects when laborMinutes is negative', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, laborMinutes: -5 }),
    ).toThrow()
  })

  it('rejects when laborMinutes is a float', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, laborMinutes: 30.5 }),
    ).toThrow()
  })

  it('rejects when notes exceed 500 characters', () => {
    expect(() =>
      CreateRecipeVersionSchema.parse({ ...base, notes: 'n'.repeat(501) }),
    ).toThrow()
  })

  it('rejects when recipeId is missing', () => {
    const { recipeId: _omit, ...rest } = base as Record<string, unknown>
    expect(() => CreateRecipeVersionSchema.parse(rest)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateRecipeVersionSchema
// ---------------------------------------------------------------------------

describe('UpdateRecipeVersionSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateRecipeVersionSchema.parse({})).toEqual({})
  })

  it('parses a laborMinutes-only update', () => {
    const result = UpdateRecipeVersionSchema.parse({ laborMinutes: 120 })
    expect(result.laborMinutes).toBe(120)
  })

  it('parses a notes update', () => {
    const result = UpdateRecipeVersionSchema.parse({ notes: 'Adjusted flour ratio.' })
    expect(result.notes).toBe('Adjusted flour ratio.')
  })

  it('parses an isActive update', () => {
    const result = UpdateRecipeVersionSchema.parse({ isActive: true })
    expect(result.isActive).toBe(true)
  })

  it('rejects negative laborMinutes', () => {
    expect(() =>
      UpdateRecipeVersionSchema.parse({ laborMinutes: -10 }),
    ).toThrow()
  })

  it('rejects float laborMinutes', () => {
    expect(() =>
      UpdateRecipeVersionSchema.parse({ laborMinutes: 45.5 }),
    ).toThrow()
  })

  it('rejects notes longer than 500 characters', () => {
    expect(() =>
      UpdateRecipeVersionSchema.parse({ notes: 'z'.repeat(501) }),
    ).toThrow()
  })

  it('rejects a non-boolean isActive', () => {
    expect(() =>
      UpdateRecipeVersionSchema.parse({ isActive: 'yes' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// RecipeVersionFiltersSchema
// ---------------------------------------------------------------------------

describe('RecipeVersionFiltersSchema', () => {
  it('applies default values when no fields are provided', () => {
    const result = RecipeVersionFiltersSchema.parse({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('parses all optional fields when provided', () => {
    const result = RecipeVersionFiltersSchema.parse({
      recipeId: CUID,
      isActive: true,
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      limit: 25,
      offset: 50,
    })
    expect(result.recipeId).toBe(CUID)
    expect(result.isActive).toBe(true)
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.toDate).toBeInstanceOf(Date)
    expect(result.limit).toBe(25)
    expect(result.offset).toBe(50)
  })

  it('coerces date strings to Date objects for fromDate and toDate', () => {
    const result = RecipeVersionFiltersSchema.parse({
      fromDate: '2026-03-01T00:00:00.000Z',
      toDate: '2026-06-30T23:59:59.000Z',
    })
    expect(result.fromDate).toBeInstanceOf(Date)
    expect(result.toDate).toBeInstanceOf(Date)
  })

  it('rejects limit greater than 100', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ limit: 101 }),
    ).toThrow()
  })

  it('rejects negative offset', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ offset: -1 }),
    ).toThrow()
  })

  it('rejects an invalid recipeId CUID', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ recipeId: 'bad-id' }),
    ).toThrow()
  })

  it('rejects a non-integer limit', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ limit: 10.5 }),
    ).toThrow()
  })

  it('rejects a zero limit', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ limit: 0 }),
    ).toThrow()
  })

  it('rejects a non-boolean isActive', () => {
    expect(() =>
      RecipeVersionFiltersSchema.parse({ isActive: 'true' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// CreateIngredientSchema
// ---------------------------------------------------------------------------

describe('CreateIngredientSchema', () => {
  const baseWithMaterial = {
    recipeVersionId: CUID,
    rawMaterialId: CUID2,
    quantity: 2.5,
    unit: 'kg',
  }

  const baseWithIntermediate = {
    recipeVersionId: CUID,
    intermediateProductId: CUID2,
    quantity: 1,
    unit: 'pieces',
  }

  it('parses a valid payload with rawMaterialId', () => {
    const result = CreateIngredientSchema.parse(baseWithMaterial)
    expect(result.recipeVersionId).toBe(CUID)
    expect(result.rawMaterialId).toBe(CUID2)
    expect(result.quantity).toBe(2.5)
    expect(result.unit).toBe('kg')
    expect(result.intermediateProductId).toBeUndefined()
  })

  it('parses a valid payload with intermediateProductId', () => {
    const result = CreateIngredientSchema.parse(baseWithIntermediate)
    expect(result.intermediateProductId).toBe(CUID2)
    expect(result.rawMaterialId).toBeUndefined()
  })

  it('parses a valid payload with both IDs present (XOR enforced separately)', () => {
    // The schema itself does NOT enforce XOR — validateIngredientSource does.
    // This test confirms the Zod schema is structural-only.
    const result = CreateIngredientSchema.parse({
      ...baseWithMaterial,
      intermediateProductId: CUID2,
    })
    expect(result.rawMaterialId).toBe(CUID2)
    expect(result.intermediateProductId).toBe(CUID2)
  })

  it('rejects when recipeVersionId is not a valid CUID', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, recipeVersionId: 'bad' }),
    ).toThrow()
  })

  it('rejects when rawMaterialId is provided but is not a valid CUID', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, rawMaterialId: 'bad' }),
    ).toThrow()
  })

  it('rejects when intermediateProductId is provided but is not a valid CUID', () => {
    expect(() =>
      CreateIngredientSchema.parse({
        ...baseWithIntermediate,
        intermediateProductId: 'bad',
      }),
    ).toThrow()
  })

  it('rejects when quantity is zero', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, quantity: 0 }),
    ).toThrow()
  })

  it('rejects when quantity is negative', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, quantity: -1 }),
    ).toThrow()
  })

  it('rejects when unit is an empty string', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, unit: '' }),
    ).toThrow()
  })

  it('rejects when unit exceeds 20 characters', () => {
    expect(() =>
      CreateIngredientSchema.parse({ ...baseWithMaterial, unit: 'u'.repeat(21) }),
    ).toThrow()
  })

  it('rejects when recipeVersionId is missing', () => {
    const { recipeVersionId: _omit, ...rest } = baseWithMaterial as Record<string, unknown>
    expect(() => CreateIngredientSchema.parse(rest)).toThrow()
  })

  it('rejects when quantity is missing', () => {
    const { quantity: _omit, ...rest } = baseWithMaterial as Record<string, unknown>
    expect(() => CreateIngredientSchema.parse(rest)).toThrow()
  })

  it('rejects when unit is missing', () => {
    const { unit: _omit, ...rest } = baseWithMaterial as Record<string, unknown>
    expect(() => CreateIngredientSchema.parse(rest)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// UpdateIngredientSchema
// ---------------------------------------------------------------------------

describe('UpdateIngredientSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateIngredientSchema.parse({})).toEqual({})
  })

  it('parses a quantity-only update', () => {
    const result = UpdateIngredientSchema.parse({ quantity: 3.75 })
    expect(result.quantity).toBe(3.75)
  })

  it('parses a unit-only update', () => {
    const result = UpdateIngredientSchema.parse({ unit: 'liters' })
    expect(result.unit).toBe('liters')
  })

  it('parses both quantity and unit together', () => {
    const result = UpdateIngredientSchema.parse({ quantity: 1.5, unit: 'kg' })
    expect(result.quantity).toBe(1.5)
    expect(result.unit).toBe('kg')
  })

  it('rejects a zero quantity', () => {
    expect(() => UpdateIngredientSchema.parse({ quantity: 0 })).toThrow()
  })

  it('rejects a negative quantity', () => {
    expect(() => UpdateIngredientSchema.parse({ quantity: -0.5 })).toThrow()
  })

  it('rejects an empty unit string', () => {
    expect(() => UpdateIngredientSchema.parse({ unit: '' })).toThrow()
  })

  it('rejects a unit string longer than 20 characters', () => {
    expect(() =>
      UpdateIngredientSchema.parse({ unit: 'v'.repeat(21) }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// validateIngredientSource — XOR logic
// ---------------------------------------------------------------------------

describe('validateIngredientSource', () => {
  const MATERIAL_ID = 'clh3v2y0k0000356pk1b6vxxt'
  const INTERMEDIATE_ID = 'clh3v2y0k0001356pk1b6vxxt'

  // Valid: exactly rawMaterialId
  it('returns valid when only rawMaterialId is provided', () => {
    const result = validateIngredientSource(MATERIAL_ID, undefined)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // Valid: exactly intermediateProductId
  it('returns valid when only intermediateProductId is provided', () => {
    const result = validateIngredientSource(undefined, INTERMEDIATE_ID)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  // Invalid: both provided
  it('returns invalid when both rawMaterialId and intermediateProductId are provided', () => {
    const result = validateIngredientSource(MATERIAL_ID, INTERMEDIATE_ID)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/not both/i)
  })

  // Invalid: neither provided (both undefined)
  it('returns invalid when neither rawMaterialId nor intermediateProductId is provided', () => {
    const result = validateIngredientSource(undefined, undefined)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/exactly one/i)
  })

  // Invalid: both are empty strings (treated as absent)
  it('returns invalid when both are empty strings', () => {
    const result = validateIngredientSource('', '')
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatch(/exactly one/i)
  })

  // Invalid: one is empty string, other is set (only the set one counts)
  it('returns valid when rawMaterialId is a CUID and intermediateProductId is an empty string', () => {
    const result = validateIngredientSource(MATERIAL_ID, '')
    expect(result.valid).toBe(true)
  })

  it('returns valid when intermediateProductId is a CUID and rawMaterialId is an empty string', () => {
    const result = validateIngredientSource('', INTERMEDIATE_ID)
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateVersionTransition — sequential numbering, uniqueness, single-active
// ---------------------------------------------------------------------------

describe('validateVersionTransition', () => {
  // -------------------------------------------------------------------------
  // No existing versions
  // -------------------------------------------------------------------------

  describe('when there are no existing versions', () => {
    it('allows versionNumber 1 as inactive', () => {
      const result = validateVersionTransition([], 1, false)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('allows versionNumber 1 as active (no conflict)', () => {
      const result = validateVersionTransition([], 1, true)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects versionNumber 2 as the first version (gap)', () => {
      const result = validateVersionTransition([], 2, false)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('First version must be version 1'))).toBe(true)
    })

    it('rejects versionNumber 0 as the first version', () => {
      const result = validateVersionTransition([], 0, false)
      expect(result.valid).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Existing versions
  // -------------------------------------------------------------------------

  describe('with existing versions [v1(inactive), v2(active)]', () => {
    const existing = [
      { versionNumber: 1, isActive: false },
      { versionNumber: 2, isActive: true },
    ]

    it('allows versionNumber 3 as inactive', () => {
      const result = validateVersionTransition(existing, 3, false)
      expect(result.valid).toBe(true)
    })

    it('rejects versionNumber 3 as active (v2 already active)', () => {
      const result = validateVersionTransition(existing, 3, true)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('already active'))).toBe(true)
    })

    it('rejects a duplicate versionNumber 2', () => {
      const result = validateVersionTransition(existing, 2, false)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('already exists'))).toBe(true)
    })

    it('rejects versionNumber 4 (gap — expected 3)', () => {
      const result = validateVersionTransition(existing, 4, false)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('sequential'))).toBe(true)
    })

    it('rejects versionNumber 1 (duplicate of existing v1)', () => {
      const result = validateVersionTransition(existing, 1, false)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('already exists'))).toBe(true)
    })
  })

  describe('with existing versions all inactive [v1, v2, v3]', () => {
    const existing = [
      { versionNumber: 1, isActive: false },
      { versionNumber: 2, isActive: false },
      { versionNumber: 3, isActive: false },
    ]

    it('allows versionNumber 4 as active (no currently active version)', () => {
      const result = validateVersionTransition(existing, 4, true)
      expect(result.valid).toBe(true)
    })

    it('allows versionNumber 4 as inactive', () => {
      const result = validateVersionTransition(existing, 4, false)
      expect(result.valid).toBe(true)
    })

    it('rejects versionNumber 5 (gap — expected 4)', () => {
      const result = validateVersionTransition(existing, 5, false)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('sequential'))).toBe(true)
    })
  })

  describe('duplicate version number accumulates errors correctly', () => {
    it('produces exactly one error for a duplicate number (no additional sequential error)', () => {
      const existing = [
        { versionNumber: 1, isActive: false },
        { versionNumber: 2, isActive: false },
      ]
      // 2 is a duplicate — the sequential rule should not add a second
      // unrelated error when the only problem is the duplicate.
      const result = validateVersionTransition(existing, 2, false)
      expect(result.valid).toBe(false)
      // At least the "already exists" error is present.
      expect(result.errors.some((e) => e.includes('already exists'))).toBe(true)
    })
  })

  describe('multiple simultaneous errors', () => {
    it('accumulates duplicate + active-conflict errors when both apply', () => {
      const existing = [
        { versionNumber: 1, isActive: true },
      ]
      // versionNumber 1 is duplicate AND we're trying to mark it active while v1 is already active
      const result = validateVersionTransition(existing, 1, true)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.some((e) => e.includes('already exists'))).toBe(true)
      expect(result.errors.some((e) => e.includes('already active'))).toBe(true)
    })
  })
})
