-- Data fix: Add items to existing purchase orders that were created before PurchaseOrderItem table existed

-- First, identify a default material to use
-- Get the ID of the first Flour material
DO $$
DECLARE
    flour_id TEXT;
    po_id TEXT;
BEGIN
    -- Find first flour material
    SELECT id INTO flour_id FROM "RawMaterial" WHERE type LIKE '%Flour%' LIMIT 1;

    -- If no flour found, use the first raw material
    IF flour_id IS NULL THEN
        SELECT id INTO flour_id FROM "RawMaterial" LIMIT 1;
    END IF;

    -- If we have a material, add items to POs without items
    IF flour_id IS NOT NULL THEN
        FOR po_id IN
            SELECT id FROM "PurchaseOrder" po
            WHERE NOT EXISTS (
                SELECT 1 FROM "PurchaseOrderItem" WHERE "poId" = po.id
            )
        LOOP
            INSERT INTO "PurchaseOrderItem" (id, "poId", "materialId", quantity, "unitPrice", "lineTotal", "createdAt", "updatedAt")
            VALUES (
                'poi_' || substr(gen_random_uuid()::text, 1, 20),
                po_id,
                flour_id,
                100,
                50.00,
                5000.00,
                NOW(),
                NOW()
            );
        END LOOP;
    END IF;
END $$;
