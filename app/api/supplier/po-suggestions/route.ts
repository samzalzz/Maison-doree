import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { CreatePOSuggestionSchema } from '@/lib/validators-supplier'
import { PurchaseOrderService, POError } from '@/lib/services/purchase-order-service'

const service = new PurchaseOrderService()

export const POST = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const input = CreatePOSuggestionSchema.parse(body)
    const suggestion = await service.suggestPurchaseOrder(input)
    return NextResponse.json({ success: true, data: { suggestion } })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: error.errors } },
        { status: 400 }
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

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const suggestions = await service.getPendingSuggestions({
      labId: url.searchParams.get('labId') || undefined,
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 20,
    })
    return NextResponse.json({ success: true, data: { suggestions } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
