import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/lab-stock  (admin only)
// ---------------------------------------------------------------------------
// Returns current stock levels for a specific lab.
// A labId query parameter is required — returning all stock rows across all
// labs in a single payload would be impractical at scale.
//
// Query params:
//   labId  – required; CUID of the target lab
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const labId = searchParams.get('labId')

    if (!labId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: "Query parameter 'labId' is required.",
          },
        },
        { status: 400 },
      )
    }

    // Confirm the lab exists before querying stock
    const lab = await prisma.productionLab.findUnique({
      where: { id: labId },
      select: { id: true, name: true },
    })

    if (!lab) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAB_NOT_FOUND',
            message: `Lab '${labId}' was not found.`,
          },
        },
        { status: 404 },
      )
    }

    const where: { labId: string; stockType?: string } = { labId }
    if (stockType) where.stockType = stockType

    const stock = await prisma.labStock.findMany({
      where,
      include: {
        // Include material metadata so consumers don't need a second request
        material: {
          select: { id: true, name: true, type: true, unit: true, isIntermediate: true },
        },
      },
      orderBy: { material: { name: 'asc' } },
    })

    return NextResponse.json({ success: true, data: stock })
  } catch (error) {
    console.error('[GET /api/admin/lab-stock] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve lab stock.' },
      },
      { status: 500 },
    )
  }
})
