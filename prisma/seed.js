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

  const totalUsers = await prisma.user.count()
  const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } })
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
  const driverCount = await prisma.user.count({ where: { role: 'DRIVER' } })

  console.log('\n📊 Database Summary:')
  console.log(`  Total Users: ${totalUsers}`)
  console.log(`  Customers: ${customerCount}`)
  console.log(`  Admins: ${adminCount}`)
  console.log(`  Drivers: ${driverCount}`)
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
