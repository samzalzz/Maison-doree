import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { CreateCatalogEntrySchema } from '@/lib/validators-supplier'
import { SupplierService, CatalogEntryAlreadyExistsError, SupplierError } from '@/lib/services/supplier-service'
import { db as prisma } from '@/lib/db'

const service = new SupplierService()

export const POST = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = CreateCatalogEntrySchema.parse(body)
    const catalog = await service.addToSupplierCatalog(input)
    return NextResponse.json({ success: true, data: { catalog } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    if (error instanceof CatalogEntryAlreadyExistsError) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: error.message } },
        { status: 409 }
      )
    }
    if (error instanceof SupplierError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplierId')

    const catalogs = await prisma.supplierCatalog.findMany({
      where: supplierId ? { supplierId } : {},
      include: { supplier: true, material: true },
    })

    return NextResponse.json({ success: true, data: { catalogs } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
