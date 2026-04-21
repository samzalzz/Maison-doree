const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://maison_doree_user:devpassword@178.104.153.248:5432/maison_doree'
    }
  }
});

async function resolveFailedMigration() {
  try {
    console.log('Connecting to database...');
    
    // Delete the failed migration record
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration = '20260421000001_add_po_workflow_columns' 
        AND finished_at IS NULL;
    `;
    
    console.log('✅ Deleted failed migration record');
    
    // Check remaining migrations
    const remainingMigrations = await prisma.$queryRaw`
      SELECT migration FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
    `;
    
    console.log('📋 Recent migrations:', remainingMigrations.map(m => m.migration));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveFailedMigration();
