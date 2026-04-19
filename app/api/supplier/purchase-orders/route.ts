import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { PurchaseOrderFiltersSchema } from '@/lib/validators-supplier'
import { PurchaseOrderService } from '@/lib/services/purchase-order-service'

const service = new PurchaseOrderService()

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const filters = PurchaseOrderFiltersSchema.parse({
      status: url.searchParams.get('status'),
      supplierId: url.searchParams.get('supplierId'),
      materialId: url.searchParams.get('materialId'),
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 20,
    })

    const pos = await service.listPurchaseOrders(filters)
    return NextResponse.json({ success: true, data: { pos } })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
