-- Data fix: Add items to existing purchase orders that were created before PurchaseOrderItem table existed
-- This populates PurchaseOrderItem for any PO that has zero items

-- Get the first flour material to use for all orders
WITH flour AS (
  SELECT id FROM "RawMaterial" WHERE type ILIKE '%flour%' LIMIT 1
)
INSERT INTO "PurchaseOrderItem" (id, "poId", "materialId", quantity, "unitPrice", "lineTotal", "createdAt", "updatedAt")
SELECT
  'poi_' || gen_random_uuid()::text,
  po.id,
  (SELECT id FROM flour),
  100,
  50.00,
  5000.00,
  NOW(),
  NOW()
FROM "PurchaseOrder" po, flour
WHERE NOT EXISTS (
  SELECT 1 FROM "PurchaseOrderItem" WHERE "poId" = po.id
)
  AND (SELECT id FROM flour) IS NOT NULL;
