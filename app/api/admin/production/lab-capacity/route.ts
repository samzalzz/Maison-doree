import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'

// ---------------------------------------------------------------------------
// GET /api/admin/production/lab-capacity  (admin only)
// ---------------------------------------------------------------------------
// Returns current utilisation metrics for every production lab.
// A lab is considered "in use" when it has batches in PLANNED or IN_PROGRESS
// status, since both states consume a capacity slot.
//
// Response: { success: true, data: LabCapacity[] }
//   LabCapacity = {
//     labId            : string
//     labName          : string
//     currentBatches   : number
//     maxCapacity      : number
//     utilizationPercent: number   (0–100, two decimal places)
//   }
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // Fetch all labs and their active-batch count in a single query using
    // groupBy on ProductionBatch to avoid N+1 issues.
    const [labs, activeBatchGroups] = await Promise.all([
      prisma.productionLab.findMany({
        select: { id: true, name: true, capacity: true },
        orderBy: { name: 'asc' },
      }),
      // Count PLANNED + IN_PROGRESS batches grouped by lab
      prisma.productionBatch.groupBy({
        by: ['labId'],
        where: {
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
        _count: { id: true },
      }),
    ])

    // Build an O(1) lookup: labId -> active batch count
    const activeBatchMap = new Map<string, number>(
      activeBatchGroups.map((g) => [g.labId, g._count.id]),
    )

    const labCapacities = labs.map((lab) => {
      const currentBatches = activeBatchMap.get(lab.id) ?? 0
      const maxCapacity = lab.capacity

      // Guard against division by zero for labs with capacity = 0 (misconfigured labs)
      const utilizationPercent =
        maxCapacity > 0
          ? Math.min(100, parseFloat(((currentBatches / maxCapacity) * 100).toFixed(2)))
          : 0

      return {
        labId: lab.id,
        labName: lab.name,
        currentBatches,
        maxCapacity,
        utilizationPercent,
      }
    })

    return NextResponse.json({ success: true, data: labCapacities })
  } catch (error) {
    console.error('[GET /api/admin/production/lab-capacity] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve lab capacity data.',
        },
      },
      { status: 500 },
    )
  }
})
