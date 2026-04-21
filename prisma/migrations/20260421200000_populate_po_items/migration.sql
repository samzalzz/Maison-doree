-- Data fix: Add items to existing purchase orders that were created before PurchaseOrderItem table existed
-- This uses the simplest possible approach - just add items with any available material

-- First, get the first material that exists
WITH first_material AS (
  SELECT id FROM "RawMaterial" ORDER BY "createdAt" ASC LIMIT 1
)
INSERT INTO "PurchaseOrderItem" (id, "poId", "materialId", quantity, "unitPrice", "lineTotal", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  po.id,
  (SELECT id FROM first_material LIMIT 1),
  100,
  50.00,
  5000.00,
  NOW(),
  NOW()
FROM "PurchaseOrder" po
WHERE NOT EXISTS (SELECT 1 FROM "PurchaseOrderItem" WHERE "poId" = po.id)
  AND (SELECT COUNT(*) FROM first_material) > 0;
