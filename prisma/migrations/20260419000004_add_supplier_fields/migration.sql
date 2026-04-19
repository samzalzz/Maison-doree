-- Migration: add_supplier_fields
-- Date: 2026-04-19
-- Description: Add missing columns to Supplier table (address, city, contactPerson, status, notes)

-- ============================================================================
-- ADD MISSING COLUMNS TO SUPPLIER TABLE
-- ============================================================================

ALTER TABLE "Supplier" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "contactPerson" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Supplier" ADD COLUMN "notes" TEXT;

-- Remove defaults after adding columns (optional, for cleaner schema)
ALTER TABLE "Supplier" ALTER COLUMN "address" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "city" DROP DEFAULT;
ALTER TABLE "Supplier" ALTER COLUMN "contactPerson" DROP DEFAULT;
