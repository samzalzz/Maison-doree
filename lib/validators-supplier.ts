import { z } from 'zod'

// ============================================================================
// SUPPLIER VALIDATORS
// ============================================================================

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  contactPerson: z.string().optional(),
  categories: z.array(z.string()).default([]),
})

export const UpdateSupplierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  contactPerson: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  notes: z.string().max(500).optional(),
}).strict()

export const SupplierFiltersSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
}).strict()

// ============================================================================
// SUPPLIER CATALOG VALIDATORS
// ============================================================================

export const CreateCatalogEntrySchema = z.object({
  supplierId: z.string().cuid(),
  materialId: z.string().cuid(),
  unitPrice: z.coerce.number().positive('Price must be positive'),
  minOrderQty: z.coerce.number().int().positive(),
  leadTimeDays: z.coerce.number().int().positive(),
}).strict()

export const UpdateCatalogEntrySchema = z.object({
  unitPrice: z.coerce.number().positive().optional(),
  minOrderQty: z.coerce.number().int().positive().optional(),
  leadTimeDays: z.coerce.number().int().positive().optional(),
}).strict()

// ============================================================================
// PURCHASE ORDER SUGGESTION VALIDATORS
// ============================================================================

export const CreatePOSuggestionSchema = z.object({
  labId: z.string().cuid(),
  materialId: z.string().cuid(),
  suggestedQty: z.coerce.number().positive(),
  reasoning: z.string().min(5).max(200),
}).strict()

export const ApprovePOSuggestionSchema = z.object({
  qtyOverride: z.coerce.number().positive().optional(),
  supplierId: z.string().cuid().optional(),
  approvedBy: z.string().min(1),
}).strict()

export const RejectPOSuggestionSchema = z.object({
  reason: z.string().min(5).max(200),
}).strict()

// ============================================================================
// PURCHASE ORDER VALIDATORS
// ============================================================================

export const ReceivePOSchema = z.object({
  receivedQuantity: z.coerce.number().positive().optional(),
  qualityInspectionId: z.string().cuid().optional(),
}).strict()

export const PurchaseOrderFiltersSchema = z.object({
  status: z.string().optional(),
  supplierId: z.string().cuid().optional(),
  materialId: z.string().cuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
}).strict()

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>
export type SupplierFilters = z.infer<typeof SupplierFiltersSchema>

export type CreateCatalogEntryInput = z.infer<typeof CreateCatalogEntrySchema>
export type UpdateCatalogEntryInput = z.infer<typeof UpdateCatalogEntrySchema>

export type CreatePOSuggestionInput = z.infer<typeof CreatePOSuggestionSchema>
export type ApprovePOSuggestionInput = z.infer<typeof ApprovePOSuggestionSchema>
export type RejectPOSuggestionInput = z.infer<typeof RejectPOSuggestionSchema>

export type ReceivePOInput = z.infer<typeof ReceivePOSchema>
export type PurchaseOrderFilters = z.infer<typeof PurchaseOrderFiltersSchema>
