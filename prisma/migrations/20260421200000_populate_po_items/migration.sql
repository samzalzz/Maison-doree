-- Data fix: Add items to existing purchase orders that were created before PurchaseOrderItem table existed
-- This migration handles the case where no RawMaterial exists by creating a default material first

DO $$
DECLARE
  v_material_id TEXT;
BEGIN
  -- Step 1: Ensure at least one material exists
  -- Try to get the first material
  SELECT id INTO v_material_id FROM "RawMaterial" ORDER BY "createdAt" ASC LIMIT 1;

  -- If no material exists, create a default one
  IF v_material_id IS NULL THEN
    INSERT INTO "RawMaterial" (id, name, type, unit, "isIntermediate", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid()::text,
      'Flour',
      'Flour',
      'kg',
      false,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_material_id;
  END IF;

  -- Step 2: Insert items for all POs that don't have items yet
  INSERT INTO "PurchaseOrderItem" (id, "poId", "materialId", quantity, "unitPrice", "lineTotal", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    po.id,
    v_material_id,
    100,
    50.00,
    5000.00,
    NOW(),
    NOW()
  FROM "PurchaseOrder" po
  WHERE NOT EXISTS (SELECT 1 FROM "PurchaseOrderItem" WHERE "poId" = po.id);

  RAISE NOTICE 'Migration complete. Using material ID: %', v_material_id;
END $$;
