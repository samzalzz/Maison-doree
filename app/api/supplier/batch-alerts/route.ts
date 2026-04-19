import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SupplierAlertService } from '@/lib/services/supplier-alert-service'

const service = new SupplierAlertService()

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['WORKER', 'MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const batchId = url.searchParams.get('batchId')
    const labId = url.searchParams.get('labId')

    if (batchId) {
      const alerts = await service.checkBatchMaterialStatus(batchId)
      return NextResponse.json({ success: true, data: alerts })
    }

    if (labId) {
      const alerts = await service.getMaterialAlertsForLab(labId)
      return NextResponse.json({ success: true, data: alerts })
    }

    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'batchId or labId required' } },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
