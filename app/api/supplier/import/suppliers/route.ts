import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { db as prisma } from '@/lib/db'

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

    const suppliers = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map((v) => v.trim())
        const row: any = {}
        headers.forEach((h, idx) => {
          row[h] = values[idx]
        })

        if (!row.name) {
          errors.push(`Row ${i + 1}: name required`)
          continue
        }

        const existing = await prisma.supplier.findFirst({
          where: { name: row.name },
        })

        if (existing) {
          errors.push(`Row ${i + 1}: supplier '${row.name}' already exists`)
          continue
        }

        const supplier = await prisma.supplier.create({
          data: {
            name: row.name,
            email: row.email || undefined,
            phone: row.phone || undefined,
            address: row.address || undefined,
            city: row.city || undefined,
            contactPerson: row.contactPerson || undefined,
            leadTimeDays: parseInt(row.leadTimeDays || '7'),
            categories: row.categories ? row.categories.split(';').map((c: string) => c.trim()) : [],
          },
        })

        suppliers.push(supplier)
      } catch (e: any) {
        errors.push(`Row ${i + 1}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported: suppliers.length, failed: errors.length, errors },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
