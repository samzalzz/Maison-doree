-- Add missing workflow tracking columns to PurchaseOrder table
-- These columns are defined in the Prisma schema but were never created in the database

ALTER TABLE "PurchaseOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "actualDeliveryDate" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN "qualityInspectionId" TEXT;

-- Create index on approvedBy for filtering approved orders
CREATE INDEX "PurchaseOrder_approvedBy_idx" ON "PurchaseOrder"("approvedBy");
