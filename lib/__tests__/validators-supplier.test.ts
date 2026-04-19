/**
 * Unit tests for lib/validators-supplier.ts
 *
 * Coverage targets:
 *   - CreateSupplierSchema: missing name (fail), invalid email (fail), valid input (pass)
 *   - UpdateSupplierSchema: unknown key rejected (strict), valid partial update (pass)
 *   - SupplierFiltersSchema: defaults applied, invalid status rejected, limit ceiling enforced
 *   - CreateCatalogEntrySchema: negative price (fail), zero minOrderQty (fail), valid input (pass)
 *   - UpdateCatalogEntrySchema: partial update (pass), non-positive price (fail)
 *   - CreatePOSuggestionSchema: reasoning too short (fail), valid input (pass)
 *   - ApprovePOSuggestionSchema: negative qtyOverride (fail), positive qtyOverride (pass), approvedBy missing (fail)
 *   - RejectPOSuggestionSchema: reason too short (fail), valid reason (pass)
 *   - ReceivePOSchema: negative receivedQuantity (fail), valid input (pass)
 *   - PurchaseOrderFiltersSchema: defaults applied, invalid supplierId CUID (fail), limit ceiling enforced
 */

import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  SupplierFiltersSchema,
  CreateCatalogEntrySchema,
  UpdateCatalogEntrySchema,
  CreatePOSuggestionSchema,
  ApprovePOSuggestionSchema,
  RejectPOSuggestionSchema,
  ReceivePOSchema,
  PurchaseOrderFiltersSchema,
} from '../validators-supplier'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid CUID-shaped string for use in test fixtures. */
const CUID  = 'clh3v2y0k0000356pk1b6vxxt'
const CUID2 = 'clh3v2y0k0001356pk1b6vxxt'

// ============================================================================
// CreateSupplierSchema
// ============================================================================

describe('CreateSupplierSchema', () => {
  it('parses a valid input with all fields', () => {
    const result = CreateSupplierSchema.parse({
      name: 'Acme Supplies',
      email: 'acme@example.com',
      phone: '+1-800-000-0000',
      address: '1 Supply Lane',
      city: 'Sourceville',
      contactPerson: 'Alice',
      categories: ['FRAGRANCE', 'WAX'],
    })
    expect(result.name).toBe('Acme Supplies')
    expect(result.email).toBe('acme@example.com')
    expect(result.categories).toEqual(['FRAGRANCE', 'WAX'])
  })

  it('applies default empty array for categories when omitted', () => {
    const result = CreateSupplierSchema.parse({ name: 'Minimal Supplier' })
    expect(result.categories).toEqual([])
  })

  it('rejects when name is missing', () => {
    expect(() => CreateSupplierSchema.parse({ email: 'x@example.com' })).toThrow()
  })

  it('rejects when name is an empty string', () => {
    expect(() => CreateSupplierSchema.parse({ name: '' })).toThrow()
  })

  it('rejects when name exceeds 100 characters', () => {
    expect(() =>
      CreateSupplierSchema.parse({ name: 'x'.repeat(101) }),
    ).toThrow()
  })

  it('rejects an invalid email address', () => {
    expect(() =>
      CreateSupplierSchema.parse({ name: 'Supplier X', email: 'not-an-email' }),
    ).toThrow()
  })

  it('accepts when email is omitted entirely (optional)', () => {
    const result = CreateSupplierSchema.parse({ name: 'No Email Co' })
    expect(result.email).toBeUndefined()
  })
})

// ============================================================================
// UpdateSupplierSchema
// ============================================================================

describe('UpdateSupplierSchema', () => {
  it('parses an empty object (all fields are optional)', () => {
    const result = UpdateSupplierSchema.parse({})
    expect(result).toEqual({})
  })

  it('parses a partial update with a valid status', () => {
    const result = UpdateSupplierSchema.parse({ status: 'INACTIVE' })
    expect(result.status).toBe('INACTIVE')
  })

  it('rejects an unknown status value', () => {
    expect(() => UpdateSupplierSchema.parse({ status: 'SUSPENDED' })).toThrow()
  })

  it('rejects unknown keys (strict schema)', () => {
    expect(() =>
      UpdateSupplierSchema.parse({ name: 'Valid', unknownField: 'bad' }),
    ).toThrow()
  })

  it('rejects notes exceeding 500 characters', () => {
    expect(() =>
      UpdateSupplierSchema.parse({ notes: 'n'.repeat(501) }),
    ).toThrow()
  })
})

// ============================================================================
// SupplierFiltersSchema
// ============================================================================

