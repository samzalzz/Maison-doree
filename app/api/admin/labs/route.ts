import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateLabSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// POST /api/admin/labs  (admin only)
// ---------------------------------------------------------------------------
// Creates a new production lab.
// Body: { name, type, capacity }
// Returns 201 with the created lab.
// ---------------------------------------------------------------------------

export const POST = withAdminAuth(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Request body must be valid JSON.' },
        },
        { status: 400 },
      )
    }

    const result = CreateLabSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed.',
            details: result.error.flatten(),
          },
        },
        { status: 422 },
      )
    }

    const lab = await prisma.productionLab.create({
      data: result.data,
    })

    return NextResponse.json({ success: true, data: lab }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/labs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create lab.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// GET /api/admin/labs  (admin only)
// ---------------------------------------------------------------------------
// Returns all production labs with an aggregated stock summary (total distinct
// materials held and the count of lab stock entries at or below min threshold).
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (_req: NextRequest) => {
  try {
    // Fetch all labs, including their stock entries so we can build the summary
    const labs = await prisma.productionLab.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        stock: {
          select: {
            id: true,
            materialId: true,
            quantity: true,
            minThreshold: true,
          },
        },
        _count: {
          select: {
            employees: true,
            machines: true,
            batches: true,
          },
        },
      },
    })

    // Attach a concise stock summary to each lab response without exposing
    // every individual LabStock row on the list endpoint.
    const labsWithSummary = labs.map((lab) => {
      const totalMaterials = lab.stock.length
      const lowStockCount = lab.stock.filter((s) =>
        s.quantity.lessThanOrEqualTo(s.minThreshold),
      ).length

      return {
        id: lab.id,
        name: lab.name,
        type: lab.type,
        capacity: lab.capacity,
        createdAt: lab.createdAt,
        updatedAt: lab.updatedAt,
        stockSummary: {
          totalMaterials,
          lowStockCount,
        },
        _count: lab._count,
      }
    })

    return NextResponse.json({ success: true, data: labsWithSummary })
  } catch (error) {
    console.error('[GET /api/admin/labs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve labs.' },
      },
      { status: 500 },
    )
  }
})
