-- Safely add missing workflow tracking columns to PurchaseOrder table
-- Uses DO blocks to check if columns exist before adding them
-- This handles the case where the previous migration partially succeeded

DO $$ BEGIN
  -- Add deliveredAt column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='deliveredAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);
  END IF;

  -- Add approvedBy column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='approvedBy') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "approvedBy" TEXT;
  END IF;

  -- Add sentAt column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='sentAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "sentAt" TIMESTAMP(3);
  END IF;

  -- Add expectedDeliveryDate column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='expectedDeliveryDate') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3);
  END IF;

  -- Add actualDeliveryDate column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='actualDeliveryDate') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "actualDeliveryDate" TIMESTAMP(3);
  END IF;

  -- Add qualityInspectionId column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='qualityInspectionId') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "qualityInspectionId" TEXT;
  END IF;
END $$;

-- Create index on approvedBy if it doesn't exist
CREATE INDEX IF NOT EXISTS "PurchaseOrder_approvedBy_idx" ON "PurchaseOrder"("approvedBy");
