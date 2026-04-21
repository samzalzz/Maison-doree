-- Clean up failed migrations that may be blocking new migrations
-- This migration safely removes incomplete migration records

-- Delete any migrations that didn't complete (finished_at is NULL)
DELETE FROM "_prisma_migrations"
WHERE finished_at IS NULL;

-- Delete any migrations with known problematic names
DELETE FROM "_prisma_migrations"
WHERE migration_name LIKE '%resolve_failed%'
   OR migration_name = '20260421000001_add_po_workflow_columns'
   OR migration_name = '20260421000002_resolve_failed_migration_lock';

-- Verify the cleanup
-- SELECT COUNT(*) as total_migrations,
--        SUM(CASE WHEN finished_at IS NULL THEN 1 ELSE 0 END) as incomplete_migrations
-- FROM "_prisma_migrations";
