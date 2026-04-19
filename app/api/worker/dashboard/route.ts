import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAuth } from '@/lib/auth-middleware'

export const GET = withAuth(
  async (req: NextRequest, context) => {
    try {
      const token = context.token

      // Only WORKER and MANAGER roles can access this endpoint
      if (token.role !== 'WORKER' && token.role !== 'MANAGER') {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'Only workers and managers can access this dashboard.' },
          },
          { status: 403 },
        )
      }

      // Get all labs (for now, we'll return data for all labs)
      // TODO: In the future, link User to specific labs via a many-to-many relationship
      const labs = await prisma.productionLab.findMany({
        select: { id: true, name: true },
      })

      const labIds = labs.map((lab) => lab.id)

      // Get batches in the worker's labs
      const batches = await prisma.productionBatch.findMany({
        where: {
          labId: { in: labIds },
        },
        include: {
          recipe: { select: { id: true, name: true } },
          lab: { select: { id: true, name: true } },
          employee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      // For now, treat batches assigned to any employee as "lab batches"
      // Once BatchAssignment model is added, this will be restructured
      const myBatches = batches.filter((b) => b.status !== 'COMPLETED')
      const labBatches = batches

      // Calculate stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const myAssignedToday = myBatches.filter((b) => {
        const createdAt = new Date(b.createdAt)
        createdAt.setHours(0, 0, 0, 0)
        return createdAt.getTime() === today.getTime()
      }).length

      const myCompletedToday = batches
        .filter((b) => {
          const completedAt = b.actualCompletionTime ? new Date(b.actualCompletionTime) : null
          if (!completedAt) return false
          completedAt.setHours(0, 0, 0, 0)
          return completedAt.getTime() === today.getTime() && b.status === 'COMPLETED'
        })
        .length

      const labTotalInProgress = batches.filter((b) => b.status === 'IN_PROGRESS').length
      const labTotalCompleted = batches.filter((b) => b.status === 'COMPLETED').length

      const response = {
        myBatches: myBatches.map((batch) => ({
          id: batch.id,
          batchNumber: batch.batchNumber,
          recipe: batch.recipe,
          quantity: batch.quantity,
          status: batch.status,
          assignment: {
            id: batch.id,
            status: batch.status,
            assignedAt: batch.createdAt.toISOString(),
          },
        })),
        labBatches: labBatches.map((batch) => ({
          id: batch.id,
          batchNumber: batch.batchNumber,
          recipe: batch.recipe,
          assignedWorker: batch.employee ? { id: batch.employee.id, name: batch.employee.name } : null,
          status: batch.status,
        })),
        stats: {
          myAssignedToday,
          myCompletedToday,
          labTotalInProgress,
          labTotalCompleted,
        },
      }

      return NextResponse.json({ success: true, data: response }, { status: 200 })
    } catch (error) {
      console.error('[GET /api/worker/dashboard] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard data.' },
        },
        { status: 500 },
      )
    }
  },
)
