import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { SupplierPerformanceService } from '@/lib/services/supplier-performance-service'

const service = new SupplierPerformanceService()

export const GET = withAuth(async (req: NextRequest, { token }) => {
  if (!['MANAGER', 'ADMIN'].includes(token.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const dashboard = await service.getPerformanceDashboard()
    return NextResponse.json({ success: true, data: dashboard })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: error.message } },
      { status: 500 }
    )
  }
})
