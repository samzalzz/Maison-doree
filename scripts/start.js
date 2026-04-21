#!/usr/bin/env node

const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

/**
 * Robust startup script with database migration cleanup
 *
 * This script:
 * 1. Cleans up failed migrations directly via Prisma
 * 2. Attempts normal migrations with timeout
 * 3. Always starts Next.js (never exits on migration failure)
 * 4. Prevents infinite container restart loops
 */

let migrationAttempted = false;

// Cleanup failed migrations directly via Prisma
async function cleanupFailedMigrations() {
  try {
    console.log('[Startup] Cleaning up failed migrations...');

    const prisma = new PrismaClient();

    // Delete migrations that didn't finish or have known issue names
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations"
      WHERE finished_at IS NULL
         OR migration_name LIKE '%resolve_failed%'
         OR migration_name LIKE '%20260421000002%'
    `;

    console.log(`[Startup] ✓ Cleaned up ${result} failed migration records`);
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.warn(`[Startup] ⚠ Migration cleanup error (continuing anyway): ${error.message}`);
    return false;
  }
}

// Run migrations with timeout and error handling
async function runMigrations() {
  return new Promise((resolve) => {
    console.log('[Startup] Running database migrations...');

    const migrationProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: true,
      timeout: 30000,
    });

    const timeout = setTimeout(() => {
      console.warn('[Startup] ⚠ Migrations timeout - continuing with Next.js startup');
      migrationProcess.kill();
      resolve(false);
    }, 30000);

    migrationProcess.on('close', (code) => {
      clearTimeout(timeout);
      migrationAttempted = true;

      if (code === 0) {
        console.log('[Startup] ✓ Migrations completed successfully');
        resolve(true);
      } else {
        console.warn(`[Startup] ⚠ Migrations exited with code ${code} - continuing with app startup`);
        resolve(false);
      }
    });

    migrationProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.warn(`[Startup] ⚠ Migration error: ${error.message} - continuing with app startup`);
      migrationAttempted = true;
      resolve(false);
    });
  });
}

// Start Next.js server
function startNextServer() {
  console.log('[Startup] Starting Next.js server...');

  const nextProcess = spawn('next', ['start'], {
    stdio: 'inherit',
    shell: true,
  });

  nextProcess.on('error', (error) => {
    console.error(`[Startup] ✗ Failed to start Next.js: ${error.message}`);
    // Give it a moment to display the error, then exit
    setTimeout(() => process.exit(1), 2000);
  });

  nextProcess.on('close', (code) => {
    console.log(`[Startup] Next.js exited with code ${code}`);
    // Exit with the same code (0 for clean shutdown, non-zero for error)
    process.exit(code || 0);
  });
}

// Main startup sequence
async function main() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('[Startup] Maison Dorée - Production Management System');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Startup] Database: ${process.env.DATABASE_URL ? '✓ Configured' : '✗ NOT SET'}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 1: Clean up any failed migrations from the database
    console.log('[Startup] Step 1: Database cleanup');
    await cleanupFailedMigrations();

    // Step 2: Run normal migrations
    console.log('\n[Startup] Step 2: Run migrations');
    const migrationsOk = await runMigrations();

    // Step 3: Always start Next.js (critical for preventing restart loops)
    console.log('\n[Startup] Step 3: Start Next.js server');
    console.log('[Startup] ℹ Next.js will start regardless of migration status');
    console.log('[Startup] ℹ This prevents infinite container restart loops\n');

    startNextServer();
  } catch (error) {
    console.error(`[Startup] ✗ Fatal error: ${error.message}`);
    console.error(error.stack);
    // Exit cleanly rather than crashing
    process.exit(1);
  }
}

// Run startup sequence
main().catch((error) => {
  console.error(`[Startup] ✗ Uncaught error: ${error.message}`);
  process.exit(1);
});
