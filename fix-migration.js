#!/usr/bin/env node
/**
 * Fix script to delete failed migration records from database
 * This resolves the P3009 error: "migrate found failed migrations in the target database"
 */

const { PrismaClient } = require('@prisma/client');

async function fixMigrations() {
  const prisma = new PrismaClient();

  try {
    console.log('Connecting to database...');

    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Connected to database');

    // Delete failed migration records
    console.log('Deleting failed migration records...');
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations"
      WHERE finished_at IS NULL
         OR migration_name LIKE '%resolve_failed%'
         OR migration_name LIKE '%20260421000002%'
    `;

    console.log(`✓ Deleted ${result} failed migration records`);

    // Show remaining migrations
    console.log('\nRemaining migrations:');
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, started_at
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
      LIMIT 10
    `;

    migrations.forEach((m, i) => {
      const status = m.finished_at ? '✓' : '⏳';
      console.log(`${status} ${m.migration_name}`);
    });

    console.log('\n✓ Migration cleanup complete');
    console.log('Database is ready for new migrations');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixMigrations();
