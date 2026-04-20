import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import { CreateMachineSchema } from '@/lib/validators-production'

// ---------------------------------------------------------------------------
// GET /api/admin/machines  (admin only)
// ---------------------------------------------------------------------------
// Returns a paginated list of machines with their parent lab name.
// Query params:
//   cursor  — opaque cursor from a previous response (machine id)
//   take    — page size (default 25, max 100)
//   labId   — optional filter by lab
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') ?? undefined
    const rawTake = parseInt(searchParams.get('take') ?? '25', 10)
    const take = Math.min(Math.max(rawTake, 1), 100)
    const labIdFilter = searchParams.get('labId') ?? undefined

    const where = labIdFilter ? { labId: labIdFilter } : {}

    const machines = await prisma.machine.findMany({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        lab: { select: { id: true, name: true } },
      },
    })

    const hasNextPage = machines.length > take
    const page = hasNextPage ? machines.slice(0, take) : machines
    const nextCursor = hasNextPage ? page[page.length - 1].id : null

    const total = await prisma.machine.count({ where })

    return NextResponse.json({
      success: true,
      data: page,
      pagination: { nextCursor, hasNextPage, total },
    })
  } catch (error) {
    console.error('[GET /api/admin/machines] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve machines.' },
      },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// POST /api/admin/machines  (admin only)
// ---------------------------------------------------------------------------
// Creates a new machine and associates it with the given lab.
// Body: CreateMachineInput — labId, name, type, batchCapacity, cycleTimeMinutes,
//       available (optional, defaults to true)
// Returns 201 with the created machine record.
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

    const result = CreateMachineSchema.safeParse(body)

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

    const { labId, ...machineData } = result.data

    // Verify the referenced lab actually exists before creating the machine.
    const lab = await prisma.productionLab.findUnique({ where: { id: labId } })

    if (!lab) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LAB_NOT_FOUND',
            message: `Lab '${labId}' was not found. Cannot assign machine to a non-existent lab.`,
          },
        },
        { status: 404 },
      )
    }

    const machine = await prisma.machine.create({
      data: {
        labId,
        ...machineData,
      },
    })

    return NextResponse.json({ success: true, data: machine }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/admin/machines] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create machine.' },
      },
      { status: 500 },
    )
  }
})
