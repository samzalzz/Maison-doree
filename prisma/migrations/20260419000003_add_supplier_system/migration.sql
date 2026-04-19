-- Migration: add_supplier_system
-- Date: 2026-04-19
-- Description: Supplier Management System — supplier catalogs, performance metrics, and purchase order suggestions

-- ============================================================================
-- NEW TABLES FOR SUPPLIER MANAGEMENT
-- ============================================================================

-- SupplierCatalog - Product catalog for each supplier (unit prices, lead times, etc)
CREATE TABLE "SupplierCatalog" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "minOrderQty" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCatalog_pkey" PRIMARY KEY ("id")
);

-- PurchaseOrderSuggestion - Automated PO suggestions from MRP system
CREATE TABLE "PurchaseOrderSuggestion" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "suggestedQty" DECIMAL(10,2) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderSuggestion_pkey" PRIMARY KEY ("id")
);

-- SupplierPerformanceMetric - KPIs for supplier reliability and quality
CREATE TABLE "SupplierPerformanceMetric" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "onTimeCount" INTEGER NOT NULL DEFAULT 0,
    "onTimePercent" INTEGER NOT NULL DEFAULT 0,
    "inspectionsPassed" INTEGER NOT NULL DEFAULT 0,
    "inspectionsFailed" INTEGER NOT NULL DEFAULT 0,
    "qualityPassRate" INTEGER NOT NULL DEFAULT 0,
    "trend30Day" TEXT NOT NULL DEFAULT 'stable',
    "reliabilityScore" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- SupplierCategoryPerformance - Performance metrics per product category per supplier
CREATE TABLE "SupplierCategoryPerformance" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "onTimePercent" INTEGER NOT NULL DEFAULT 0,
    "qualityPassRate" INTEGER NOT NULL DEFAULT 0,
    "reliabilityScore" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierCategoryPerformance_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- ADD INDEXES
-- ============================================================================

CREATE UNIQUE INDEX "SupplierCatalog_supplierId_materialId_key" ON "SupplierCatalog"("supplierId", "materialId");
CREATE INDEX "SupplierCatalog_supplierId_idx" ON "SupplierCatalog"("supplierId");
CREATE INDEX "SupplierCatalog_materialId_idx" ON "SupplierCatalog"("materialId");

CREATE INDEX "PurchaseOrderSuggestion_labId_idx" ON "PurchaseOrderSuggestion"("labId");
CREATE INDEX "PurchaseOrderSuggestion_status_idx" ON "PurchaseOrderSuggestion"("status");
CREATE INDEX "PurchaseOrderSuggestion_expiresAt_idx" ON "PurchaseOrderSuggestion"("expiresAt");

CREATE UNIQUE INDEX "SupplierPerformanceMetric_supplierId_key" ON "SupplierPerformanceMetric"("supplierId");
CREATE INDEX "SupplierPerformanceMetric_supplierId_idx" ON "SupplierPerformanceMetric"("supplierId");

CREATE UNIQUE INDEX "SupplierCategoryPerformance_supplierId_category_key" ON "SupplierCategoryPerformance"("supplierId", "category");
CREATE INDEX "SupplierCategoryPerformance_supplierId_idx" ON "SupplierCategoryPerformance"("supplierId");

-- ============================================================================
-- ADD FOREIGN KEYS
-- ============================================================================

ALTER TABLE "SupplierCatalog" ADD CONSTRAINT "SupplierCatalog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCatalog" ADD CONSTRAINT "SupplierCatalog_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderSuggestion" ADD CONSTRAINT "PurchaseOrderSuggestion_labId_fkey" FOREIGN KEY ("labId") REFERENCES "ProductionLab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderSuggestion" ADD CONSTRAINT "PurchaseOrderSuggestion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderSuggestion" ADD CONSTRAINT "PurchaseOrderSuggestion_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierPerformanceMetric" ADD CONSTRAINT "SupplierPerformanceMetric_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierCategoryPerformance" ADD CONSTRAINT "SupplierCategoryPerformance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
