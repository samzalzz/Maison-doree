import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { ApprovePOSuggestionSchema } from '@/lib/validators-supplier'
import { PurchaseOrderService, POError, PONotFoundError } from '@/lib/services/purchase-order-service'

const service = new PurchaseOrderService()

export const PATCH = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const id = typeof params?.id === 'string' ? params.id : ''
    const body = await req.json()
    const input = ApprovePOSuggestionSchema.parse({
      ...body,
      approvedBy: token.email,
    })
    const po = await service.approveSuggestion(id, input)
    return NextResponse.json({ success: true, data: { po } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
      )
    }
    if (error instanceof PONotFoundError) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      )
    }
    if (error instanceof POError) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: error.message } },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