describe('SupplierFiltersSchema', () => {
  it('applies default page=1 and limit=20 when no fields provided', () => {
    const result = SupplierFiltersSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('parses a valid status filter', () => {
    const result = SupplierFiltersSchema.parse({ status: 'BLOCKED' })
    expect(result.status).toBe('BLOCKED')
  })

  it('rejects an invalid status value', () => {
    expect(() => SupplierFiltersSchema.parse({ status: 'PENDING' })).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() => SupplierFiltersSchema.parse({ limit: 101 })).toThrow()
  })

  it('rejects a non-positive page number', () => {
    expect(() => SupplierFiltersSchema.parse({ page: 0 })).toThrow()
  })
})

// ============================================================================
// CreateCatalogEntrySchema
// ============================================================================

describe('CreateCatalogEntrySchema', () => {
  const validBase = {
    supplierId: CUID,
    materialId: CUID2,
    unitPrice: 25.5,
    minOrderQty: 10,
    leadTimeDays: 7,
  }

  it('parses a valid catalog entry', () => {
    const result = CreateCatalogEntrySchema.parse(validBase)
    expect(result.unitPrice).toBe(25.5)
    expect(result.minOrderQty).toBe(10)
    expect(result.leadTimeDays).toBe(7)
  })

  it('coerces string numbers to numeric values', () => {
    const result = CreateCatalogEntrySchema.parse({
      ...validBase,
      unitPrice: '12.50',
      minOrderQty: '5',
      leadTimeDays: '3',
    })
    expect(result.unitPrice).toBe(12.5)
    expect(result.minOrderQty).toBe(5)
  })

  it('rejects a negative unit price', () => {
    expect(() =>
      CreateCatalogEntrySchema.parse({ ...validBase, unitPrice: -1 }),
    ).toThrow()
  })

  it('rejects zero unit price', () => {
    expect(() =>
      CreateCatalogEntrySchema.parse({ ...validBase, unitPrice: 0 }),
    ).toThrow()
  })

  it('rejects zero minOrderQty', () => {
    expect(() =>
      CreateCatalogEntrySchema.parse({ ...validBase, minOrderQty: 0 }),
    ).toThrow()
  })

  it('rejects when minOrderQty is missing', () => {
    const { minOrderQty: _omit, ...rest } = validBase as Record<string, unknown>
    expect(() => CreateCatalogEntrySchema.parse(rest)).toThrow()
  })

  it('rejects supplierId that is not a valid CUID', () => {
    expect(() =>
      CreateCatalogEntrySchema.parse({ ...validBase, supplierId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects materialId that is not a valid CUID', () => {
    expect(() =>
      CreateCatalogEntrySchema.parse({ ...validBase, materialId: 'bad-id' }),
    ).toThrow()
  })
})

// ============================================================================
// UpdateCatalogEntrySchema
// ============================================================================

describe('UpdateCatalogEntrySchema', () => {
  it('parses an empty object (all fields optional)', () => {
    expect(UpdateCatalogEntrySchema.parse({})).toEqual({})
  })

  it('parses a partial update with only unitPrice', () => {
    const result = UpdateCatalogEntrySchema.parse({ unitPrice: 30 })
    expect(result.unitPrice).toBe(30)
  })

  it('rejects a non-positive unitPrice', () => {
    expect(() => UpdateCatalogEntrySchema.parse({ unitPrice: 0 })).toThrow()
  })

  it('rejects unknown keys (strict schema)', () => {
    expect(() =>
      UpdateCatalogEntrySchema.parse({ unitPrice: 10, unknownKey: true }),
    ).toThrow()
  })
})

// ============================================================================
// CreatePOSuggestionSchema
// ============================================================================

describe('CreatePOSuggestionSchema', () => {
  const validBase = {
    labId: CUID,
    materialId: CUID2,
    suggestedQty: 50,
    reasoning: 'Stock below minimum threshold',
  }

  it('parses a valid PO suggestion input', () => {
    const result = CreatePOSuggestionSchema.parse(validBase)
    expect(result.labId).toBe(CUID)
    expect(result.suggestedQty).toBe(50)
    expect(result.reasoning).toBe('Stock below minimum threshold')
  })

  it('rejects when reasoning is too short (< 5 characters)', () => {
    expect(() =>
      CreatePOSuggestionSchema.parse({ ...validBase, reasoning: 'low' }),
    ).toThrow()
  })

  it('rejects when reasoning exceeds 200 characters', () => {
    expect(() =>
      CreatePOSuggestionSchema.parse({ ...validBase, reasoning: 'x'.repeat(201) }),
    ).toThrow()
  })

  it('rejects a non-positive suggestedQty', () => {
    expect(() =>
      CreatePOSuggestionSchema.parse({ ...validBase, suggestedQty: 0 }),
    ).toThrow()
  })

  it('rejects when labId is not a valid CUID', () => {
    expect(() =>
      CreatePOSuggestionSchema.parse({ ...validBase, labId: 'bad-lab' }),
    ).toThrow()
  })
})

// ============================================================================
// ApprovePOSuggestionSchema
// ============================================================================

describe('ApprovePOSuggestionSchema', () => {
  it('parses a valid approval with required approvedBy only', () => {
    const result = ApprovePOSuggestionSchema.parse({ approvedBy: 'user-admin-001' })
    expect(result.approvedBy).toBe('user-admin-001')
    expect(result.qtyOverride).toBeUndefined()
    expect(result.supplierId).toBeUndefined()
  })

  it('parses a valid approval with positive qtyOverride', () => {
    const result = ApprovePOSuggestionSchema.parse({
      approvedBy: 'user-admin-001',
      qtyOverride: 75,
    })
    expect(result.qtyOverride).toBe(75)
  })

  it('parses a valid approval with supplierId override', () => {
    const result = ApprovePOSuggestionSchema.parse({
      approvedBy: 'user-admin-001',
      supplierId: CUID,
    })
    expect(result.supplierId).toBe(CUID)
  })

  it('rejects a negative qtyOverride', () => {
    expect(() =>
      ApprovePOSuggestionSchema.parse({ approvedBy: 'admin', qtyOverride: -5 }),
    ).toThrow()
  })

  it('rejects zero qtyOverride', () => {
    expect(() =>
      ApprovePOSuggestionSchema.parse({ approvedBy: 'admin', qtyOverride: 0 }),
    ).toThrow()
  })

  it('rejects when approvedBy is missing', () => {
    expect(() => ApprovePOSuggestionSchema.parse({ qtyOverride: 10 })).toThrow()
  })

  it('rejects when approvedBy is an empty string', () => {
    expect(() =>
      ApprovePOSuggestionSchema.parse({ approvedBy: '' }),
    ).toThrow()
  })

  it('rejects supplierId that is not a valid CUID', () => {
    expect(() =>
      ApprovePOSuggestionSchema.parse({ approvedBy: 'admin', supplierId: 'not-a-cuid' }),
    ).toThrow()
  })
})

// ============================================================================
// RejectPOSuggestionSchema
// ============================================================================

describe('RejectPOSuggestionSchema', () => {
  it('parses a valid rejection reason', () => {
    const result = RejectPOSuggestionSchema.parse({ reason: 'Budget freeze for Q2' })
    expect(result.reason).toBe('Budget freeze for Q2')
  })

  it('rejects when reason is too short (< 5 characters)', () => {
    expect(() => RejectPOSuggestionSchema.parse({ reason: 'No' })).toThrow()
  })

  it('rejects when reason exceeds 200 characters', () => {
    expect(() =>
      RejectPOSuggestionSchema.parse({ reason: 'r'.repeat(201) }),
    ).toThrow()
  })

  it('rejects when reason is missing', () => {
    expect(() => RejectPOSuggestionSchema.parse({})).toThrow()
  })
})

// ============================================================================
// ReceivePOSchema
// ============================================================================

describe('ReceivePOSchema', () => {
  it('parses an empty object (all fields optional)', () => {
    const result = ReceivePOSchema.parse({})
    expect(result.receivedQuantity).toBeUndefined()
    expect(result.qualityInspectionId).toBeUndefined()
  })

  it('parses a valid receivedQuantity', () => {
    const result = ReceivePOSchema.parse({ receivedQuantity: 40 })
    expect(result.receivedQuantity).toBe(40)
  })

  it('coerces a string receivedQuantity to a number', () => {
    const result = ReceivePOSchema.parse({ receivedQuantity: '30' })
    expect(result.receivedQuantity).toBe(30)
  })

  it('rejects a negative receivedQuantity', () => {
    expect(() => ReceivePOSchema.parse({ receivedQuantity: -1 })).toThrow()
  })

  it('rejects zero receivedQuantity', () => {
    expect(() => ReceivePOSchema.parse({ receivedQuantity: 0 })).toThrow()
  })

  it('rejects qualityInspectionId that is not a valid CUID', () => {
    expect(() =>
      ReceivePOSchema.parse({ qualityInspectionId: 'bad-id' }),
    ).toThrow()
  })
})

// ============================================================================
// PurchaseOrderFiltersSchema
// ============================================================================

describe('PurchaseOrderFiltersSchema', () => {
  it('applies default page=1 and limit=20 when no fields provided', () => {
    const result = PurchaseOrderFiltersSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('parses a valid supplierId filter', () => {
    const result = PurchaseOrderFiltersSchema.parse({ supplierId: CUID })
    expect(result.supplierId).toBe(CUID)
  })

  it('rejects supplierId that is not a valid CUID', () => {
    expect(() =>
      PurchaseOrderFiltersSchema.parse({ supplierId: 'not-a-cuid' }),
    ).toThrow()
  })

  it('rejects limit greater than 100', () => {
    expect(() => PurchaseOrderFiltersSchema.parse({ limit: 101 })).toThrow()
  })

  it('rejects a non-positive page number', () => {
    expect(() => PurchaseOrderFiltersSchema.parse({ page: 0 })).toThrow()
  })

  it('accepts an optional status string filter', () => {
    const result = PurchaseOrderFiltersSchema.parse({ status: 'PENDING' })
    expect(result.status).toBe('PENDING')
  })
})
