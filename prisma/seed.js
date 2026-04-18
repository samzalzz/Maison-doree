const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const users = [
    {
      email: 'customer@test.com',
      password: 'Password123!',
      role: 'CUSTOMER',
      profile: {
        firstName: 'Ahmed',
        lastName: 'Benali',
        phone: '+212612345678',
        address: '123 Rue Mohammed V',
        city: 'Marrakech',
        zipCode: '40000',
      },
    },
    {
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'ADMIN',
      profile: {
        firstName: 'Admin',
        lastName: 'User',
        phone: '+212612345679',
        address: 'Admin Office',
        city: 'Marrakech',
        zipCode: '40000',
      },
    },
    {
      email: 'driver@test.com',
      password: 'DriverPass123!',
      role: 'DRIVER',
      profile: {
        firstName: 'Mohamed',
        lastName: 'Driver',
        phone: '+212612345680',
        address: '456 Rue Gueliz',
        city: 'Marrakech',
        zipCode: '40000',
      },
    },
    {
      email: 'customer2@test.com',
      password: 'Password123!',
      role: 'CUSTOMER',
      profile: {
        firstName: 'Fatima',
        lastName: 'Alaoui',
        phone: '+212612345681',
        address: '789 Rue Safi',
        city: 'Fez',
        zipCode: '30000',
      },
    },
  ]

  for (const userData of users) {
    const { email, password, role, profile } = userData

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      console.log(`✓ User ${email} already exists`)
      continue
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        profile: {
          create: profile,
        },
        loyaltyCard:
          role === 'CUSTOMER'
            ? {
                create: {
                  points: 0,
                  totalSpent: 0,
                  tier: 'BRONZE',
                },
              }
            : undefined,
      },
      include: {
        profile: true,
        loyaltyCard: true,
      },
    })

    console.log(`✓ Created ${role} user: ${email}`)
  }

  // ==================== PRODUCTION MANAGEMENT DATA ====================
  console.log('\n🏭 Seeding Production Management...')

  // Raw Materials
  const rawMaterials = [
    { name: 'Flour', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Sugar', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Butter', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Eggs', type: 'Ingredient', unit: 'pieces', isIntermediate: false },
    { name: 'Vanilla Extract', type: 'Ingredient', unit: 'ml', isIntermediate: false },
    { name: 'Baking Powder', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Salt', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Dark Chocolate', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Strawberries', type: 'Ingredient', unit: 'kg', isIntermediate: false },
    { name: 'Heavy Cream', type: 'Ingredient', unit: 'liters', isIntermediate: false },
  ]

  const createdMaterials = []
  for (const material of rawMaterials) {
    const existing = await prisma.rawMaterial.findUnique({
      where: { name_type: { name: material.name, type: material.type } },
    })
    if (!existing) {
      const created = await prisma.rawMaterial.create({ data: material })
      createdMaterials.push(created)
      console.log(`  ✓ Created material: ${material.name}`)
    } else {
      createdMaterials.push(existing)
    }
  }

  // Production Labs
  const labs = [
    { name: 'Lab de Préparation', type: 'PREPARATION', capacity: 10 },
    { name: 'Lab d\'Assemblage', type: 'ASSEMBLY', capacity: 8 },
    { name: 'Lab de Finition', type: 'FINISHING', capacity: 6 },
  ]

  const createdLabs = []
  for (const lab of labs) {
    const existing = await prisma.productionLab.findFirst({
      where: { name: lab.name },
    })
    if (!existing) {
      const created = await prisma.productionLab.create({ data: lab })
      createdLabs.push(created)
      console.log(`  ✓ Created lab: ${lab.name}`)
    } else {
      createdLabs.push(existing)
    }
  }

  // Machines
  const machines = [
    {
      labId: createdLabs[0]?.id,
      name: 'Oven A',
      type: 'Oven',
      batchCapacity: 50,
      cycleTimeMinutes: 45,
      available: true,
    },
    {
      labId: createdLabs[0]?.id,
      name: 'Mixer 1',
      type: 'Mixer',
      batchCapacity: 100,
      cycleTimeMinutes: 15,
      available: true,
    },
    {
      labId: createdLabs[1]?.id,
      name: 'Conveyor Belt',
      type: 'Conveyor',
      batchCapacity: 200,
      cycleTimeMinutes: 30,
      available: true,
    },
    {
      labId: createdLabs[2]?.id,
      name: 'Cooling Unit',
      type: 'Fridge',
      batchCapacity: 150,
      cycleTimeMinutes: 60,
      available: true,
    },
  ]

  for (const machine of machines) {
    if (machine.labId) {
      const existing = await prisma.machine.findFirst({
        where: { name: machine.name },
      })
      if (!existing) {
        await prisma.machine.create({ data: machine })
        console.log(`  ✓ Created machine: ${machine.name}`)
      }
    }
  }

  // Recipes
  const recipeData = [
    {
      name: 'Gâteau au Chocolat',
      description: 'Rich chocolate cake with dark chocolate',
      laborMinutes: 120,
      ingredients: [
        { materialId: createdMaterials[0]?.id, quantity: 2, unit: 'kg' },
        { materialId: createdMaterials[1]?.id, quantity: 1.5, unit: 'kg' },
        { materialId: createdMaterials[2]?.id, quantity: 1, unit: 'kg' },
        { materialId: createdMaterials[3]?.id, quantity: 12, unit: 'pieces' },
        { materialId: createdMaterials[7]?.id, quantity: 0.5, unit: 'kg' },
      ],
    },
    {
      name: 'Tarte aux Fraises',
      description: 'Strawberry tart with fresh strawberries',
      laborMinutes: 90,
      ingredients: [
        { materialId: createdMaterials[0]?.id, quantity: 1.5, unit: 'kg' },
        { materialId: createdMaterials[1]?.id, quantity: 0.5, unit: 'kg' },
        { materialId: createdMaterials[2]?.id, quantity: 0.8, unit: 'kg' },
        { materialId: createdMaterials[8]?.id, quantity: 2, unit: 'kg' },
        { materialId: createdMaterials[9]?.id, quantity: 0.5, unit: 'liters' },
      ],
    },
    {
      name: 'Pâte Brisée (Base)',
      description: 'Classic pie crust base',
      laborMinutes: 30,
      ingredients: [
        { materialId: createdMaterials[0]?.id, quantity: 1, unit: 'kg' },
        { materialId: createdMaterials[2]?.id, quantity: 0.5, unit: 'kg' },
        { materialId: createdMaterials[6]?.id, quantity: 0.01, unit: 'kg' },
      ],
    },
  ]

  for (const recipe of recipeData) {
    const existing = await prisma.recipe.findFirst({
      where: { name: recipe.name },
    })
    if (!existing) {
      const createdRecipe = await prisma.recipe.create({
        data: {
          name: recipe.name,
          description: recipe.description,
          laborMinutes: recipe.laborMinutes,
          ingredients: {
            create: recipe.ingredients.filter(ing => ing.materialId).map(ing => ({
              rawMaterialId: ing.materialId,
              quantity: ing.quantity,
              unit: ing.unit,
            })),
          },
        },
      })
      console.log(`  ✓ Created recipe: ${recipe.name}`)
    }
  }

  // Suppliers
  const suppliers = [
    {
      name: 'Grain Supplier Morocco',
      email: 'contact@grainsupply.ma',
      phone: '+212612345600',
      leadTimeDays: 3,
      categories: ['Flour', 'Baking Powder', 'Salt'],
    },
    {
      name: 'Sweet Suppliers Inc',
      email: 'sales@sweetsupply.com',
      phone: '+212712345601',
      leadTimeDays: 5,
      categories: ['Sugar', 'Vanilla Extract', 'Dark Chocolate'],
    },
    {
      name: 'Dairy Fresh Foods',
      email: 'orders@dairyfresh.ma',
      phone: '+212812345602',
      leadTimeDays: 2,
      categories: ['Butter', 'Eggs', 'Heavy Cream'],
    },
    {
      name: 'Fresh Produce Co',
      email: 'wholesale@freshproduce.ma',
      phone: '+212612345603',
      leadTimeDays: 1,
      categories: ['Strawberries', 'Fruits'],
    },
  ]

  const createdSuppliers = []
  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({
      where: { name: supplier.name },
    })
    if (!existing) {
      const created = await prisma.supplier.create({ data: supplier })
      createdSuppliers.push(created)
      console.log(`  ✓ Created supplier: ${supplier.name}`)
    } else {
      createdSuppliers.push(existing)
    }
  }

  // Purchase Orders
  const purchaseOrders = [
    {
      poNumber: `PO-${Date.now()}-001`,
      supplierId: createdSuppliers[0]?.id,
      materialId: createdMaterials[0]?.id,
      quantity: 100,
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      cost: 5000,
    },
    {
      poNumber: `PO-${Date.now()}-002`,
      supplierId: createdSuppliers[1]?.id,
      materialId: createdMaterials[1]?.id,
      quantity: 50,
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'pending',
      cost: 3000,
    },
    {
      poNumber: `PO-${Date.now()}-003`,
      supplierId: createdSuppliers[2]?.id,
      materialId: createdMaterials[2]?.id,
      quantity: 30,
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'ordered',
      cost: 4500,
    },
  ]

  for (const po of purchaseOrders) {
    if (po.supplierId && po.materialId) {
      const existing = await prisma.purchaseOrder.findFirst({
        where: { poNumber: po.poNumber },
      })
      if (!existing) {
        await prisma.purchaseOrder.create({ data: po })
        console.log(`  ✓ Created purchase order: ${po.poNumber}`)
      }
    }
  }

  const totalUsers = await prisma.user.count()
  const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } })
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
  const driverCount = await prisma.user.count({ where: { role: 'DRIVER' } })
  const labCount = await prisma.productionLab.count()
  const machineCount = await prisma.machine.count()
  const materialCount = await prisma.rawMaterial.count()
  const recipeCount = await prisma.recipe.count()
  const supplierCount = await prisma.supplier.count()
  const poCount = await prisma.purchaseOrder.count()

  console.log('\n📊 Database Summary:')
  console.log(`  Total Users: ${totalUsers}`)
  console.log(`  Customers: ${customerCount}`)
  console.log(`  Admins: ${adminCount}`)
  console.log(`  Drivers: ${driverCount}`)
  console.log('\n🏭 Production Management:')
  console.log(`  Labs: ${labCount}`)
  console.log(`  Machines: ${machineCount}`)
  console.log(`  Raw Materials: ${materialCount}`)
  console.log(`  Recipes: ${recipeCount}`)
  console.log(`  Suppliers: ${supplierCount}`)
  console.log(`  Purchase Orders: ${poCount}`)
  console.log('\n✅ Seeding complete!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
