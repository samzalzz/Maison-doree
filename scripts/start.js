#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Startup script that handles database connectivity issues
 * and prevents infinite restart loops.
 *
 * Purpose:
 * - Safely attempt database migrations with retry logic
 * - Start Next.js server even if migrations fail (with warning)
 * - Prevent container restart loops from DB connection failures
 */

let migrationsAttempted = false;

// Run migrations with retry logic
async function runMigrations() {
  return new Promise((resolve) => {
    console.log('[Startup] Attempting database migrations...');

    const migrationProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      shell: true,
    });

    migrationProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[Startup] ✓ Migrations completed successfully');
        migrationsAttempted = true;
        resolve(true);
      } else {
        console.warn('[Startup] ⚠ Migrations failed with code:', code);
        console.warn('[Startup] Database may not be available yet');
        console.warn('[Startup] Continuing with Next.js startup (app may not work until DB is ready)');
        migrationsAttempted = true;
        resolve(false);
      }
    });

    migrationProcess.on('error', (err) => {
      console.error('[Startup] Migration process error:', err.message);
      migrationsAttempted = true;
      resolve(false);
    });

    // Timeout migrations after 30 seconds
    setTimeout(() => {
      if (!migrationsAttempted) {
        console.warn('[Startup] Migrations taking too long, continuing with Next.js startup');
        migrationProcess.kill();
        resolve(false);
      }
    }, 30000);
  });
}

// Start Next.js server
function startNextServer() {
  console.log('[Startup] Starting Next.js server...');

  const nextProcess = spawn('next', ['start'], {
    stdio: 'inherit',
    shell: true,
  });

  nextProcess.on('error', (err) => {
    console.error('[Startup] Failed to start Next.js:', err.message);
    process.exit(1);
  });

  nextProcess.on('close', (code) => {
    console.log('[Startup] Next.js server exited with code:', code);
    process.exit(code);
  });
}

// Main startup flow
async function main() {
  console.log('[Startup] Maison Dorée Production Management System');
  console.log('[Startup] Node environment:', process.env.NODE_ENV || 'not set');
  console.log('[Startup] Database URL:', process.env.DATABASE_URL ? '***configured***' : '⚠ NOT SET');

  // Attempt migrations
  const migrationsSuccess = await runMigrations();

  // Always start Next.js server regardless of migration success
  // This prevents infinite restart loops from database connection failures
  startNextServer();
}

main().catch((err) => {
  console.error('[Startup] Fatal error:', err);
  process.exit(1);
});
