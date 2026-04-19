import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { UpdateSupplierSchema } from '@/lib/validators-supplier'
import { SupplierService, SupplierNotFoundError } from '@/lib/services/supplier-service'

const service = new SupplierService()

export const GET = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const id = typeof params?.id === 'string' ? params.id : ''
    const supplier = await service.getSupplier(id)
    return NextResponse.json({ success: true, data: { supplier } })
  } catch (error: any) {
    if (error instanceof SupplierNotFoundError) {
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

export const PATCH = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const id = typeof params?.id === 'string' ? params.id : ''
    const body = await req.json()
    const input = UpdateSupplierSchema.parse(body)
    const supplier = await service.updateSupplier(id, input)
    return NextResponse.json({ success: true, data: { supplier } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    if (error instanceof SupplierNotFoundError) {
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

export const DELETE = withAuth(async (req: NextRequest, { params, token }) => {
  if (token.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const id = typeof params?.id === 'string' ? params.id : ''
    await service.deactivateSupplier(id)
    return NextResponse.json({ success: true, data: { message: 'Supplier deactivated' } })
  } catch (error: any) {
    if (error instanceof SupplierNotFoundError) {
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
