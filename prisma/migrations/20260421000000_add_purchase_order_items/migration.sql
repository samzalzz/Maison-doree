-- Create PurchaseOrderItem table for multi-item purchase orders
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" NUMERIC(10,2) NOT NULL,
    "unitPrice" NUMERIC(12,4) NOT NULL,
    "lineTotal" NUMERIC(12,2) NOT NULL,
    "deliveredQuantity" NUMERIC(10,2),
    "receivedQuantity" NUMERIC(10,2),
    "qualityInspectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE,
    CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial" ("id") ON DELETE RESTRICT
);

-- Create indexes for PurchaseOrderItem
CREATE INDEX "PurchaseOrderItem_poId_idx" ON "PurchaseOrderItem"("poId");
CREATE INDEX "PurchaseOrderItem_materialId_idx" ON "PurchaseOrderItem"("materialId");

-- Create unique constraint to prevent duplicate materials in same PO
CREATE UNIQUE INDEX "PurchaseOrderItem_poId_materialId_key" ON "PurchaseOrderItem"("poId", "materialId");

-- Modify PurchaseOrder table:
-- 1. Drop materialId column and its foreign key constraint
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_materialId_fkey";
ALTER TABLE "PurchaseOrder" DROP COLUMN "materialId";

-- 2. Add totalCost column for aggregate cost
ALTER TABLE "PurchaseOrder" ADD COLUMN "totalCost" NUMERIC(12,2);

-- 3. Drop old indexes related to materialId
DROP INDEX IF EXISTS "PurchaseOrder_materialId_idx";
