-- Migration: add_production_management
-- Date: 2026-04-18
-- Description: Production management system — labs, machines, recipes, materials, suppliers, and purchase orders

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE "LabType" AS ENUM ('PREPARATION', 'ASSEMBLY', 'FINISHING');
CREATE TYPE "ProductionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- ProductionLab ----------------------------------------------------------

CREATE TABLE "ProductionLab" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "type"      "LabType" NOT NULL,
  "capacity"  INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductionLab_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionLab_type_idx" ON "ProductionLab"("type");

-- LabEmployee -----------------------------------------------------------

CREATE TABLE "LabEmployee" (
  "id"             TEXT NOT NULL,
  "labId"          TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "role"           TEXT NOT NULL,
  "availableHours" INTEGER NOT NULL,

  CONSTRAINT "LabEmployee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LabEmployee_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LabEmployee_labId_idx" ON "LabEmployee"("labId");

-- Machine ---------------------------------------------------------------

CREATE TABLE "Machine" (
  "id"               TEXT NOT NULL,
  "labId"            TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "batchCapacity"    INTEGER NOT NULL,
  "cycleTimeMinutes" INTEGER NOT NULL,
  "available"        BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "Machine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Machine_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Machine_labId_idx" ON "Machine"("labId");

-- RawMaterial -----------------------------------------------------------

CREATE TABLE "RawMaterial" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "type"               TEXT NOT NULL,
  "isIntermediate"     BOOLEAN NOT NULL DEFAULT false,
  "unit"               TEXT NOT NULL,
  "productionRecipeId" TEXT,

  CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RawMaterial_name_type_key" UNIQUE ("name", "type")
);

CREATE INDEX "RawMaterial_isIntermediate_idx" ON "RawMaterial"("isIntermediate");

-- Recipe ----------------------------------------------------------------

CREATE TABLE "Recipe" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "laborMinutes" INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- RecipeIngredient -------------------------------------------------------

CREATE TABLE "RecipeIngredient" (
  "id"                    TEXT NOT NULL,
  "recipeId"              TEXT NOT NULL,
  "rawMaterialId"         TEXT,
  "intermediateProductId" TEXT,
  "quantity"              DECIMAL(10, 2) NOT NULL,
  "unit"                  TEXT NOT NULL,

  CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeIngredient_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeIngredient_rawMaterialId_fkey"
    FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RecipeIngredient_intermediateProductId_fkey"
    FOREIGN KEY ("intermediateProductId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- LabStock ---------------------------------------------------------------

CREATE TABLE "LabStock" (
  "id"           TEXT NOT NULL,
  "labId"        TEXT NOT NULL,
  "materialId"   TEXT NOT NULL,
  "quantity"     DECIMAL(10, 2) NOT NULL,
  "minThreshold" DECIMAL(10, 2) NOT NULL,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LabStock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LabStock_labId_materialId_key" UNIQUE ("labId", "materialId"),
  CONSTRAINT "LabStock_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LabStock_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LabStock_labId_idx" ON "LabStock"("labId");

-- ProductionBatch -------------------------------------------------------

CREATE TABLE "ProductionBatch" (
  "id"                      TEXT NOT NULL,
  "batchNumber"             TEXT NOT NULL UNIQUE,
  "labId"                   TEXT NOT NULL,
  "recipeId"                TEXT NOT NULL,
  "machineId"               TEXT,
  "employeeId"              TEXT,
  "quantity"                INTEGER NOT NULL,
  "status"                  "ProductionStatus" NOT NULL DEFAULT 'PLANNED',
  "plannedStartTime"        TIMESTAMP(3) NOT NULL,
  "actualStartTime"         TIMESTAMP(3),
  "estimatedCompletionTime" TIMESTAMP(3),
  "actualCompletionTime"    TIMESTAMP(3),
  "createdBy"               TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductionBatch_labId_fkey"
    FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductionBatch_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON UPDATE CASCADE,
  CONSTRAINT "ProductionBatch_machineId_fkey"
    FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ProductionBatch_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "LabEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProductionBatch_labId_idx" ON "ProductionBatch"("labId");
CREATE INDEX "ProductionBatch_recipeId_idx" ON "ProductionBatch"("recipeId");
CREATE INDEX "ProductionBatch_status_idx" ON "ProductionBatch"("status");
CREATE INDEX "ProductionBatch_plannedStartTime_idx" ON "ProductionBatch"("plannedStartTime");
CREATE INDEX "ProductionBatch_createdBy_idx" ON "ProductionBatch"("createdBy");
CREATE INDEX "ProductionBatch_labId_status_idx" ON "ProductionBatch"("labId", "status");

-- BatchItem ---------------------------------------------------------------

CREATE TABLE "BatchItem" (
  "id"          TEXT NOT NULL,
  "batchId"     TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity"    INTEGER NOT NULL,
  "status"      TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BatchItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BatchItem_batchId_idx" ON "BatchItem"("batchId");

-- DailyForecast ---------------------------------------------------------

CREATE TABLE "DailyForecast" (
  "id"                    TEXT NOT NULL,
  "date"                  DATE NOT NULL,
  "recipeId"              TEXT NOT NULL,
  "predictedQuantity"     INTEGER NOT NULL,
  "confidence"            INTEGER NOT NULL,
  "reasoning"             TEXT,
  "sevenDayAverage"       INTEGER,
  "fourteenDayAverage"    INTEGER,
  "thirtyDayAverage"      INTEGER,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyForecast_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyForecast_date_recipeId_key" UNIQUE ("date", "recipeId"),
  CONSTRAINT "DailyForecast_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DailyForecast_date_idx" ON "DailyForecast"("date");
CREATE INDEX "DailyForecast_recipeId_idx" ON "DailyForecast"("recipeId");

-- TransferSuggestion ---------------------------------------------------

CREATE TABLE "TransferSuggestion" (
  "id"                  TEXT NOT NULL,
  "sourceLabId"         TEXT NOT NULL,
  "destLabId"           TEXT NOT NULL,
  "materialId"          TEXT NOT NULL,
  "suggestedQuantity"   DECIMAL(10, 2) NOT NULL,
  "reasoning"           TEXT NOT NULL,
  "status"              TEXT NOT NULL,
  "executedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransferSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransferSuggestion_sourceLabId_fkey"
    FOREIGN KEY ("sourceLabId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferSuggestion_destLabId_fkey"
    FOREIGN KEY ("destLabId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferSuggestion_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TransferSuggestion_sourceLabId_idx" ON "TransferSuggestion"("sourceLabId");
CREATE INDEX "TransferSuggestion_destLabId_idx" ON "TransferSuggestion"("destLabId");
CREATE INDEX "TransferSuggestion_materialId_idx" ON "TransferSuggestion"("materialId");
CREATE INDEX "TransferSuggestion_status_idx" ON "TransferSuggestion"("status");
CREATE INDEX "TransferSuggestion_expiresAt_idx" ON "TransferSuggestion"("expiresAt");

-- Supplier ---------------------------------------------------------------

CREATE TABLE "Supplier" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "email"        TEXT,
  "phone"        TEXT,
  "leadTimeDays" INTEGER NOT NULL,
  "categories"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- PurchaseOrder ----------------------------------------------------------

CREATE TABLE "PurchaseOrder" (
  "id"           TEXT NOT NULL,
  "poNumber"     TEXT NOT NULL UNIQUE,
  "supplierId"   TEXT NOT NULL,
  "materialId"   TEXT NOT NULL,
  "quantity"     DECIMAL(10, 2) NOT NULL,
  "deliveryDate" TIMESTAMP(3) NOT NULL,
  "status"       TEXT NOT NULL,
  "cost"         DECIMAL(12, 2),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt"  TIMESTAMP(3),

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrder_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "PurchaseOrder_materialId_idx" ON "PurchaseOrder"("materialId");
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- ============================================================================
-- ALTER EXISTING TABLES (Foreign Key Constraints)
-- ============================================================================

ALTER TABLE "RawMaterial"
  ADD CONSTRAINT "RawMaterial_productionRecipeId_fkey"
  FOREIGN KEY ("productionRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
