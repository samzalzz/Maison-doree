import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { UpdateCatalogEntrySchema } from '@/lib/validators-supplier'
import { SupplierService } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const PATCH = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const catalogId = typeof params?.catalogId === 'string' ? params.catalogId : ''
    const body = await req.json()
    const input = UpdateCatalogEntrySchema.parse(body)
    const catalog = await service.updateCatalogEntry(catalogId, input)
    return NextResponse.json({ success: true, data: { catalog } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const catalogId = typeof params?.catalogId === 'string' ? params.catalogId : ''
    await service.removeCatalogEntry(catalogId)
    return NextResponse.json({ success: true, data: { message: 'Catalog entry deleted' } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
