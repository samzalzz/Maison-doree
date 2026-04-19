import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db as prisma } from '@/lib/db'
import { Decimal } from '@prisma/client/runtime/library'

export const POST = withAuth(async (req: NextRequest, { token }) => {
  if (token.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'File required' } },
        { status: 400 }
      )
    }

    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    const headers = lines[0].split(',').map((h) => h.trim())

    const entries = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map((v) => v.trim())
        const row: any = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx]
        })

        const supplier = await prisma.supplier.findUnique({
          where: { id: row.supplierId },
        })
        if (!supplier) {
          errors.push(`Row ${i + 1}: supplier not found`)
          continue
        }

        const material = await prisma.rawMaterial.findUnique({
          where: { id: row.materialId },
        })
        if (!material) {
          errors.push(`Row ${i + 1}: material not found`)
          continue
        }

        const existing = await prisma.supplierCatalog.findUnique({
          where: {
            supplierId_materialId: {
              supplierId: row.supplierId,
              materialId: row.materialId,
            },
          },
        })

        if (existing) {
          errors.push(`Row ${i + 1}: catalog entry already exists`)
          continue
        }

        const entry = await prisma.supplierCatalog.create({
          data: {
            supplierId: row.supplierId,
            materialId: row.materialId,
            unitPrice: new Decimal(row.unitPrice),
            minOrderQty: parseInt(row.minOrderQty),
            leadTimeDays: parseInt(row.leadTimeDays),
          },
        })

        entries.push(entry)
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported: entries.length, failed: errors.length, errors },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
