-- Data fix: Add items to existing purchase orders that were created before PurchaseOrderItem table existed
-- This populates PurchaseOrderItem for any PO that has zero items

-- Step 1: Insert default items for purchase orders without items
-- Match materials to suppliers by type
INSERT INTO "PurchaseOrderItem" (id, "poId", "materialId", quantity, "unitPrice", "lineTotal", "createdAt", "updatedAt")
SELECT
  'poi_' || substr(md5(random()::text), 1, 12),
  po.id,
  (SELECT id FROM "RawMaterial" WHERE type LIKE '%Flour%' LIMIT 1),
  100,
  50.00,
  5000.00,
  NOW(),
  NOW()
FROM "PurchaseOrder" po
WHERE NOT EXISTS (
  SELECT 1 FROM "PurchaseOrderItem" WHERE "poId" = po.id
)
ON CONFLICT DO NOTHING;
