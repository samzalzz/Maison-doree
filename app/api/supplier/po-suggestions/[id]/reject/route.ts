import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { RejectPOSuggestionSchema } from '@/lib/validators-supplier'
import { PurchaseOrderService, PONotFoundError } from '@/lib/services/purchase-order-service'

const service = new PurchaseOrderService()

export const PATCH = withAuth(async (req: NextRequest, { params, token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const id = typeof params?.id === 'string' ? params.id : ''
    const body = await req.json()
    const input = RejectPOSuggestionSchema.parse(body)
    const suggestion = await service.rejectSuggestion(id, input.reason)
    return NextResponse.json({ success: true, data: { suggestion } })
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
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
