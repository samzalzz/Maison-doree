import { PrismaClient, LabType, ProductionStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clear existing data
  await prisma.productionBatch.deleteMany({})
  await prisma.recipeIngredient.deleteMany({})
  await prisma.recipe.deleteMany({})
  await prisma.labStock.deleteMany({})
  await prisma.labEmployee.deleteMany({})
  await prisma.machine.deleteMany({})
  await prisma.rawMaterial.deleteMany({})
  await prisma.productionLab.deleteMany({})

  // ============================================================================
  // 1. CREATE LABS
  // ============================================================================
  console.log('Creating labs...')
  const labs = await Promise.all([
    prisma.productionLab.create({
      data: {
        name: 'Preparation Lab',
        type: LabType.PREPARATION,
        capacity: 10,
      },
    }),
    prisma.productionLab.create({
      data: {
        name: 'Assembly Lab',
        type: LabType.ASSEMBLY,
        capacity: 8,
      },
    }),
    prisma.productionLab.create({
      data: {
        name: 'Finishing Lab',
        type: LabType.FINISHING,
        capacity: 6,
      },
    }),
  ])

  console.log(`✓ Created ${labs.length} labs`)

  // ============================================================================
  // 2. CREATE EMPLOYEES
  // ============================================================================
  console.log('Creating employees...')
  await Promise.all([
    // Preparation Lab
    prisma.labEmployee.create({
      data: {
        labId: labs[0].id,
        name: 'Marie Dupont',
        role: 'Boulanger',
        availableHours: 40,
      },
    }),
    prisma.labEmployee.create({
      data: {
        labId: labs[0].id,
        name: 'Pierre Leclerc',
        role: 'Assistant Boulanger',
        availableHours: 35,
      },
    }),
    // Assembly Lab
    prisma.labEmployee.create({
      data: {
        labId: labs[1].id,
        name: 'Sophie Bernard',
        role: 'Pâtissier',
        availableHours: 40,
      },
    }),
    prisma.labEmployee.create({
      data: {
        labId: labs[1].id,
        name: 'Claude Moreau',
        role: 'Décorateur',
        availableHours: 38,
      },
    }),
    // Finishing Lab
    prisma.labEmployee.create({
      data: {
        labId: labs[2].id,
        name: 'Isabelle Garnier',
        role: 'Finisseur',
        availableHours: 40,
      },
    }),
  ])
  console.log('✓ Created 5 employees')

  // ============================================================================
  // 3. CREATE MACHINES
  // ============================================================================
  console.log('Creating machines...')
  await Promise.all([
    // Preparation Lab
    prisma.machine.create({
      data: {
        labId: labs[0].id,
        name: 'Four Principal',
        type: 'Oven',
        batchCapacity: 20,
        cycleTimeMinutes: 45,
        available: true,
      },
    }),
    prisma.machine.create({
      data: {
        labId: labs[0].id,
        name: 'Malaxeur Spiral',
        type: 'Mixer',
        batchCapacity: 50,
        cycleTimeMinutes: 30,
        available: true,
      },
    }),
    // Assembly Lab
    prisma.machine.create({
      data: {
        labId: labs[1].id,
        name: 'Chambre Froide A',
        type: 'Fridge',
        batchCapacity: 100,
        cycleTimeMinutes: 120,
        available: true,
      },
    }),
    prisma.machine.create({
      data: {
        labId: labs[1].id,
        name: 'Étuve Garniture',
        type: 'Oven',
        batchCapacity: 30,
        cycleTimeMinutes: 25,
        available: true,
      },
    }),
    // Finishing Lab
    prisma.machine.create({
      data: {
        labId: labs[2].id,
        name: 'Station Decoration',
        type: 'Workstation',
        batchCapacity: 15,
        cycleTimeMinutes: 20,
        available: true,
      },
    }),
  ])
  console.log('✓ Created 5 machines')

  console.log('\n✅ Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
