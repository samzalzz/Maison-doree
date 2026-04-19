import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { CreateSupplierSchema, SupplierFiltersSchema } from '@/lib/validators-supplier'
import { SupplierService, SupplierError } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const POST = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = CreateSupplierSchema.parse(body)
    const supplier = await service.createSupplier(input)

    return NextResponse.json({ success: true, data: { supplier } })
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

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const filters = SupplierFiltersSchema.parse({
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 20,
    })

    const result = await service.listSuppliers(filters)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
