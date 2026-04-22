/**
 * Migration script to auto-populate SupplierCatalog from existing PurchaseOrders
 * Usage: npx tsx scripts/migrate-supplier-catalogs.ts
 *
 * This script:
 * 1. Finds all suppliers with existing purchase orders
 * 2. For each PO item, creates a SupplierCatalog entry if it doesn't exist
 * 3. Uses the PO's unit price as the catalog price
 */

import { prisma } from '@/lib/db/prisma'

async function migrateCatalogs() {
  console.log('Starting supplier catalog auto-population...\n')

  try {
    // Get all suppliers with their POs and items
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchaseOrders: {
          include: {
            items: {
              include: { material: true },
            },
          },
        },
      },
    })

    let totalCreated = 0
    let totalSkipped = 0
    let totalSuppliers = 0

    for (const supplier of suppliers) {
      if (supplier.purchaseOrders.length === 0) {
        continue
      }

      totalSuppliers++
      console.log(`\nProcessing supplier: ${supplier.name} (${supplier.id})`)
      console.log(`  Found ${supplier.purchaseOrders.length} POs`)

      const materials = new Map<
        string,
        { materialId: string; unitPrice: number; materialName: string }
      >()

      // Collect unique materials from all POs
      for (const po of supplier.purchaseOrders) {
        for (const item of po.items) {
          const key = item.materialId
          if (!materials.has(key)) {
            materials.set(key, {
              materialId: item.materialId,
              unitPrice: Number(item.unitPrice),
              materialName: item.material?.name || 'Unknown',
            })
          }
        }
      }

      console.log(`  Found ${materials.size} unique materials`)

      // Create catalog entries
      for (const [, material] of materials) {
        try {
          // Check if already exists
          const existing = await prisma.supplierCatalog.findUnique({
            where: {
              supplierId_materialId: {
                supplierId: supplier.id,
                materialId: material.materialId,
              },
            },
          })

          if (existing) {
            console.log(`    ✓ Already in catalog: ${material.materialName}`)
            totalSkipped++
            continue
          }

          // Create new catalog entry
          await prisma.supplierCatalog.create({
            data: {
              supplierId: supplier.id,
              materialId: material.materialId,
              unitPrice: material.unitPrice,
              minOrderQty: 1,
              leadTimeDays: supplier.leadTimeDays,
            },
          })

          console.log(
            `    ✓ Added to catalog: ${material.materialName} @ ${material.unitPrice} MAD`,
          )
          totalCreated++
        } catch (err) {
          console.error(
            `    ✗ Error adding ${material.materialName}:`,
            (err as Error).message,
          )
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log('Migration Summary:')
    console.log(`  Suppliers processed: ${totalSuppliers}`)
    console.log(`  Catalog items created: ${totalCreated}`)
    console.log(`  Catalog items skipped (already exist): ${totalSkipped}`)
    console.log(`${'='.repeat(60)}\n`)

    console.log('✓ Supplier catalog migration completed successfully!')
  } catch (err) {
    console.error('✗ Migration failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateCatalogs()
