-- Manually resolve the failed migration by marking it as rolled back in _prisma_migrations
DELETE FROM "_prisma_migrations" 
WHERE migration = '20260421000001_add_po_workflow_columns' AND finished_at IS NULL;

-- If the columns don't exist yet (from the failed migration), add them safely
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='deliveredAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='approvedBy') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "approvedBy" TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='sentAt') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "sentAt" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='expectedDeliveryDate') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='actualDeliveryDate') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "actualDeliveryDate" TIMESTAMP(3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='PurchaseOrder' AND column_name='qualityInspectionId') THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "qualityInspectionId" TEXT;
  END IF;
END $$;

-- Create index on approvedBy if it doesn't exist
CREATE INDEX IF NOT EXISTS "PurchaseOrder_approvedBy_idx" ON "PurchaseOrder"("approvedBy");
